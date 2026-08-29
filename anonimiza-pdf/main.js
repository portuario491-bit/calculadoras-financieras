(function () {
  "use strict";
  const A = window.__APP__ || {};
  const $ = A.$, $$ = A.$$, safe = A.safe, escHTML = A.escHTML;
  const data = window.__BRAND__ || {};

  const CHECK_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>';

  function mountSteps() {
    const host = $("[data-steps]");
    if (!host || host.children.length || !data.pasos) return;
    host.innerHTML = data.pasos.map((p, i) => `
      <div class="card step-card">
        <div class="step-num">${i + 1}</div>
        <h3>${escHTML(p.titulo.replace(/^\d+\.\s*/, ""))}</h3>
        <p>${escHTML(p.texto)}</p>
      </div>
    `).join("");
  }

  function mountSectors() {
    const host = $("[data-sectors]");
    if (!host || host.children.length || !data.sectores) return;
    host.innerHTML = data.sectores.map(s => `
      <div class="card sector-card">
        <h3>${escHTML(s.nombre)}</h3>
        <p>${escHTML(s.texto)}</p>
      </div>
    `).join("");
  }

  function mountPricing() {
    const host = $("[data-pricing]");
    if (!host || host.children.length || !data.planes) return;
    host.innerHTML = data.planes.map(p => `
      <div class="card plan-card ${p.destacado ? "is-featured" : ""}">
        ${p.destacado ? '<span class="plan-featured-tag">Más elegido</span>' : ""}
        <div class="plan-name">${escHTML(p.nombre)}</div>
        <div class="plan-price">${p.precio}€ <span>/ ${escHTML(p.periodo)}</span></div>
        <div class="plan-credits">${p.creditos} créditos${p.precio > 0 ? " al mes" : ""}</div>
        <p class="plan-desc">${escHTML(p.descripcion)}</p>
        <ul class="plan-list">
          ${p.incluye.map(i => `<li>${CHECK_SVG}<span>${escHTML(i)}</span></li>`).join("")}
        </ul>
        <a href="registro.html?plan=${encodeURIComponent(p.id)}" class="btn ${p.destacado ? "btn-primary" : "btn-ghost"} btn-block">
          ${p.precio === 0 ? "Empezar gratis" : "Elegir " + p.nombre}
        </a>
      </div>
    `).join("");
  }

  function mountFaq() {
    const host = $("[data-faq]");
    if (!host || host.children.length || !data.faqs) return;
    host.innerHTML = data.faqs.map((f, i) => `
      <div class="faq-item" data-faq-item>
        <button type="button" class="faq-q" aria-expanded="false" aria-controls="faq-a-${i}">
          <span>${escHTML(f.p)}</span>
          <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="faq-a" id="faq-a-${i}"><div class="faq-a-inner">${escHTML(f.r)}</div></div>
      </div>
    `).join("");
  }

  function initFaqToggle() {
    $$("[data-faq-item]").forEach(item => {
      const btn = $(".faq-q", item);
      const a = $(".faq-a", item);
      if (!btn || !a) return;
      btn.addEventListener("click", () => {
        const open = item.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(open));
        a.style.maxHeight = open ? a.scrollHeight + "px" : "0px";
      });
    });
  }

  function initDemoToggle() {
    const doc = $("#demoDoc");
    const btns = $$(".demo-doc-toggle button");
    if (!doc || !btns.length) return;
    btns.forEach(b => b.addEventListener("click", () => {
      btns.forEach(x => x.classList.remove("is-active"));
      b.classList.add("is-active");
      doc.setAttribute("data-mode", b.getAttribute("data-demo-mode"));
    }));
  }

  function boot() {
    safe(mountSteps, "mountSteps");
    safe(mountSectors, "mountSectors");
    safe(mountPricing, "mountPricing");
    safe(mountFaq, "mountFaq");
    safe(initFaqToggle, "initFaqToggle");
    safe(initDemoToggle, "initDemoToggle");
    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
