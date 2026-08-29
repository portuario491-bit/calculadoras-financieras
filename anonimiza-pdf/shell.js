(function () {
  "use strict";
  const A = window.__APP__ || {};
  const $ = A.$, $$ = A.$$, safe = A.safe, toast = A.toast, apiCall = A.apiCall, escHTML = A.escHTML;
  const brand = window.__BRAND__ || {};

  function planLabel(id) {
    const p = (brand.planes || []).find(x => x.id === id);
    return p ? p.nombre : id;
  }
  function planData(id) {
    return (brand.planes || []).find(x => x.id === id) || null;
  }

  function updateCredits(usuario) {
    const n = $("#creditsN");
    const pill = $("#creditsPill");
    if (!n || !usuario) return;
    n.textContent = usuario.creditos;
    n.style.transform = "scale(1.25)";
    setTimeout(() => { n.style.transform = "scale(1)"; }, 220);
    if (pill) pill.classList.toggle("is-low", usuario.creditos <= 2);
  }

  function initShell(usuario) {
    if (!usuario) return;
    const label = $("#userEmailLabel");
    const avatar = $("#userAvatar");
    if (label) label.textContent = usuario.email.length > 20 ? usuario.email.slice(0, 18) + "…" : usuario.email;
    if (avatar) avatar.textContent = usuario.email.charAt(0).toUpperCase();
    updateCredits(usuario);

    const menu = $("#userMenu");
    const btn = $("#userMenuBtn");
    if (menu && btn) {
      btn.addEventListener("click", (e) => { e.stopPropagation(); menu.classList.toggle("is-open"); });
      document.addEventListener("click", () => menu.classList.remove("is-open"));
    }
    const logout = $("#btnLogout");
    if (logout) {
      logout.addEventListener("click", async () => {
        await apiCall("logout", {});
        window.location.href = "index.html";
      });
    }
  }

  function initCheckoutModal(opts) {
    opts = opts || {};
    const backdrop = $("#modalCheckout");
    if (!backdrop) return { open: function () {} };
    const btnClose = $("#btnCloseCheckout");
    const btnConfirm = $("#btnConfirmCheckout");
    let currentPlan = null;

    function close() { backdrop.classList.remove("is-open"); }
    function open(planId) {
      currentPlan = planId;
      const p = planData(planId);
      if (!p) return;
      $("#checkoutTitle").textContent = "Quiero el plan " + p.nombre;
      $("#checkoutDesc").textContent = p.precio + "€ / mes · " + p.creditos + " créditos al mes. Los pagos todavía no están activos: apúntate y te avisamos en cuanto puedas contratarlo, sin ningún compromiso.";
      backdrop.classList.add("is-open");
    }
    if (btnClose) btnClose.addEventListener("click", close);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    if (btnConfirm) {
      btnConfirm.addEventListener("click", async () => {
        if (!currentPlan) return;
        btnConfirm.disabled = true; btnConfirm.textContent = "Apuntando…";
        const r = await apiCall("interes", { plan: currentPlan });
        btnConfirm.disabled = false; btnConfirm.textContent = "Apuntarme a la lista de espera";
        if (!r.ok) { toast(r.error || "No se ha podido registrar tu interés.", "err"); return; }
        close();
        toast("¡Apuntado! Te avisaremos en cuanto el plan " + planLabel(currentPlan) + " esté disponible.", "ok");
        if (opts.onConfirmed) opts.onConfirmed(null);
      });
    }
    return { open, close };
  }

  window.__SHELL__ = { initShell, updateCredits, initCheckoutModal, planLabel, planData };
})();
