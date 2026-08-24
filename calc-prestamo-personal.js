(function () {
  "use strict";
  var C = window.__CALC__;
  if (!C) return;
  var $ = C.$, safe = C.safe, num = C.num, clamp = C.clamp;

  function render() {
    var P = clamp(num($("#importePrestamo"), 10000), 300, 150000);
    var interes = clamp(num($("#interesPrestamo"), 8.5), 0, 30);
    var meses = clamp(Math.round(num($("#plazoMeses"), 60)), 3, 120);

    var rawP = num($("#importePrestamo"), NaN), rawInt = num($("#interesPrestamo"), NaN), rawMeses = num($("#plazoMeses"), NaN);
    var invalid = !(rawP > 0) || !(rawInt >= 0) || !(rawMeses > 0);
    $("#errorMsg").classList.toggle("is-visible", invalid);

    var r = interes / 100 / 12;
    var cuota = r > 0 ? (P * r) / (1 - Math.pow(1 + r, -meses)) : P / meses;
    var costeTotal = cuota * meses;
    var interesesTotales = costeTotal - P;
    var tae = r > 0 ? (Math.pow(1 + r, 12) - 1) * 100 : 0;

    $("#outCuota").textContent = C.fmtEUR2.format(cuota);
    $("#outCosteTotal").textContent = C.fmtEUR.format(costeTotal);
    $("#outTae").textContent = C.fmtPct.format(tae) + " %";
    $("#outInteresesTotales").textContent = C.fmtEUR.format(interesesTotales);
    $("#outNumCuotas").textContent = C.fmtInt.format(meses);

    if (userInteracted && window.__ADS__) window.__ADS__.showResultDialogOnce("prestamo-personal");
  }

  var renderTimer = null;
  var userInteracted = false;
  function scheduleRender() { userInteracted = true; clearTimeout(renderTimer); renderTimer = setTimeout(render, 90); }

  function boot() {
    ["#importePrestamo", "#interesPrestamo", "#plazoMeses"].forEach(function (sel) {
      var el = $(sel);
      if (el) el.addEventListener("input", scheduleRender);
    });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
