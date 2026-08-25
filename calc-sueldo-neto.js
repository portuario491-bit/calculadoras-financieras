(function () {
  "use strict";
  var C = window.__CALC__;
  if (!C) return;
  var $ = C.$, safe = C.safe, num = C.num, clamp = C.clamp;

  // -------------------------------------------------------------------------
  // DATOS APROXIMADOS — año de referencia 2026.
  // <!-- TODO: revisar tramos IRPF, mínimos y tipos de cotización cada año -->
  // Tramos combinados (estatal + autonómico), a modo de escala general de
  // referencia. El ajuste por comunidad autónoma es orientativo, no la tabla
  // oficial exacta de cada comunidad (que además cambia con frecuencia).
  // -------------------------------------------------------------------------
  var IRPF_BRACKETS = [
    { hasta: 12450, tipo: 0.19 },
    { hasta: 20200, tipo: 0.24 },
    { hasta: 35200, tipo: 0.30 },
    { hasta: 60000, tipo: 0.37 },
    { hasta: 300000, tipo: 0.45 },
    { hasta: Infinity, tipo: 0.47 }
  ];

  var CCAA_ADJUST = { // multiplicador orientativo sobre el IRPF calculado con la escala general
    madrid: 0.93,
    cataluna: 1.05,
    andalucia: 0.98,
    valencia: 1.02,
    galicia: 0.97,
    castillayleon: 0.97,
    otras: 1.00
  };

  var SS_RATE_TRABAJADOR = 0.0635; // contingencias comunes + desempleo + FP (aprox.)
  var SS_BASE_MAX_ANUAL = 56646;   // aprox. 12 × base máxima mensual de cotización
  var GASTOS_DEDUCIBLES = 2000;    // reducción estándar por rendimientos del trabajo

  var MINIMO_PERSONAL_SOLTERO = 5550;
  var MINIMO_CONYUGE_ADICIONAL = 3400; // aplicado si "casado"
  var MINIMO_HIJOS = [0, 2400, 2700, 4000]; // índice = nº de hijos (3 = "3 o más")

  function progressiveTax(base) {
    if (base <= 0) return 0;
    var tax = 0, prevLimit = 0;
    for (var i = 0; i < IRPF_BRACKETS.length; i++) {
      var b = IRPF_BRACKETS[i];
      var top = Math.min(base, b.hasta);
      if (top > prevLimit) tax += (top - prevLimit) * b.tipo;
      prevLimit = b.hasta;
      if (base <= b.hasta) break;
    }
    return tax;
  }

  function compute(bruto, situacion, numHijos, comunidad) {
    var ss = Math.min(bruto, SS_BASE_MAX_ANUAL) * SS_RATE_TRABAJADOR;
    var baseImponible = Math.max(0, bruto - ss - GASTOS_DEDUCIBLES);

    var minimo = MINIMO_PERSONAL_SOLTERO;
    if (situacion === "casado") minimo += MINIMO_CONYUGE_ADICIONAL;
    minimo += MINIMO_HIJOS[Math.min(numHijos, 3)];

    var baseLiquidable = Math.max(0, baseImponible - minimo);
    var irpfBase = progressiveTax(baseLiquidable);
    var adjust = CCAA_ADJUST[comunidad] != null ? CCAA_ADJUST[comunidad] : 1;
    var irpf = irpfBase * adjust;

    var netoAnual = bruto - ss - irpf;
    var netoMensual = netoAnual / 12;
    var tipoIrpfEfectivo = bruto > 0 ? (irpf / bruto) * 100 : 0;

    return { ss: ss, irpf: irpf, netoAnual: netoAnual, netoMensual: netoMensual, tipoIrpfEfectivo: tipoIrpfEfectivo };
  }

  var situacion = "soltero";

  function render() {
    var bruto = clamp(num($("#salarioBruto"), 28000), 1000, 500000);
    var numHijos = clamp(parseInt($("#numHijos").value, 10) || 0, 0, 3);
    var comunidad = $("#comunidad").value;

    var rawBruto = num($("#salarioBruto"), NaN);
    var invalid = !(rawBruto > 0);
    $("#errorMsg").classList.toggle("is-visible", invalid);

    var res = compute(bruto, situacion, numHijos, comunidad);

    $("#outNetoMensual").textContent = C.fmtEUR.format(res.netoMensual);
    $("#outNetoAnual").textContent = C.fmtEUR.format(res.netoAnual);
    $("#outIrpf").textContent = C.fmtPct.format(res.tipoIrpfEfectivo) + " % (" + C.fmtEUR.format(res.irpf) + ")";
    $("#outSS").textContent = C.fmtEUR.format(res.ss);

    if (userInteracted && window.__ADS__) window.__ADS__.showResultDialogOnce("sueldo-neto");
  }

  var renderTimer = null;
  var userInteracted = false;
  function scheduleRender() { userInteracted = true; clearTimeout(renderTimer); renderTimer = setTimeout(render, 90); }

  function initSituacion() {
    var group = $("#situacionPersonal");
    if (!group) return;
    group.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-situacion]");
      if (!btn) return;
      situacion = btn.dataset.situacion;
      Array.prototype.forEach.call(group.children, function (b) { b.classList.toggle("is-active", b === btn); });
      scheduleRender();
    });
  }

  function prefillFromQuery() {
    var q = new URLSearchParams(location.search);
    var bruto = q.get("bruto");
    if (bruto !== null) { var el = $("#salarioBruto"); if (el) el.value = bruto; }
    var hijos = q.get("hijos");
    if (hijos !== null) { var elH = $("#numHijos"); if (elH) elH.value = hijos; }
    var comunidad = q.get("comunidad");
    if (comunidad !== null) { var elC = $("#comunidad"); if (elC) elC.value = comunidad; }
    var sit = q.get("situacion");
    if (sit === "soltero" || sit === "casado") {
      situacion = sit;
      var group = $("#situacionPersonal");
      if (group) {
        Array.prototype.forEach.call(group.children, function (b) {
          b.classList.toggle("is-active", b.dataset.situacion === sit);
        });
      }
    }
  }

  function boot() {
    safe(initSituacion, "initSituacion");
    ["#salarioBruto", "#numHijos", "#comunidad"].forEach(function (sel) {
      var el = $(sel);
      if (el) el.addEventListener("input", scheduleRender);
    });
    safe(prefillFromQuery, "prefillFromQuery");
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
