#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_content.py — genera las páginas de contenido long-tail de ClaroCalc
(clusters de hipoteca, sueldo neto e interés compuesto) y el sitemap.xml.

Los números mostrados se calculan con las MISMAS fórmulas que usan las
calculadoras interactivas (calc-hipoteca.js, calc-sueldo-neto.js,
calc-interes-compuesto.js), portadas a Python — nunca se inventan cifras.

Uso:  python3 tools/build_content.py
"""
import os
import re
import html
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VER = datetime.date.today().strftime("%Y%m%d")
SITE_URL = "https://utilix.uno"
ADSENSE_TAG = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2829981614170975" crossorigin="anonymous"></script>'

# ---------------------------------------------------------------------------
# Fórmulas portadas EXACTAMENTE de las calculadoras JS (misma matemática)
# ---------------------------------------------------------------------------

def compute_hipoteca(P, annual_rate_pct, years):
    r = annual_rate_pct / 100 / 12
    n = round(years * 12)
    cuota = (P * r) / (1 - (1 + r) ** -n) if r > 0 else P / n
    total_pagado = cuota * n
    total_intereses = total_pagado - P
    return {"cuota": cuota, "total_pagado": total_pagado, "total_intereses": total_intereses}


IRPF_BRACKETS = [
    (12450, 0.19), (20200, 0.24), (35200, 0.30), (60000, 0.37), (300000, 0.45), (float("inf"), 0.47),
]
SS_RATE_TRABAJADOR = 0.0635
SS_BASE_MAX_ANUAL = 56646
GASTOS_DEDUCIBLES = 2000
MINIMO_PERSONAL_SOLTERO = 5550
MINIMO_CONYUGE_ADICIONAL = 3400
MINIMO_HIJOS = [0, 2400, 2700, 4000]


def progressive_tax(base):
    if base <= 0:
        return 0.0
    tax, prev_limit = 0.0, 0.0
    for hasta, tipo in IRPF_BRACKETS:
        top = min(base, hasta)
        if top > prev_limit:
            tax += (top - prev_limit) * tipo
        prev_limit = hasta
        if base <= hasta:
            break
    return tax


def compute_sueldo_neto(bruto, situacion="soltero", num_hijos=0, comunidad_adjust=1.0):
    ss = min(bruto, SS_BASE_MAX_ANUAL) * SS_RATE_TRABAJADOR
    base_imponible = max(0.0, bruto - ss - GASTOS_DEDUCIBLES)
    minimo = MINIMO_PERSONAL_SOLTERO
    if situacion == "casado":
        minimo += MINIMO_CONYUGE_ADICIONAL
    minimo += MINIMO_HIJOS[min(num_hijos, 3)]
    base_liquidable = max(0.0, base_imponible - minimo)
    irpf = progressive_tax(base_liquidable) * comunidad_adjust
    neto_anual = bruto - ss - irpf
    return {"ss": ss, "irpf": irpf, "neto_anual": neto_anual, "neto_mensual": neto_anual / 12}


def compute_interes(P0, aportacion_mensual, annual_pct, years):
    r = annual_pct / 100 / 12
    n = round(years * 12)
    factor = ((1 + r) ** n - 1) / r if r > 0 else n
    final_val = P0 * (1 + r) ** n + aportacion_mensual * factor if r > 0 else P0 + aportacion_mensual * n
    total_aportado = P0 + aportacion_mensual * n
    return {"final": final_val, "aportado": total_aportado, "intereses": final_val - total_aportado}


def solve_aportacion_para_objetivo(target, annual_pct, years, P0=0):
    r = annual_pct / 100 / 12
    n = round(years * 12)
    factor = ((1 + r) ** n - 1) / r if r > 0 else n
    restante = target - P0 * (1 + r) ** n if r > 0 else target - P0
    return max(0.0, restante / factor)


# Tipos de referencia: los MISMOS valores por defecto que ya usa cada calculadora
TIPO_HIPOTECA_REF = 3.2
TIPO_INTERES_REF = 6.0

# ---------------------------------------------------------------------------
# Helpers de formato y HTML
# ---------------------------------------------------------------------------

def esc(s):
    return html.escape(str(s), quote=True)


def eur(v, decimals=0):
    s = f"{v:,.{decimals}f}"
    s = s.replace(",", "_").replace(".", ",").replace("_", ".")
    return s + " €"


NAV_ITEMS = [
    ("/hipoteca.html", "Hipoteca"),
    ("/interes-compuesto.html", "Interés compuesto"),
    ("/prestamo-personal.html", "Préstamo"),
    ("/jubilacion.html", "Jubilación"),
    ("/sueldo-neto.html", "Sueldo neto"),
]


def header_html():
    links = "\n      ".join(f'<a href="{p}">{label}</a>' for p, label in NAV_ITEMS)
    return f"""<header class="site-header">
  <div class="container-wide header-row">
    <a class="brand" href="/index.html">
      <span class="brand-mark" aria-hidden="true">◆</span>
      <span class="brand-name">ClaroCalc</span>
    </a>
    <nav class="header-nav" aria-label="Calculadoras">
      {links}
    </nav>
  </div>
