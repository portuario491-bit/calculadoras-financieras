(function () {
  "use strict";
  var C = window.__CALC__, CH = window.__CHART__;
  if (!C || !CH) return;
  var $ = C.$, safe = C.safe, num = C.num, clamp = C.clamp;

  var tipo = "fijo";
  var TIPO_NOTES = {
    fijo: "A tipo fijo, el interés no cambia durante toda la hipoteca.",
    variable: "A tipo variable, el interés se revisa periódicamente (normalmente cada 6-12 meses según el euríbor). El cálculo usa el tipo actual como si se mantuviera constante, a modo de referencia.",
    mixto: "En una hipoteca mixta hay un tramo inicial a tipo fijo y después pasa a variable. El cálculo usa el tipo introducido como referencia para todo el plazo."
  };

  function computeSchedule(P, annualRatePct, years) {
    var r = annualRatePct / 100 / 12;
    var n = Math.round(years * 12);
    var cuota = r > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;
    var balance = P;
    var yearly = []; // {year, cuotaAnual, capital, intereses, pendiente}
    var y = 1, capYear = 0, intYear = 0, cuotaYear = 0;
    for (var m = 1; m <= n; m++) {
      var interesMes = balance * r;
      var capitalMes = cuota - interesMes;
      balance = Math.max(0, balance - capitalMes);
      capYear += capitalMes; intYear += interesMes; cuotaYear += cuota;
      if (m % 12 === 0 || m === n) {
        yearly.push({ year: y, cuota: cuotaYear, capital: capYear, intereses: intYear, pendiente: balance });
        y++; capYear = 0; intYear = 0; cuotaYear = 0;
      }
    }
    return { cuota: cuota, n: n, yearly: yearly, totalPagado: cuota * n, totalIntereses: cuota * n - P };
  }

  var modoExtra = "plazo";
  var MODO_NOTES = {
    plazo: "Mantienes la misma cuota mensual, pero terminas de pagar antes.",
    cuota: "Mantienes el mismo plazo, pero pagas una cuota mensual más baja desde ese momento."
  };

  // Simula aplicar `extraAmount` al capital pendiente en el mes `extraMonth`,
  // manteniendo la cuota (modo "plazo") o recalculándola para el plazo restante (modo "cuota").
  function computeWithExtra(P, annualRatePct, years, extraAmount, extraYear, mode) {
    var r = annualRatePct / 100 / 12;
    var n = Math.round(years * 12);
    var cuota = r > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;
    var extraMonth = Math.round(clamp(extraYear, 1, Math.max(1, years - 1)) * 12);
    var balance = P, totalInteres = 0, m = 0, applied = false;
    var maxMonths = n + 1;
    while (balance > 0.5 && m < maxMonths) {
      m++;
      var interesMes = balance * r;
      var capitalMes = Math.min(cuota - interesMes, balance);
      balance -= capitalMes;
      totalInteres += interesMes;
      if (!applied && m === extraMonth && extraAmount > 0) {
        var extra = Math.min(extraAmount, balance);
        balance -= extra;
        applied = true;
        if (balance > 0.01 && mode === "cuota") {
          var remaining = n - m;
          if (remaining > 0) cuota = r > 0 ? (balance * r) / (1 - Math.pow(1 + r, -remaining)) : balance / remaining;
        }
      }
    }
    return { totalIntereses: totalInteres, meses: m, cuotaFinal: cuota };
  }

  function render() {
    var importe = clamp(num($("#importe"), 150000), 1000, 2000000);
    var interes = clamp(num($("#interes"), 3.2), 0, 15);
    var plazo = clamp(num($("#plazo"), 25), 1, 40);

    var rawImporte = num($("#importe"), NaN), rawInteres = num($("#interes"), NaN), rawPlazo = num($("#plazo"), NaN);
    var invalid = !(rawImporte > 0) || !(rawInteres >= 0) || !(rawPlazo > 0);
    $("#errorMsg").classList.toggle("is-visible", invalid);

    var res = computeSchedule(importe, interes, plazo);

    $("#outCuota").textContent = C.fmtEUR2.format(res.cuota);
    $("#outTotal").textContent = C.fmtEUR.format(res.totalPagado);
    $("#outIntereses").textContent = C.fmtEUR.format(res.totalIntereses);

    var pendienteSeries = res.yearly.map(function (r2) { return { x: r2.year, y: r2.pendiente }; });
    var interesAcumSeries = (function () {
      var acc = 0;
      return res.yearly.map(function (r2) { acc += r2.intereses; return { x: r2.year, y: acc }; });
    })();

    safe(function () {
      CH.drawLineChart($("#chartHipoteca"), [
        { points: pendienteSeries, color: "#0f6b5c" },
        { points: interesAcumSeries, color: "#c17a1f" }
      ], {
        formatY: function (v) { return C.fmtEUR.format(v).replace(/\s?€/, ""); },
        formatX: function (v) { return "Año " + v; },
        xTicks: [1, Math.round(res.yearly.length / 2) || 1, res.yearly.length]
      });
    }, "drawLineChart hipoteca");

    var tbody = $("#amortTable tbody");
    tbody.innerHTML = res.yearly.map(function (r2) {
      return "<tr><td>" + r2.year + "</td><td>" + C.fmtEUR.format(r2.cuota) + "</td><td>" + C.fmtEUR.format(r2.capital) +
        "</td><td>" + C.fmtEUR.format(r2.intereses) + "</td><td>" + C.fmtEUR.format(r2.pendiente) + "</td></tr>";
    }).join("");

    safe(function () {
      var extraImporte = clamp(num($("#extraImporte"), 10000), 0, 2000000);
      var extraAnio = clamp(num($("#extraAnio"), 5), 1, Math.max(1, plazo - 1));
      $("#extraAnio").max = Math.max(1, plazo - 1);

      var conExtra = computeWithExtra(importe, interes, plazo, extraImporte, extraAnio, modoExtra);
      var ahorro = res.totalIntereses - conExtra.totalIntereses;

      $("#outExtraAhorro").textContent = C.fmtEUR.format(Math.max(0, ahorro));

      if (modoExtra === "plazo") {
        var mesesTotales = conExtra.meses;
        var aniosNuevo = Math.floor(mesesTotales / 12), mesesResto = mesesTotales % 12;
        var plazoTexto = aniosNuevo + (aniosNuevo === 1 ? " año" : " años");
        if (mesesResto) plazoTexto += " " + mesesResto + (mesesResto === 1 ? " mes" : " meses");
        $("#outExtraSegundoLabel").textContent = "Nuevo plazo";
        $("#outExtraSegundo").textContent = plazoTexto;
        $("#outExtraCuota").textContent = C.fmtEUR2.format(res.cuota);
        $("#outExtraDetalle").textContent = "Terminarías de pagar " + (plazo * 12 - mesesTotales) + " meses antes, sin cambiar la cuota mensual.";
      } else {
        $("#outExtraSegundoLabel").textContent = "Plazo";
        $("#outExtraSegundo").textContent = plazo + " años";
        $("#outExtraCuota").textContent = C.fmtEUR2.format(conExtra.cuotaFinal);
        $("#outExtraDetalle").textContent = "Tu cuota bajaría de " + C.fmtEUR2.format(res.cuota) + " a " + C.fmtEUR2.format(conExtra.cuotaFinal) + " al mes a partir del año " + extraAnio + ", manteniendo el plazo original.";
      }
    }, "amortizacion anticipada");

    if (userInteracted && window.__ADS__) window.__ADS__.showResultDialogOnce("hipoteca");
  }

  var renderTimer = null;
  var userInteracted = false;
  function scheduleRender() { userInteracted = true; clearTimeout(renderTimer); renderTimer = setTimeout(render, 90); }

  function initTipoSegmented() {
    var group = $("#tipoHipoteca");
    if (!group) return;
    group.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-tipo]");
      if (!btn) return;
      tipo = btn.dataset.tipo;
      Array.prototype.forEach.call(group.children, function (b) { b.classList.toggle("is-active", b === btn); });
      $("#tipoNote").textContent = TIPO_NOTES[tipo];
      scheduleRender();
    });
  }

  function initInputs() {
    ["#importe", "#interes", "#plazo", "#extraImporte", "#extraAnio"].forEach(function (sel) {
      var el = $(sel);
      if (el) el.addEventListener("input", scheduleRender);
    });
  }

  function initModoExtraSegmented() {
    var group = $("#extraModo");
    if (!group) return;
    group.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-modo]");
      if (!btn) return;
      modoExtra = btn.dataset.modo;
      Array.prototype.forEach.call(group.children, function (b) { b.classList.toggle("is-active", b === btn); });
      $("#extraModoNote").textContent = MODO_NOTES[modoExtra];
      scheduleRender();
    });
  }

  function prefillFromQuery() {
    var q = new URLSearchParams(location.search);
    var map = { importe: "#importe", interes: "#interes", plazo: "#plazo" };
    Object.keys(map).forEach(function (key) {
      var v = q.get(key);
      var el = $(map[key]);
      if (v !== null && el) el.value = v;
    });
  }

  function boot() {
    safe(initTipoSegmented, "initTipoSegmented");
    safe(initModoExtraSegmented, "initModoExtraSegmented");
    safe(initInputs, "initInputs");
    safe(prefillFromQuery, "prefillFromQuery");
    render();
    window.addEventListener("resize", function () { clearTimeout(renderTimer); renderTimer = setTimeout(render, 150); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
