(function () {
  "use strict";

  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }
  function safe(fn, name) { try { return fn(); } catch (e) { console.warn("[" + name + "]", e); } }

  function initCornerToast() {
    var toast = $("#cornerAd");
    if (!toast) return;
    if (sessionStorage.getItem("cc_corner_dismissed")) return;
    setTimeout(function () { toast.hidden = false; }, 3500);
    var closeBtn = $("#cornerAdClose");
    if (closeBtn) closeBtn.addEventListener("click", function () {
      toast.hidden = true;
      try { sessionStorage.setItem("cc_corner_dismissed", "1"); } catch (e) {}
    });
  }

  function initAdDialog() {
    var dialog = $("#adDialog");
    if (!dialog) return;
    var close = function () { if (dialog.open) dialog.close(); };
    var closeBtn = $("#adDialogClose"), closeBtn2 = $("#adDialogCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (closeBtn2) closeBtn2.addEventListener("click", close);
    dialog.addEventListener("click", function (e) { if (e.target === dialog) close(); });
  }

  // Shown once per browser session per calculator page (not on every keystroke).
  function showResultDialogOnce(calcSlug) {
    var dialog = $("#adDialog");
    if (!dialog) return;
    var key = "cc_result_dialog_" + calcSlug;
    if (sessionStorage.getItem(key)) return;
    try { sessionStorage.setItem(key, "1"); } catch (e) {}
    setTimeout(function () { safe(function () { dialog.showModal(); }, "adDialog.showModal"); }, 400);
  }

  window.__ADS__ = { showResultDialogOnce: showResultDialogOnce };

  // ---------------------------------------------------------------- shared calc input helpers

  var fmtEUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  var fmtEUR2 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  var fmtPct = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  var fmtInt = new Intl.NumberFormat("es-ES");

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function num(el, fallback) {
    if (!el) return fallback;
    var v = parseFloat(String(el.value).replace(",", "."));
    return isFinite(v) ? v : fallback;
  }

  window.__CALC__ = { $: $, $$: $$, safe: safe, fmtEUR: fmtEUR, fmtEUR2: fmtEUR2, fmtPct: fmtPct, fmtInt: fmtInt, clamp: clamp, num: num };

  function boot() {
    safe(initCornerToast, "initCornerToast");
    safe(initAdDialog, "initAdDialog");
    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