</header>"""


def footer_html():
    return f"""<footer class="site-footer">
  <div class="container-wide">
    <div class="footer-cols">
      <div>
        <h4>ClaroCalc</h4>
        <p>Calculadoras financieras claras, gratis y sin registro. Todo el cálculo ocurre en tu navegador.</p>
      </div>
      <div>
        <h4>Calculadoras</h4>
        <ul>
          <li><a href="/hipoteca.html">Hipoteca</a></li>
          <li><a href="/interes-compuesto.html">Interés compuesto</a></li>
          <li><a href="/prestamo-personal.html">Préstamo personal</a></li>
          <li><a href="/jubilacion.html">Jubilación</a></li>
          <li><a href="/sueldo-neto.html">Sueldo neto</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="/privacidad.html">Privacidad</a></li>
          <li><a href="/aviso-legal.html">Aviso legal</a></li>
        </ul>
      </div>
    </div>
    <p class="disclaimer-line">© {datetime.date.today().year} ClaroCalc. Los resultados son estimaciones orientativas y no constituyen asesoramiento financiero, fiscal ni de inversión.</p>
  </div>
</footer>"""


def faq_schema(pairs):
    items = ",\n    ".join(
        '{ "@type": "Question", "name": %s, "acceptedAnswer": { "@type": "Answer", "text": %s } }'
        % (_json_str(q), _json_str(a))
        for q, a in pairs
    )
    return f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {items}
  ]
}}
</script>"""


def _json_str(s):
    import json
    return json.dumps(s, ensure_ascii=False)


def breadcrumb_schema(label, path):
    return f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{ "@type": "ListItem", "position": 1, "name": "Calculadoras", "item": "{SITE_URL}/" }},
    {{ "@type": "ListItem", "position": 2, "name": "{esc(label)}", "item": "{SITE_URL}{path}" }}
  ]
}}
</script>"""


def page_shell(title, description, path, breadcrumb_label, body, faq_pairs):
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{SITE_URL}{path}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:image" content="{SITE_URL}/assets/img/og-image.png">
<meta property="og:locale" content="es_ES">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css?v={VER}">
{ADSENSE_TAG}
{faq_schema(faq_pairs)}
{breadcrumb_schema(breadcrumb_label, path)}
</head>
<body>
<a class="skip-link" href="#contenido">Ir al contenido</a>
{header_html()}
{body}
{footer_html()}
</body>
</html>
"""


def ad_slot():
    return """<div class="ad-slot container-wide" data-ad-slot>
  <span class="ad-label">ANUNCIO</span>
  <!-- PEGA AQUÍ TU CÓDIGO DE ADSENSE -->
</div>"""


def faq_html(pairs):
    items = "\n".join(
        f'<details class="faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in pairs
    )
    return f"""<section class="faq-section container-wide">
  <h2>Preguntas frecuentes</h2>
  <div class="faq-list">
    {items}
  </div>
</section>"""


def more_links_html(links):
    items = "\n".join(f'<a class="more-card" href="{href}"><h3>{esc(label)}</h3><p>{esc(sub)}</p></a>' for href, label, sub in links)
    return f"""<section class="more-section container-wide">
  <h2>Sigue leyendo</h2>
  <div class="more-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
    {items}
  </div>
</section>"""


