(function () {
  "use strict";
  var C = window.__CALC__, CH = window.__CHART__;
  if (!C || !CH) return;
  var $ = C.$, safe = C.safe, num = C.num, clamp = C.clamp;

  function compute(edadActual, edadJub, ahorro, aportacion, rentabilidadPct) {
    var years = edadJub - edadActual;
    var r = rentabilidadPct / 100 / 12;
    var N = Math.round(years * 12);
    var series = [{ edad: edadActual, aportado: ahorro, valor: ahorro }];
    var balance = ahorro, aportadoAcc = ahorro;
    for (var y = 1; y <= years; y++) {
      for (var m = 0; m < 12; m++) {
        balance = balance * (1 + r) + aportacion;
        aportadoAcc += aportacion;
      }
      series.push({ edad: edadActual + y, aportado: aportadoAcc, valor: balance });
    }
    var final = series[series.length - 1];
    return { years: years, capitalFinal: final.valor, series: series };
  }

  function render() {
    var edadActual = clamp(Math.round(num($("#edadActual"), 35)), 16, 75);
    var edadJub = clamp(Math.round(num($("#edadJubilacion"), 67)), 17, 80);
    var ahorro = clamp(num($("#ahorroActual"), 8000), 0, 5000000);
    var aportacion = clamp(num($("#aportacionMensual"), 200), 0, 20000);
    var rentabilidad = clamp(num($("#rentabilidad"), 5), 0, 20);

    var rawEdadActual = num($("#edadActual"), NaN), rawEdadJub = num($("#edadJubilacion"), NaN);
    var rawAhorro = num($("#ahorroActual"), NaN), rawAportacion = num($("#aportacionMensual"), NaN), rawRent = num($("#rentabilidad"), NaN);
    var invalid = !(rawEdadJub > rawEdadActual) || !(rawAhorro >= 0) || !(rawAportacion >= 0) || !(rawRent >= 0);
    $("#errorMsg").classList.toggle("is-visible", invalid);

    if (edadJub <= edadActual) edadJub = edadActual + 1;

    var res = compute(edadActual, edadJub, ahorro, aportacion, rentabilidad);

    $("#outCapital").textContent = C.fmtEUR.format(res.capitalFinal);
    $("#outAnios").textContent = C.fmtInt.format(res.years);

    var valorSeries = res.series.map(function (p) { return { x: p.edad, y: p.valor }; });
    var aportadoSeries = res.series.map(function (p) { return { x: p.edad, y: p.aportado }; });

    safe(function () {
      CH.drawLineChart($("#chartJubilacion"), [
        { points: valorSeries, color: "#0f6b5c" },
        { points: aportadoSeries, color: "#c17a1f" }
      ], {
        shadeBetween: true,
        shadeColor: "rgba(15,107,92,0.12)",
        formatY: function (v) { return C.fmtEUR.format(v).replace(/\s?€/, ""); },
        formatX: function (v) { return v + " años"; },
        xTicks: [edadActual, Math.round((edadActual + edadJub) / 2), edadJub]
      });
    }, "drawLineChart jubilacion");

    var tbody = $("#jubilacionTable tbody");
    tbody.innerHTML = res.series.map(function (p) {
      return "<tr><td>" + p.edad + " años</td><td>" + C.fmtEUR.format(p.aportado) + "</td><td>" + C.fmtEUR.format(p.valor) + "</td></tr>";
    }).join("");

    if (userInteracted && window.__ADS__) window.__ADS__.showResultDialogOnce("jubilacion");
  }

  var renderTimer = null;
  var userInteracted = false;
  function scheduleRender() { userInteracted = true; clearTimeout(renderTimer); renderTimer = setTimeout(render, 90); }

  function boot() {
    ["#edadActual", "#edadJubilacion", "#ahorroActual", "#aportacionMensual", "#rentabilidad"].forEach(function (sel) {
      var el = $(sel);
      if (el) el.addEventListener("input", scheduleRender);
    });
    render();
    window.addEventListener("resize", function () { clearTimeout(renderTimer); renderTimer = setTimeout(render, 150); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
