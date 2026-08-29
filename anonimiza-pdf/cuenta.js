(function () {
  "use strict";
  const A = window.__APP__ || {};
  const S = window.__SHELL__ || {};
  const $ = A.$, safe = A.safe, toast = A.toast, apiCall = A.apiCall, escHTML = A.escHTML, fmtFechaHora = A.fmtFechaHora, fmtFecha = A.fmtFecha;
  const brand = window.__BRAND__ || {};

  let usuarioActual = null;
  let checkout = null;

  const ACCION_LABEL = {
    "censurar-pdf": "Página censurada",
    "upgrade": "Cambio de plan",
    "cancelacion": "Cancelación de plan",
    "registro": "Cuenta creada"
  };

  function renderPlan(usuario) {
    const plan = brand.planes.find(p => p.id === usuario.plan) || brand.planes[0];
    $("#planNombre").textContent = plan.nombre;
    $("#planPrecio").textContent = plan.precio === 0 ? "Gratis" : plan.precio + "€/mes";
    const pct = plan.creditos > 0 ? Math.max(0, Math.min(100, (usuario.creditos / plan.creditos) * 100)) : 0;
    $("#creditsBar").style.width = pct + "%";
    $("#creditsResumen").textContent = usuario.creditos + " de " + plan.creditos + " créditos disponibles";
    $("#renovacionMeta").textContent = usuario.plan === "gratis"
      ? "El plan Gratis no se renueva: son 5 créditos de bienvenida."
      : "Próxima renovación: " + fmtFecha(usuario.renovacion);
    $("#btnCancelar").style.display = usuario.plan === "gratis" ? "none" : "inline-flex";
  }

  function renderPlanesMini(usuario) {
    const host = $("#planesMini");
    host.innerHTML = brand.planes.map(p => `
      <div class="plan-mini ${p.id === usuario.plan ? "is-current" : ""}">
        <strong>${escHTML(p.nombre)}</strong>
        <span>${p.precio === 0 ? "Gratis" : p.precio + "€/mes"} · ${p.creditos} créditos</span>
        ${p.id === usuario.plan
          ? `<div style="margin-top:8px"><span class="badge badge-ok">Plan actual</span></div>`
          : `<button type="button" class="btn btn-ghost btn-sm" style="margin-top:10px;width:100%" data-elegir-plan="${p.id}">${p.precio === 0 ? "Volver a Gratis" : "Elegir plan"}</button>`}
      </div>
    `).join("");
    host.querySelectorAll("[data-elegir-plan]").forEach(btn => {
      btn.addEventListener("click", () => {
        const planId = btn.getAttribute("data-elegir-plan");
        if (planId === "gratis") { cancelarPlan(); return; }
        checkout.open(planId);
      });
    });
  }

  function renderHistorial(usuario) {
    const body = $("#histBody");
    const hist = (usuario.historial || []).slice().reverse();
    if (!hist.length) {
      body.innerHTML = '<tr><td colspan="3" class="muted" style="padding:16px 6px">Todavía no has procesado ningún documento.</td></tr>';
      return;
    }
    body.innerHTML = hist.slice(0, 60).map(h => `
      <tr>
        <td>${fmtFechaHora(h.fecha)}</td>
        <td>${escHTML(ACCION_LABEL[h.accion] || h.accion)}${h.plan ? " → " + escHTML(h.plan) : ""}</td>
        <td>${h.coste ? "-" + h.coste + " créd." : "—"}</td>
      </tr>
    `).join("");
  }

  function renderAll(usuario) {
    usuarioActual = usuario;
    S.initShell(usuario);
    renderPlan(usuario);
    renderPlanesMini(usuario);
    renderHistorial(usuario);
  }

  async function cancelarPlan() {
    if (!window.confirm("¿Seguro que quieres cancelar y volver al plan Gratis? Perderás los créditos del plan de pago.")) return;
    const r = await apiCall("cancelar", {});
    if (!r.ok) { toast(r.error || "No se ha podido cancelar el plan.", "err"); return; }
    toast("Has vuelto al plan Gratis.", "ok");
    renderAll(r.usuario);
  }

  async function boot() {
    checkout = S.initCheckoutModal({});
    const usuario = await A.requireSession("login.html");
    if (!usuario) return;
    renderAll(usuario);
    const btnCancelar = $("#btnCancelar");
    if (btnCancelar) btnCancelar.addEventListener("click", cancelarPlan);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