def write(rel_path, content):
    full = os.path.join(ROOT, rel_path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print("  ✓", rel_path)


# ---------------------------------------------------------------------------
# Cluster 1 — HIPOTECAS
# ---------------------------------------------------------------------------

def build_hipoteca_page(importe):
    slug = f"hipoteca-{importe}-euros"
    path = f"/{slug}/"
    label = f"Hipoteca de {eur(importe)}"

    escenarios = [(20, TIPO_HIPOTECA_REF), (25, TIPO_HIPOTECA_REF), (30, TIPO_HIPOTECA_REF)]
    filas = []
    for years, rate in escenarios:
        r = compute_hipoteca(importe, rate, years)
        filas.append((years, rate, r))

    principal_years, principal_rate = 30, TIPO_HIPOTECA_REF
    principal = compute_hipoteca(importe, principal_rate, principal_years)

    rows_html = "\n".join(
        f'<tr><td>{y} años</td><td>{rate}%</td><td>{eur(r["cuota"], 2)}</td>'
        f'<td>{eur(r["total_pagado"])}</td><td>{eur(r["total_intereses"])}</td></tr>'
        for y, rate, r in filas
    )

    cta_href = f"/hipoteca.html?importe={importe}&interes={principal_rate}&plazo={principal_years}"

    body = f"""<main id="contenido">
  <section class="calc-hero container-wide">
    <p class="breadcrumb"><a href="/index.html">Calculadoras</a> / {esc(label)}</p>
    <h1>Hipoteca de {eur(importe)}: cuota mensual y coste total</h1>
    <p class="hero-sub">Cuánto pagarías al mes por una hipoteca de {eur(importe)} según el plazo, con el sistema de amortización francés (el que usan los bancos en España).</p>
  </section>

  <div class="container-wide">
    <div class="result-stat is-primary" style="max-width:420px;margin-bottom:1.6rem;">
      <span class="stat-label">Respuesta rápida — a {principal_years} años, {principal_rate}% fijo</span>
      <span class="stat-value">{eur(principal["cuota"], 2)} / mes</span>
    </div>

    <section class="explain-section">
      <h2>Cuota según el plazo</h2>
      <div class="explain-copy">
        <p>Para una hipoteca de <strong>{eur(importe)}</strong>, así queda la cuota mensual, el total pagado y los intereses totales según elijas 20, 25 o 30 años. Usamos un <strong>{TIPO_HIPOTECA_REF}% fijo</strong> como tipo de referencia orientativo — es el mismo valor que trae la calculadora por defecto; ajusta el tipo real que te ofrezca tu banco para ver tu caso exacto.</p>
      </div>
      <div class="amort-table-wrap" style="max-height:none;">
        <table class="amort-table">
          <thead><tr><th>Plazo</th><th>Tipo</th><th>Cuota mensual</th><th>Total pagado</th><th>Total intereses</th></tr></thead>
          <tbody>{rows_html}</tbody>
        </table>
      </div>
      <p style="margin-top:1rem;"><a class="btn" href="{cta_href}">Calcular esta hipoteca con tus datos →</a></p>

      <h2>Cómo se calcula</h2>
      <div class="explain-copy">
        <p>La cuota mensual sigue la fórmula del <strong>sistema de amortización francés</strong>, el estándar en España: la cuota es igual todos los meses, pero al principio la mayor parte es interés y al final es casi todo capital.</p>
        <div class="formula-box">cuota = P × r / (1 − (1 + r)⁻ⁿ)<br>P = importe · r = interés mensual · n = número de cuotas</div>
        <p>Con {eur(importe)} a {principal_years} años y un {principal_rate}% fijo, pagarías <strong>{eur(principal["total_pagado"])}</strong> en total, de los cuales <strong>{eur(principal["total_intereses"])}</strong> son intereses — el resto es la devolución del capital prestado.</p>
      </div>
    </section>

    {ad_slot()}

  </div>

  {faq_html(FAQ_HIPOTECA)}

  {more_links_html(hipoteca_more_links(importe))}
</main>"""

    title = f"Hipoteca de {eur(importe)}: cuota mensual a 20, 25 y 30 años | ClaroCalc"
    desc = f"Cuánto pagarías al mes por una hipoteca de {eur(importe)} a 20, 25 o 30 años. Cuota, total pagado e intereses, calculados al instante."
    write(f"{slug}/index.html", page_shell(title, desc, path, label, body, FAQ_HIPOTECA))
    return path, title


FAQ_HIPOTECA = [
    ("¿Qué tipo de interés se usa en estos ejemplos?", f"Un {TIPO_HIPOTECA_REF}% fijo de referencia, el mismo valor por defecto de la calculadora. Es solo orientativo: el tipo real depende del banco, tu perfil y las condiciones vigentes en el momento de contratar."),
    ("¿La cuota incluye seguros o comisiones?", "No. Estos ejemplos calculan solo capital e intereses según el sistema de amortización francés. Comisiones de apertura, seguros vinculados u otros gastos no están incluidos."),
    ("¿Por qué pagar a más años reduce la cuota pero sube el total?", "Al alargar el plazo, cada cuota mensual es menor porque el capital se reparte en más pagos — pero pagas intereses durante más tiempo, así que el coste total de la hipoteca sube."),
]


def hipoteca_more_links(current):
    amounts = [100000, 150000, 200000, 250000, 300000]
    others = [a for a in amounts if a != current][:3]
    links = [(f"/hipoteca-{a}-euros/", f"Hipoteca de {eur(a)}", "Cuota y coste total") for a in others]
    links.append(("/hipoteca.html", "Calculadora de hipoteca completa", "Con tus propios datos y cuadro de amortización"))
    return links


# ---------------------------------------------------------------------------
# Cluster 2 — SUELDO NETO
# ---------------------------------------------------------------------------

def build_sueldo_page(bruto):
    slug = f"{bruto}-brutos-a-netos"
    path = f"/{slug}/"
    label = f"{eur(bruto)} brutos a netos"

    escenarios = [
        ("Soltero/a, sin hijos", "soltero", 0),
        ("Casado/a, sin hijos", "casado", 0),
        ("Soltero/a, 1 hijo", "soltero", 1),
    ]
    filas = []
    for etiqueta, situacion, hijos in escenarios:
        r = compute_sueldo_neto(bruto, situacion, hijos, comunidad_adjust=1.0)
        filas.append((etiqueta, r))

    principal_etiqueta, principal = "Soltero/a, sin hijos", filas[0][1]

    rows_html = "\n".join(
        f'<tr><td>{esc(etq)}</td><td>{eur(r["neto_mensual"], 2)}</td><td>{eur(r["neto_anual"])}</td><td>{eur(r["irpf"])}</td></tr>'
        for etq, r in filas
    )

    cta_href = f"/sueldo-neto.html?bruto={bruto}&situacion=soltero&hijos=0&comunidad=otras"

    body = f"""<main id="contenido">
  <section class="calc-hero container-wide">
    <p class="breadcrumb"><a href="/index.html">Calculadoras</a> / {esc(label)}</p>
    <h1>{eur(bruto)} brutos ¿cuánto es neto?</h1>
    <p class="hero-sub">Cuánto te queda al mes y al año de un salario bruto de {eur(bruto)}, con la retención de IRPF y Seguridad Social estimadas.</p>
  </section>

  <div class="container-wide">
    <div class="result-stat is-primary" style="max-width:420px;margin-bottom:1.6rem;">
      <span class="stat-label">Respuesta rápida — {principal_etiqueta.lower()}, media nacional</span>
      <span class="stat-value">{eur(principal["neto_mensual"], 2)} / mes</span>
    </div>

    <section class="explain-section">
      <h2>Neto según tu situación personal</h2>
      <div class="explain-copy">
        <p>De un bruto de <strong>{eur(bruto)}</strong> al año, esto es lo que quedaría neto según tu situación personal (calculado con la escala general de IRPF, sin ajuste por comunidad autónoma — la comunidad puede subir o bajar el resultado un poco):</p>
      </div>
      <div class="amort-table-wrap" style="max-height:none;">
        <table class="amort-table">
          <thead><tr><th>Situación</th><th>Neto mensual</th><th>Neto anual</th><th>IRPF retenido</th></tr></thead>
          <tbody>{rows_html}</tbody>
        </table>
      </div>
      <p style="margin-top:1rem;"><a class="btn" href="{cta_href}">Calcular con tu comunidad autónoma →</a></p>

      <h2>De dónde sale el descuento</h2>
      <div class="explain-copy">
        <p>Del bruto se restan dos cosas: la <strong>cotización a la Seguridad Social</strong> (aprox. 6,35% del bruto, con un tope anual de cotización) y el <strong>IRPF</strong>, calculado de forma progresiva por tramos sobre la base imponible una vez aplicados el mínimo personal y familiar. Para {eur(bruto)} en soltero sin hijos, la Seguridad Social se lleva {eur(principal["ss"])} y el IRPF {eur(principal["irpf"])} al año.</p>
        <p>Esto es una <strong>estimación orientativa</strong> con la escala general de IRPF: no sustituye a tu nómina real, que puede variar por convenio, pagas extra prorrateadas, planes de pensiones u otras deducciones.</p>
      </div>
    </section>

    {ad_slot()}

  </div>

  {faq_html(FAQ_SUELDO)}

  {more_links_html(sueldo_more_links(bruto))}
</main>"""

    title = f"{eur(bruto)} brutos a netos: sueldo neto mensual y anual | ClaroCalc"
    desc = f"Cuánto es {eur(bruto)} brutos al año en neto, mensual y anual, según tu situación personal. Estimación de IRPF y Seguridad Social al instante."
    write(f"{slug}/index.html", page_shell(title, desc, path, label, body, FAQ_SUELDO))
    return path, title


FAQ_SUELDO = [
    ("¿Esta cifra es exacta o una estimación?", "Es una estimación orientativa con la escala general de IRPF de España, sin el ajuste exacto de tu comunidad autónoma. Tu nómina real puede variar según convenio, pagas extra y otras deducciones."),
    ("¿Por qué cambia el neto entre soltero y casado?", "Al estar casado se aplica un mínimo familiar adicional que reduce la base sobre la que se calcula el IRPF, así que normalmente retienen algo menos — el efecto exacto depende también de si hay declaración conjunta."),
    ("¿Estos cálculos incluyen pagas extra?", "El bruto anual ya se entiende como el total del año, pagas extra incluidas si las tienes prorrateadas o no — el resultado es el neto anual total, que luego se reparte según tu forma de cobro."),
]


def sueldo_more_links(current):
    amounts = [25000, 30000, 35000, 40000, 50000]
    others = [a for a in amounts if a != current][:3]
    links = [(f"/{a}-brutos-a-netos/", f"{eur(a)} brutos a netos", "Sueldo neto mensual y anual") for a in others]
    links.append(("/sueldo-neto.html", "Calculadora de sueldo neto completa", "Con tu comunidad autónoma e hijos"))
    return links


# ---------------------------------------------------------------------------
# Cluster 3 — INTERÉS COMPUESTO
# ---------------------------------------------------------------------------

def build_interes_page(mensual):
    slug = f"invertir-{mensual}-euros-al-mes"
    path = f"/{slug}/"
    label = f"Invertir {eur(mensual)} al mes"

    horizontes = [10, 20, 30]
    filas = []
    for years in horizontes:
        r = compute_interes(0, mensual, TIPO_INTERES_REF, years)
        filas.append((years, r))

    principal_years = 20
    principal = dict(filas)[principal_years] if False else compute_interes(0, mensual, TIPO_INTERES_REF, principal_years)

    rows_html = "\n".join(
        f'<tr><td>{y} años</td><td>{eur(r["aportado"])}</td><td>{eur(r["intereses"])}</td><td>{eur(r["final"])}</td></tr>'
        for y, r in filas
    )

    cta_href = f"/interes-compuesto.html?capital=0&aportacion={mensual}&interes={TIPO_INTERES_REF}&anios={principal_years}"

    body = f"""<main id="contenido">
  <section class="calc-hero container-wide">
    <p class="breadcrumb"><a href="/index.html">Calculadoras</a> / {esc(label)}</p>
    <h1>Invertir {eur(mensual)} al mes: cuánto llegarías a tener</h1>
    <p class="hero-sub">Proyección de invertir {eur(mensual)} cada mes con interés compuesto, a 10, 20 y 30 años, partiendo de 0€.</p>
  </section>

  <div class="container-wide">
    <div class="result-stat is-primary" style="max-width:420px;margin-bottom:1.6rem;">
      <span class="stat-label">Respuesta rápida — a {principal_years} años, {TIPO_INTERES_REF}% anual</span>
      <span class="stat-value">{eur(principal["final"])}</span>
    </div>

    <section class="explain-section">
      <h2>Proyección según el tiempo invertido</h2>
      <div class="explain-copy">
        <p>Invirtiendo <strong>{eur(mensual)} al mes</strong> con una rentabilidad de referencia del <strong>{TIPO_INTERES_REF}% anual</strong> (el valor por defecto de la calculadora — orientativo, no garantizado: la rentabilidad real de cualquier inversión varía y puede ser negativa algunos años), así crecería tu capital según el tiempo:</p>
      </div>
      <div class="amort-table-wrap" style="max-height:none;">
        <table class="amort-table">
          <thead><tr><th>Tiempo</th><th>Total aportado</th><th>Intereses generados</th><th>Valor final</th></tr></thead>
          <tbody>{rows_html}</tbody>
        </table>
      </div>
      <p style="margin-top:1rem;"><a class="btn" href="{cta_href}">Calcular con tu rentabilidad y capital inicial →</a></p>

      <h2>Por qué el tiempo importa tanto</h2>
      <div class="explain-copy">
        <p>La diferencia entre 10 y 30 años no es lineal: a 30 años, más de la mitad del valor final de este ejemplo son <strong>intereses generados</strong>, no dinero que hayas puesto tú. Eso es el interés compuesto — los intereses de un año generan a su vez intereses los años siguientes.</p>
        <div class="formula-box">valor final = aportación × [(1 + r)ⁿ − 1] / r<br>r = rentabilidad mensual · n = número de meses</div>
      </div>
    </section>

    {ad_slot()}

  </div>

  {faq_html(FAQ_INTERES)}

  {more_links_html(interes_more_links(mensual))}
</main>"""

    title = f"Invertir {eur(mensual)} al mes: proyección a 10, 20 y 30 años | ClaroCalc"
    desc = f"Cuánto llegarías a tener invirtiendo {eur(mensual)} al mes con interés compuesto, a 10, 20 y 30 años. Cálculo al instante, sin registro."
    write(f"{slug}/index.html", page_shell(title, desc, path, label, body, FAQ_INTERES))
    return path, title


FAQ_INTERES = [
    (f"¿Por qué se usa un {TIPO_INTERES_REF}% de rentabilidad?", f"Es el valor por defecto de la calculadora, un número de referencia razonable a largo plazo para una cartera diversificada — pero no es una garantía. La rentabilidad real depende de dónde inviertas y varía de un año a otro."),
    ("¿Esto tiene en cuenta la inflación o los impuestos?", "No. Es una proyección bruta con interés compuesto. La inflación reduce el poder adquisitivo real del resultado, y al retirar las ganancias normalmente hay que tributar por ellas."),
    ("¿Qué pasa si empiezo con algo de capital ahorrado?", "El resultado final sería mayor: ese capital inicial también genera intereses compuestos durante todo el periodo. Pruébalo en la calculadora con tu capital de partida."),
]


def interes_more_links(current):
    amounts = [100, 200, 300, 500]
    others = [a for a in amounts if a != current][:2]
    links = [(f"/invertir-{a}-euros-al-mes/", f"Invertir {eur(a)} al mes", "Proyección a 10, 20 y 30 años") for a in others]
    links.append(("/cuanto-invertir-para-tener-100000-euros/", "¿Cuánto invertir para tener 100.000 €?", "La aportación mensual que necesitas"))
    links.append(("/interes-compuesto.html", "Calculadora de interés compuesto completa", "Con tu capital inicial y rentabilidad"))
    return links


def build_interes_reverse_page():
    slug = "cuanto-invertir-para-tener-100000-euros"
    path = f"/{slug}/"
    label = "Cuánto invertir para tener 100.000 €"
    target = 100000

    horizontes = [10, 15, 20, 25]
    filas = []
    for years in horizontes:
        aportacion = solve_aportacion_para_objetivo(target, TIPO_INTERES_REF, years)
        filas.append((years, aportacion))

    principal_years, principal_aportacion = 20, dict(filas)[20]

    rows_html = "\n".join(
        f'<tr><td>{y} años</td><td>{eur(a, 2)} / mes</td><td>{eur(a * y * 12)}</td></tr>'
        for y, a in filas
    )

    cta_href = f"/interes-compuesto.html?capital=0&aportacion={round(principal_aportacion)}&interes={TIPO_INTERES_REF}&anios={principal_years}"

    body = f"""<main id="contenido">
  <section class="calc-hero container-wide">
    <p class="breadcrumb"><a href="/index.html">Calculadoras</a> / {esc(label)}</p>
    <h1>¿Cuánto invertir al mes para tener 100.000 €?</h1>
    <p class="hero-sub">La aportación mensual que necesitas para llegar a 100.000 € según cuántos años quieras invertir, con interés compuesto.</p>
  </section>

  <div class="container-wide">
    <div class="result-stat is-primary" style="max-width:420px;margin-bottom:1.6rem;">
      <span class="stat-label">Respuesta rápida — en {principal_years} años, {TIPO_INTERES_REF}% anual</span>
      <span class="stat-value">{eur(principal_aportacion, 2)} / mes</span>
    </div>

    <section class="explain-section">
      <h2>Aportación necesaria según el plazo</h2>
      <div class="explain-copy">
        <p>Para llegar a <strong>{eur(target)}</strong> partiendo de 0€, con una rentabilidad de referencia del <strong>{TIPO_INTERES_REF}% anual</strong> (orientativa, no garantizada), esto es lo que tendrías que invertir cada mes según el plazo:</p>
      </div>
      <div class="amort-table-wrap" style="max-height:none;">
        <table class="amort-table">
          <thead><tr><th>Plazo</th><th>Aportación mensual</th><th>Total aportado</th></tr></thead>
          <tbody>{rows_html}</tbody>
        </table>
      </div>
      <p style="margin-top:1rem;"><a class="btn" href="{cta_href}">Ajustar esta proyección a tu caso →</a></p>

      <h2>Cuanto más tiempo, menos hace falta aportar</h2>
      <div class="explain-copy">
        <p>Cuanto más largo el plazo, menor es la aportación mensual necesaria — porque el interés compuesto hace una parte más grande del trabajo. Entre 10 y 25 años la diferencia en la aportación mensual es de varias veces, no solo proporcional al tiempo.</p>
      </div>
    </section>

    {ad_slot()}

  </div>

  {faq_html(FAQ_INTERES_REVERSE)}

  {more_links_html([
      ("/invertir-100-euros-al-mes/", "Invertir 100 € al mes", "Proyección a 10, 20 y 30 años"),
      ("/invertir-300-euros-al-mes/", "Invertir 300 € al mes", "Proyección a 10, 20 y 30 años"),
      ("/interes-compuesto.html", "Calculadora de interés compuesto completa", "Con tu capital inicial y rentabilidad"),
  ])}
</main>"""

    title = "¿Cuánto invertir al mes para tener 100.000 €? | ClaroCalc"
    desc = "La aportación mensual que necesitas para llegar a 100.000 € en 10, 15, 20 o 25 años, con interés compuesto. Cálculo al instante."
    write(f"{slug}/index.html", page_shell(title, desc, path, label, body, FAQ_INTERES_REVERSE))
    return path, title


FAQ_INTERES_REVERSE = [
    ("¿Qué pasa si ya tengo algo ahorrado?", "Necesitarías aportar menos cada mes: ese capital inicial también crece con interés compuesto durante todo el plazo. Pruébalo en la calculadora con tu punto de partida real."),
    (f"¿Por qué se usa un {TIPO_INTERES_REF}% de rentabilidad?", "Es el valor por defecto de la calculadora, un número de referencia razonable a largo plazo — no una garantía. La rentabilidad real depende de dónde inviertas."),
]


# ---------------------------------------------------------------------------
# sitemap.xml
# ---------------------------------------------------------------------------

def build_sitemap(extra_urls):
    core = ["/", "/hipoteca.html", "/interes-compuesto.html", "/prestamo-personal.html", "/jubilacion.html", "/sueldo-neto.html"]
    today = datetime.date.today().isoformat()
    urls = core + extra_urls
    entries = "\n".join(
        f"  <url><loc>{SITE_URL}{u}</loc><lastmod>{today}</lastmod></url>" for u in urls
    )
    xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{entries}\n</urlset>\n'
    write("sitemap.xml", xml)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    print(f"Generando páginas de contenido ClaroCalc (v={VER})...")
    extra_urls = []

    for importe in [100000, 150000, 200000, 250000, 300000]:
        path, _ = build_hipoteca_page(importe)
        extra_urls.append(path)

    for bruto in [25000, 30000, 35000, 40000, 50000]:
        path, _ = build_sueldo_page(bruto)
        extra_urls.append(path)

    for mensual in [100, 200, 300, 500]:
        path, _ = build_interes_page(mensual)
        extra_urls.append(path)

    path, _ = build_interes_reverse_page()
    extra_urls.append(path)

    build_sitemap(extra_urls)
    print(f"Listo: {len(extra_urls)} páginas nuevas + sitemap.xml ({len(extra_urls) + 6} URLs totales).")


if __name__ == "__main__":
    main()
