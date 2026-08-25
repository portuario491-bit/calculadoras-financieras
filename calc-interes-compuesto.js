(function () {
  "use strict";
  var C = window.__CALC__, CH = window.__CHART__;
  if (!C || !CH) return;
  var $ = C.$, safe = C.safe, num = C.num, clamp = C.clamp;

  var freq = "mensual";

  function compute(P0, aportacion, annualPct, years, freqKey) {
    var k = freqKey === "anual" ? 1 : 12;
    var r = annualPct / 100 / k;
    var N = Math.round(years * k);
    var factor = r > 0 ? (Math.pow(1 + r, N) - 1) / r : N;
    var finalVal = r > 0 ? P0 * Math.pow(1 + r, N) + aportacion * factor : P0 + aportacion * N;
    var totalAportado = P0 + aportacion * N;
    var intereses = finalVal - totalAportado;

    // yearly series for the chart
    var series = [];
    var stepsPerYear = k;
    var balance = P0, aportadoAcc = P0;
    series.push({ year: 0, valor: P0, aportado: P0 });
    var periodsDone = 0;
    for (var y = 1; y <= years; y++) {
      for (var s = 0; s < stepsPerYear; s++) {
        balance = balance * (1 + r) + aportacion;
        aportadoAcc += aportacion;
        periodsDone++;
      }
      series.push({ year: y, valor: balance, aportado: aportadoAcc });
    }
    return { finalVal: finalVal, totalAportado: totalAportado, intereses: intereses, series: series };
  }

  function render() {
    var P0 = clamp(num($("#capitalInicial"), 5000), 0, 5000000);
    var aportacion = clamp(num($("#aportacion"), 150), 0, 50000);
    var interes = clamp(num($("#interesCompuesto"), 6), 0, 25);
    var anios = clamp(num($("#anios"), 20), 1, 60);

    var rawP0 = num($("#capitalInicial"), NaN), rawAport = num($("#aportacion"), NaN), rawInt = num($("#interesCompuesto"), NaN), rawAnios = num($("#anios"), NaN);
    var invalid = !(rawP0 >= 0) || !(rawAport >= 0) || !(rawInt >= 0) || !(rawAnios > 0);
    $("#errorMsg").classList.toggle("is-visible", invalid);

    var res = compute(P0, aportacion, interes, anios, freq);

    $("#outFinal").textContent = C.fmtEUR.format(res.finalVal);
    $("#outAportado").textContent = C.fmtEUR.format(res.totalAportado);
    $("#outIntereses").textContent = C.fmtEUR.format(res.intereses);

    var valorSeries = res.series.map(function (p) { return { x: p.year, y: p.valor }; });
    var aportadoSeries = res.series.map(function (p) { return { x: p.year, y: p.aportado }; });

    safe(function () {
      CH.drawLineChart($("#chartInteres"), [
        { points: valorSeries, color: "#0f6b5c" },
        { points: aportadoSeries, color: "#c17a1f" }
      ], {
        shadeBetween: true,
        shadeColor: "rgba(15,107,92,0.12)",
        formatY: function (v) { return C.fmtEUR.format(v).replace(/\s?€/, ""); },
        formatX: function (v) { return "Año " + v; },
        xTicks: [0, Math.round(anios / 2), anios]
      });
    }, "drawLineChart interes");

    if (userInteracted && window.__ADS__) window.__ADS__.showResultDialogOnce("interes-compuesto");
  }

  var renderTimer = null;
  var userInteracted = false;
  function scheduleRender() { userInteracted = true; clearTimeout(renderTimer); renderTimer = setTimeout(render, 90); }

  function initFrecuencia() {
    var group = $("#frecuencia");
    if (!group) return;
    group.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-freq]");
      if (!btn) return;
      freq = btn.dataset.freq;
      Array.prototype.forEach.call(group.children, function (b) { b.classList.toggle("is-active", b === btn); });
      $("#aportacionHint").textContent = freq === "anual"
        ? "Se aporta una vez al año (según la frecuencia elegida abajo)."
        : "Se aporta cada mes (según la frecuencia elegida abajo).";
      scheduleRender();
    });
  }

  function initInputs() {
    ["#capitalInicial", "#aportacion", "#interesCompuesto", "#anios"].forEach(function (sel) {
      var el = $(sel);
      if (el) el.addEventListener("input", scheduleRender);
    });
  }

  function prefillFromQuery() {
    var q = new URLSearchParams(location.search);
    var map = { capital: "#capitalInicial", aportacion: "#aportacion", interes: "#interesCompuesto", anios: "#anios" };
    Object.keys(map).forEach(function (key) {
      var v = q.get(key);
      var el = $(map[key]);
      if (v !== null && el) el.value = v;
    });
  }

  function boot() {
    safe(initFrecuencia, "initFrecuencia");
    safe(initInputs, "initInputs");
    safe(prefillFromQuery, "prefillFromQuery");
    render();
    window.addEventListener("resize", function () { clearTimeout(renderTimer); renderTimer = setTimeout(render, 150); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
