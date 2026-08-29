(function () {
  "use strict";
  const A = window.__APP__ || {};
  const S = window.__SHELL__ || {};
  const $ = A.$, $$ = A.$$, safe = A.safe, toast = A.toast, apiCall = A.apiCall, escHTML = A.escHTML;
  const brand = window.__BRAND__ || {};

  const MAX_BYTES = 20 * 1024 * 1024;
  const MAX_PAGINAS = 60;

  let usuarioActual = null;
  let checkout = null;
  let pdfjsLibRef = null;
  let tessWorker = null;
  let pdfDoc = null;
  let fileName = "";
  let pages = [];               // { pageNum, chunks, width, height, isScan, detecciones:[], fallo }
  let pagesProcessedCount = 0;
  let currentPageIndex = 0;
  let manualMode = false;
  let pendingFile = null;
  let detIdCounter = 0;

  // ---------- helpers ----------
  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function tipoLabel(tipo) {
    if (tipo === "manual") return "Zona manual";
    const t = (brand.tipos || []).find(x => x.id === tipo);
    return t ? t.label : tipo;
  }
  function setState(state) {
    $("#toolCard").setAttribute("data-tool-state", state);
  }
  function progressLabel(txt) { const el = $("#progressLabel"); if (el) el.textContent = txt; }
  function progressPct(p) { const el = $("#progressFill"); if (el) el.style.width = Math.max(0, Math.min(100, p)) + "%"; }
  function showError(msg) {
    $("#toolErrorMsg").textContent = msg;
    setState("error");
  }

  // ---------- pdf.js / tesseract lazy loading ----------
  // pdf.js 6.1.200 calls Map.prototype.getOrInsertComputed(), a very recent
  // JS proposal not yet available on every browser (confirmed missing even on
  // current-generation Chromium during testing) — without this it throws
  // inside PDFPageProxy.render() and every page fails to draw.
  function polyfillMapUpsert() {
    if (typeof Map.prototype.getOrInsertComputed !== "function") {
      Map.prototype.getOrInsertComputed = function (key, fn) {
        if (this.has(key)) return this.get(key);
        const v = fn(key);
        this.set(key, v);
        return v;
      };
    }
    if (typeof Map.prototype.getOrInsert !== "function") {
      Map.prototype.getOrInsert = function (key, value) {
        if (this.has(key)) return this.get(key);
        this.set(key, value);
        return value;
      };
    }
  }

  async function loadPdfJs() {
    if (pdfjsLibRef) return pdfjsLibRef;
    safe(polyfillMapUpsert, "polyfillMapUpsert");
    const mod = await import("./lib/vendor/pdfjs/pdf.min.mjs");
    mod.GlobalWorkerOptions.workerSrc = "lib/vendor/pdfjs/pdf.worker.min.mjs";
    pdfjsLibRef = mod;
    return mod;
  }
  async function getTessWorker() {
    if (tessWorker) return tessWorker;
    progressLabel("Cargando el reconocimiento de texto para escaneos (solo la primera vez)…");
    const origin = window.location.origin;
    tessWorker = await window.Tesseract.createWorker("spa", 1, {
      workerPath: origin + "/lib/vendor/tesseract/worker.min.js",
      corePath: origin + "/lib/vendor/tesseract/tesseract-core-simd.wasm.js",
      langPath: origin + "/lib/vendor/tesseract/lang/",
      gzip: true,
      workerBlobURL: false
    });
    return tessWorker;
  }

  // ---------- text + position extraction ----------
  async function extractDigitalPageData(page, pdfjsLib) {
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const chunks = [];
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) {
        if (item.hasEOL && chunks.length) chunks[chunks.length - 1].hasEOL = true;
        continue;
      }
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontH = Math.hypot(tx[2], tx[3]) || 1;
      // item.width from pdf.js getTextContent() is already in final page-pixel
      // space (viewport scale 1) — multiplying it by the transform's own font
      // scale again (as an earlier version of this code did) inflates box
      // widths by roughly the font size, badly overshooting every detection box.
      const width = (item.width || 0);
      const x0 = tx[4], y1 = tx[5], y0 = y1 - fontH, x1 = x0 + width;
      chunks.push({
        str: item.str,
        x0: x0 / viewport.width, y0: y0 / viewport.height,
        x1: x1 / viewport.width, y1: y1 / viewport.height,
        hasEOL: !!item.hasEOL
      });
    }
    return { chunks, width: viewport.width, height: viewport.height };
  }

  async function ocrPageData(page) {
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport, intent: "print" }).promise;
    const worker = await getTessWorker();
    const { data } = await worker.recognize(canvas);
    const chunks = [];
    (data.lines || []).forEach(line => {
      (line.words || []).forEach(w => {
        if (!w.text || !w.text.trim()) return;
        chunks.push({
          str: w.text,
          x0: w.bbox.x0 / canvas.width, y0: w.bbox.y0 / canvas.height,
          x1: w.bbox.x1 / canvas.width, y1: w.bbox.y1 / canvas.height,
          hasEOL: false
        });
      });
      if (chunks.length) chunks[chunks.length - 1].hasEOL = true;
    });
    return { chunks, width: canvas.width, height: canvas.height };
  }

  function reconstructText(chunks) {
    let out = "";
    chunks.forEach(c => { out += c.str + (c.hasEOL ? "\n" : " "); });
    return out.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  }

  function buildFlatIndex(chunks) {
    let flat = ""; const map = [];
    chunks.forEach((c, i) => {
      const t = normalize(c.str);
      for (const ch of t) { flat += ch; map.push(i); }
      flat += " "; map.push(-1);
    });
    return { flat, map };
  }

  function findOccurrences(flatIndex, chunks, texto) {
    const needle = normalize(texto);
    if (!needle) return [];
    const { flat, map } = flatIndex;
    const out = []; let from = 0; let idx;
    while ((idx = flat.indexOf(needle, from)) !== -1) {
      const set = new Set();
      for (let k = idx; k < idx + needle.length; k++) { const ci = map[k]; if (ci >= 0) set.add(ci); }
      if (set.size) {
        out.push(Array.from(set).sort((a, b) => a - b).map(ci => ({
          x0: chunks[ci].x0, y0: chunks[ci].y0, x1: chunks[ci].x1, y1: chunks[ci].y1
        })));
      }
      from = idx + Math.max(needle.length, 1);
    }
    return out;
  }

  function buildDetection(tipo, texto, occurrences, pagina) {
    const cajas = [].concat(...occurrences);
    detIdCounter++;
    return {
      id: "d" + detIdCounter, tipo, texto, cajas,
      activo: cajas.length > 0, encontrada: cajas.length > 0, manual: false, pagina
    };
  }

  // ---------- workspace rendering ----------
  function totalDetections() { return pages.reduce((a, p) => a + p.detecciones.length, 0); }

  function renderDetList() {
    const host = $("#detList");
    const dets = pages[currentPageIndex] ? pages[currentPageIndex].detecciones : [];
    $("#detCount").textContent = totalDetections();
    if (!dets.length) {
      host.innerHTML = '<div class="det-empty">No se han detectado datos personales en esta página.</div>';
      return;
    }
    host.innerHTML = dets.map(d => `
      <div class="det-item ${!d.activo ? "is-inactive" : ""} ${!d.encontrada ? "is-missing" : ""}">
        <button type="button" class="det-toggle ${d.activo ? "is-on" : ""}" data-toggle="${d.id}" aria-label="Activar o desactivar tapado"></button>
        <div class="det-body">
          <div class="det-type">${escHTML(tipoLabel(d.tipo))}</div>
          <div class="det-text">${escHTML(d.texto)}</div>
          <div class="det-meta">${d.manual ? "Añadida a mano" : d.encontrada ? (d.cajas.length + " aparición" + (d.cajas.length === 1 ? "" : "es") + " en la página") : "No localizada automáticamente — colócala a mano"}</div>
        </div>
        ${d.manual ? `<button type="button" class="det-del" data-del="${d.id}" aria-label="Eliminar zona">✕</button>` : ""}
      </div>
    `).join("");
    $$("[data-toggle]", host).forEach(b => b.addEventListener("click", () => {
      const d = dets.find(x => x.id === b.getAttribute("data-toggle"));
      if (!d) return;
      d.activo = !d.activo;
      renderDetList(); renderOverlay();
    }));
    $$("[data-del]", host).forEach(b => b.addEventListener("click", () => {
      const idx = dets.findIndex(x => x.id === b.getAttribute("data-del"));
      if (idx >= 0) { dets.splice(idx, 1); renderDetList(); renderOverlay(); }
    }));
  }

  function renderOverlay() {
    const host = $("#boxOverlay");
    host.innerHTML = "";
    const p = pages[currentPageIndex];
    if (!p) return;
    p.detecciones.forEach(d => {
      d.cajas.forEach(c => {
        const div = document.createElement("div");
        div.className = "det-box" + (d.activo ? "" : " is-off") + (d.manual ? " is-manual" : "");
        div.style.left = (c.x0 * 100) + "%";
        div.style.top = (c.y0 * 100) + "%";
        div.style.width = Math.max(0, (c.x1 - c.x0) * 100) + "%";
        div.style.height = Math.max(0, (c.y1 - c.y0) * 100) + "%";
        host.appendChild(div);
      });
    });
  }

  async function renderPageView() {
    const idx = currentPageIndex;
    const page = await pdfDoc.getPage(idx + 1);
    const base = page.getViewport({ scale: 1 });
    const wrap = document.querySelector(".canvas-wrap");
    const targetW = Math.min(780, (wrap ? wrap.clientWidth - 30 : 760));
    const scale = Math.max(0.5, Math.min(2.4, targetW / base.width));
    const viewport = page.getViewport({ scale });
    const canvas = $("#pageCanvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport, intent: "print" }).promise;
    $("#pageLabel").textContent = "Página " + (idx + 1) + " / " + pagesProcessedCount;
    $("#scanBadge").style.display = (pages[idx] && pages[idx].isScan) ? "inline-flex" : "none";
    $("#pagePrev").disabled = idx <= 0;
    $("#pageNext").disabled = idx >= pagesProcessedCount - 1;
    renderOverlay();
    renderDetList();
  }

  function resetWorkspace() {
    pdfDoc = null; pages = []; pagesProcessedCount = 0; currentPageIndex = 0; fileName = "";
    manualMode = false;
    const mb = $("#btnManualBox"); if (mb) mb.classList.remove("btn-primary");
    $("#manualHint").textContent = "";
  }

  // ---------- upgrade / checkout ----------
  function renderUpgradePlans() {
    const host = $("#upgradePlans");
    const disponibles = brand.planes.filter(p => p.id !== "gratis");
    host.innerHTML = disponibles.map(p => `
      <div class="plan-mini">
        <strong>${escHTML(p.nombre)}</strong>
        <span>${p.precio}€/mes · ${p.creditos} créditos</span>
        <button type="button" class="btn btn-primary btn-sm" style="margin-top:10px;width:100%" data-upgrade-plan="${p.id}">Elegir</button>
      </div>
    `).join("");
    $$("[data-upgrade-plan]", host).forEach(b => b.addEventListener("click", () => {
      closeUpgrade();
      checkout.open(b.getAttribute("data-upgrade-plan"));
    }));
  }
  function openUpgrade(msg) {
    $("#upgradeMsg").textContent = msg;
    renderUpgradePlans();
    $("#modalUpgrade").classList.add("is-open");
  }
  function closeUpgrade() { $("#modalUpgrade").classList.remove("is-open"); }

  function onCheckoutConfirmed(usuario) {
    usuarioActual = usuario;
    if (pendingFile) {
      const f = pendingFile; pendingFile = null;
      toast("Créditos recargados. Retomando el documento…", "ok");
      processDocument(f);
    }
  }

  // ---------- main pipeline ----------
  async function processDocument(file) {
    resetWorkspace();
    setState("working");
    progressLabel("Leyendo el documento…");
    progressPct(4);

    let arrayBuffer;
    try { arrayBuffer = await file.arrayBuffer(); }
    catch (e) { showError("No se ha podido leer el archivo."); return; }

    let pdfjsLib, doc;
    try {
      pdfjsLib = await loadPdfJs();
      doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (e) {
      showError("El archivo no parece un PDF válido o está dañado.");
      return;
    }

    const numPages = doc.numPages;
    if (numPages > MAX_PAGINAS) {
      showError("Este documento tiene " + numPages + " páginas. Por ahora el máximo por documento es " + MAX_PAGINAS + ".");
      return;
    }

    const yo = await apiCall("yo", {});
    if (!yo.ok || !yo.usuario) { window.location.href = "login.html"; return; }
    usuarioActual = yo.usuario;
    S.initShell(usuarioActual);

    if (usuarioActual.creditos < numPages) {
      pendingFile = file;
      setState("idle");
      openUpgrade("Este documento tiene " + numPages + " página" + (numPages === 1 ? "" : "s") + " y solo te quedan " + usuarioActual.creditos + " crédito" + (usuarioActual.creditos === 1 ? "" : "s") + ".");
      return;
    }

    pdfDoc = doc; fileName = file.name; pages = []; currentPageIndex = 0;
    let huboFallo = false;
    let procesadas = 0;

    for (let i = 1; i <= numPages; i++) {
      progressLabel("Analizando página " + i + " de " + numPages + "…");
      progressPct(4 + Math.round(((i - 1) / numPages) * 92));

      const page = await pdfDoc.getPage(i);
      let extracted = await extractDigitalPageData(page, pdfjsLib);
      let isScan = false;
      const charCount = extracted.chunks.reduce((a, c) => a + c.str.length, 0);
      if (charCount < 12 || extracted.chunks.length < 2) {
        isScan = true;
        try { extracted = await ocrPageData(page); }
        catch (e) { extracted = { chunks: [], width: 1, height: 1 }; }
      }

      const pageEntry = { pageNum: i, chunks: extracted.chunks, width: extracted.width, height: extracted.height, isScan, detecciones: [], fallo: false };
      pages.push(pageEntry);

      const texto = reconstructText(extracted.chunks);
      if (texto.trim().length >= 3) {
        let r = await apiCall("usar", { texto, pagina: i });
        if (!r.ok && r.status !== 402) r = await apiCall("usar", { texto, pagina: i });

        if (r.status === 402) {
          procesadas = i - 1;
          openUpgrade("Se han censurado " + procesadas + " de " + numPages + " páginas. Te has quedado sin créditos para continuar con el resto.");
          break;
        }
        if (!r.ok) {
          huboFallo = true; pageEntry.fallo = true;
        } else {
          const flatIndex = buildFlatIndex(extracted.chunks);
          (r.detecciones || []).forEach(d => {
            const occ = findOccurrences(flatIndex, extracted.chunks, d.texto);
            pageEntry.detecciones.push(buildDetection(d.tipo, d.texto, occ, i - 1));
          });
          usuarioActual.creditos = Math.max(0, usuarioActual.creditos - 1);
          S.updateCredits(usuarioActual);
        }
      }
      procesadas = i;
    }

    pagesProcessedCount = procesadas || 1;
    currentPageIndex = 0;
    setState("done");
    progressPct(100);
    await renderPageView();
    if (huboFallo) toast("Alguna página no se ha podido analizar automáticamente. Revísala y usa la caja manual si hace falta.", "err");
  }

  // ---------- export ----------
  async function handleDescargar() {
    if (!pdfDoc || !pagesProcessedCount) return;
    const btn = $("#btnDescargar");
    const original = btn.textContent;
    btn.disabled = true; btn.textContent = "Generando PDF censurado…";
    try {
      const jspdf = window.jspdf;
      if (!jspdf) throw new Error("jsPDF no disponible");
      let doc = null;
      for (let i = 0; i < pagesProcessedCount; i++) {
        const pageProxy = await pdfDoc.getPage(i + 1);
        const base = pageProxy.getViewport({ scale: 1 });
        const scale = Math.min(3, 1700 / base.width);
        const viewport = pageProxy.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        await pageProxy.render({ canvas, viewport, intent: "print" }).promise;

        ctx.fillStyle = "#0a0a0a";
        (pages[i].detecciones || []).filter(d => d.activo).forEach(d => {
          d.cajas.forEach(c => {
            const x = c.x0 * canvas.width, y = c.y0 * canvas.height;
            const w = Math.max(0, (c.x1 - c.x0) * canvas.width), h = Math.max(0, (c.y1 - c.y0) * canvas.height);
            ctx.fillRect(x, y, w, h);
          });
        });

        const dataUrl = canvas.toDataURL("image/jpeg", 0.93);
        if (!doc) {
          doc = new jspdf.jsPDF({ unit: "px", format: [canvas.width, canvas.height], compress: true });
          doc.addImage(dataUrl, "JPEG", 0, 0, canvas.width, canvas.height);
        } else {
          doc.addPage([canvas.width, canvas.height]);
          doc.addImage(dataUrl, "JPEG", 0, 0, canvas.width, canvas.height);
        }
      }
      const base = (fileName || "documento").replace(/\.pdf$/i, "");
      doc.save(base + "-censurado.pdf");
      toast("PDF censurado descargado. El texto tapado ya no existe en el archivo.", "ok");
    } catch (e) {
      console.warn(e);
      toast("No se ha podido generar el PDF censurado. Inténtalo de nuevo.", "err");
    } finally {
      btn.disabled = false; btn.textContent = original;
    }
  }

  // ---------- manual box drawing ----------
  function initManualBox() {
    const btn = $("#btnManualBox");
    const overlay = $("#boxOverlay");
    const hint = $("#manualHint");
    if (!btn || !overlay) return;

    btn.addEventListener("click", () => {
      manualMode = !manualMode;
      btn.classList.toggle("btn-primary", manualMode);
      overlay.style.pointerEvents = manualMode ? "auto" : "none";
      overlay.style.cursor = manualMode ? "crosshair" : "";
      hint.textContent = manualMode ? "Haz clic y arrastra sobre el documento para tapar una zona." : "";
    });

    let drawing = null;
    overlay.addEventListener("pointerdown", (e) => {
      if (!manualMode || !pages[currentPageIndex]) return;
      const rect = overlay.getBoundingClientRect();
      overlay.setPointerCapture(e.pointerId);
      const box = document.createElement("div");
      box.className = "det-box is-manual";
      overlay.appendChild(box);
      drawing = { startX: e.clientX - rect.left, startY: e.clientY - rect.top, rect, el: box };
      e.preventDefault();
    });
    overlay.addEventListener("pointermove", (e) => {
      if (!drawing) return;
      const rect = drawing.rect;
      const curX = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
      const curY = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
      const x0 = Math.min(drawing.startX, curX), x1 = Math.max(drawing.startX, curX);
      const y0 = Math.min(drawing.startY, curY), y1 = Math.max(drawing.startY, curY);
      drawing.el.style.left = (x0 / rect.width * 100) + "%";
      drawing.el.style.top = (y0 / rect.height * 100) + "%";
      drawing.el.style.width = ((x1 - x0) / rect.width * 100) + "%";
      drawing.el.style.height = ((y1 - y0) / rect.height * 100) + "%";
      drawing.last = { x0, y0, x1, y1 };
    });
    function finishDraw(e) {
      if (!drawing) return;
      const rect = drawing.rect;
      const last = drawing.last;
      drawing.el.remove();
      drawing = null;
      if (!last || (last.x1 - last.x0) < 6 || (last.y1 - last.y0) < 6) return;
      const p = pages[currentPageIndex];
      detIdCounter++;
      p.detecciones.push({
        id: "m" + detIdCounter, tipo: "manual", texto: "Zona marcada a mano",
        cajas: [{ x0: last.x0 / rect.width, y0: last.y0 / rect.height, x1: last.x1 / rect.width, y1: last.y1 / rect.height }],
        activo: true, encontrada: true, manual: true, pagina: currentPageIndex
      });
      manualMode = false;
      $("#btnManualBox").classList.remove("btn-primary");
      overlay.style.pointerEvents = "none"; overlay.style.cursor = "";
      hint.textContent = "";
      renderOverlay(); renderDetList();
    }
    overlay.addEventListener("pointerup", finishDraw);
    overlay.addEventListener("pointercancel", finishDraw);
  }

  // ---------- dropzone / boot ----------
  function handleFile(file) {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) { toast("Solo se admiten archivos PDF.", "err"); return; }
    if (file.size > MAX_BYTES) { toast("El archivo supera el tamaño máximo permitido (20 MB).", "err"); return; }
    $("#dzFileName").textContent = file.name;
    processDocument(file);
  }

  function initDropzone() {
    const dz = $("#dropzone");
    const input = $("#fileInput");
    if (!dz || !input) return;
    dz.addEventListener("click", () => input.click());
    dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", () => handleFile(input.files[0]));
    ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("is-drag"); }));
    ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("is-drag"); }));
    dz.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; handleFile(f); });
  }

  function initWorkspaceActions() {
    const prev = $("#pagePrev"), next = $("#pageNext");
    if (prev) prev.addEventListener("click", () => { if (currentPageIndex > 0) { currentPageIndex--; safe(renderPageView, "renderPageView"); } });
    if (next) next.addEventListener("click", () => { if (currentPageIndex < pagesProcessedCount - 1) { currentPageIndex++; safe(renderPageView, "renderPageView"); } });
    const btnNuevo = $("#btnNuevo");
    if (btnNuevo) btnNuevo.addEventListener("click", () => { $("#fileInput").value = ""; $("#dzFileName").textContent = ""; resetWorkspace(); setState("idle"); });
    const btnRetry = $("#btnRetry");
    if (btnRetry) btnRetry.addEventListener("click", () => { $("#fileInput").value = ""; setState("idle"); });
    const btnDescargar = $("#btnDescargar");
    if (btnDescargar) btnDescargar.addEventListener("click", handleDescargar);
    const btnCloseUpgrade = $("#btnCloseUpgrade");
    if (btnCloseUpgrade) btnCloseUpgrade.addEventListener("click", closeUpgrade);
    const modalUpgrade = $("#modalUpgrade");
    if (modalUpgrade) modalUpgrade.addEventListener("click", (e) => { if (e.target === modalUpgrade) closeUpgrade(); });
  }

  async function boot() {
    checkout = S.initCheckoutModal({ onConfirmed: onCheckoutConfirmed });
    const usuario = await A.requireSession("login.html");
    if (!usuario) return;
    usuarioActual = usuario;
    S.initShell(usuario);
    safe(initDropzone, "initDropzone");
    safe(initWorkspaceActions, "initWorkspaceActions");
    safe(initManualBox, "initManualBox");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
