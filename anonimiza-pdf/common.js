(function () {
  "use strict";

  const $ = (sel, scope) => (scope || document).querySelector(sel);
  const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const escHTML = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function safe(fn, name) {
    try { return fn(); } catch (e) { console.warn("[" + name + "] failed:", e); }
  }

  function fmtMoney(n) {
    return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  }
  function fmtFecha(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
    } catch (_) { return iso; }
  }
  function fmtFechaHora(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) + " · " +
             d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    } catch (_) { return iso; }
  }

  function toast(msg, tipo) {
    const host = $("#toasts");
    if (!host) { console.warn("[toast]", msg); return; }
    const el = document.createElement("div");
    el.className = "toast" + (tipo === "err" ? " err" : tipo === "ok" ? " ok" : "");
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 320); }, 4200);
  }

  // Wraps fetch to api/*.php: always sends/receives JSON, always includes the
  // session cookie, and turns HTTP-level failures into a uniform shape so
  // callers never have to think about status codes.
  async function apiCall(endpoint, body) {
    try {
      const res = await fetch("api/" + endpoint + ".php", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
      let data = null;
      try { data = await res.json(); } catch (_) { data = null; }
      if (!res.ok) {
        return { ok: false, status: res.status, error: (data && data.error) || "No se ha podido completar la operación. Inténtalo de nuevo.", data };
      }
      return Object.assign({ ok: true, status: res.status }, data || {});
    } catch (e) {
      return { ok: false, status: 0, error: "No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo." };
    }
  }

  async function requireSession(redirectTo) {
    const r = await apiCall("yo", {});
    if (!r.ok || !r.usuario) {
      window.location.href = redirectTo || "login.html";
      return null;
    }
    return r.usuario;
  }

  window.__APP__ = { $, $$, safe, escHTML, fmtMoney, fmtFecha, fmtFechaHora, toast, apiCall, requireSession };
})();
