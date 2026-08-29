(function () {
  "use strict";
  const A = window.__APP__ || {};
  const $ = A.$, safe = A.safe, toast = A.toast, apiCall = A.apiCall;

  function showError(msg) {
    const el = $("#formError");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
  }
  function hideError() {
    const el = $("#formError");
    if (el) el.classList.remove("is-visible");
  }

  function initRegistro() {
    const form = $("#formRegistro");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideError();
      const email = $("#email").value.trim();
      const password = $("#password").value;
      if (password.length < 8) { showError("La contraseña debe tener al menos 8 caracteres."); return; }
      const btn = $("#btnRegistro");
      btn.disabled = true; btn.textContent = "Creando cuenta…";
      const r = await apiCall("registro", { email, password });
      btn.disabled = false; btn.textContent = "Crear cuenta gratis";
      if (!r.ok) { showError(r.error || "No se ha podido crear la cuenta."); return; }
      toast("Cuenta creada. ¡Bienvenido!", "ok");
      const plan = new URLSearchParams(window.location.search).get("plan");
      window.location.href = "app.html" + (plan ? "?plan=" + encodeURIComponent(plan) : "");
    });
  }

  function initLogin() {
    const form = $("#formLogin");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideError();
      const email = $("#email").value.trim();
      const password = $("#password").value;
      const btn = $("#btnLogin");
      btn.disabled = true; btn.textContent = "Entrando…";
      const r = await apiCall("login", { email, password });
      btn.disabled = false; btn.textContent = "Entrar";
      if (!r.ok) { showError(r.error || "No se ha podido iniciar sesión."); return; }
      window.location.href = "app.html";
    });
  }

  function boot() {
    safe(initRegistro, "initRegistro");
    safe(initLogin, "initLogin");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
