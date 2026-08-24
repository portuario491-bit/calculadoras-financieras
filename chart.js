(function () {
  "use strict";

  // Minimal hand-rolled line/area chart, no dependencies. Draws N series of
  // {x, y} points sharing one x-domain, with gridlines, axis labels and an
  // optional shaded fill for the first two series (used as an "interest
  // generated" gap between total value and cumulative contributions).
  function drawLineChart(canvas, series, opts) {
    opts = opts || {};
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cssW = canvas.clientWidth || 320, cssH = canvas.clientHeight || 220;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var padL = opts.padL != null ? opts.padL : 46;
    var padR = 10, padT = 14, padB = 26;
    var w = cssW - padL - padR, h = cssH - padT - padB;

    var allPoints = series.reduce(function (acc, s) { return acc.concat(s.points); }, []);
    if (!allPoints.length) return;
    var xMin = Math.min.apply(null, allPoints.map(function (p) { return p.x; }));
    var xMax = Math.max.apply(null, allPoints.map(function (p) { return p.x; }));
    var yMin = 0;
    var yMax = Math.max.apply(null, allPoints.map(function (p) { return p.y; })) * 1.08 || 1;
    if (xMax === xMin) xMax = xMin + 1;

    function px(x) { return padL + (x - xMin) / (xMax - xMin) * w; }
    function py(y) { return padT + h - (y - yMin) / (yMax - yMin) * h; }

    // gridlines + y labels
    ctx.strokeStyle = "#dde3e1";
    ctx.fillStyle = "#5c6b68";
    ctx.font = "11px Inter, sans-serif";
    ctx.lineWidth = 1;
    var steps = 4;
    for (var i = 0; i <= steps; i++) {
      var yVal = yMin + (yMax - yMin) * (i / steps);
      var yPix = py(yVal);
      ctx.beginPath();
      ctx.moveTo(padL, yPix);
      ctx.lineTo(padL + w, yPix);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(opts.formatY ? opts.formatY(yVal) : String(Math.round(yVal)), padL - 8, yPix);
    }

    // x labels (first, mid, last) — align the edge ticks inward so the text
    // never runs past the canvas bounds (a centered label on the last tick
    // would otherwise get clipped on the right).
    ctx.textBaseline = "top";
    var xTicks = opts.xTicks || [xMin, Math.round((xMin + xMax) / 2), xMax];
    xTicks.forEach(function (xv, idx) {
      ctx.textAlign = idx === 0 ? "left" : (idx === xTicks.length - 1 ? "right" : "center");
      ctx.fillText(opts.formatX ? opts.formatX(xv) : String(xv), px(xv), padT + h + 8);
    });

    // optional shaded gap between series[0] (higher) and series[1] (lower)
    if (opts.shadeBetween && series.length >= 2) {
      var top = series[0].points, bot = series[1].points;
      ctx.beginPath();
      top.forEach(function (p, idx) { var fn = idx === 0 ? "moveTo" : "lineTo"; ctx[fn](px(p.x), py(p.y)); });
      for (var k = bot.length - 1; k >= 0; k--) ctx.lineTo(px(bot[k].x), py(bot[k].y));
      ctx.closePath();
      ctx.fillStyle = opts.shadeColor || "rgba(15,107,92,0.12)";
      ctx.fill();
    }

    // series lines
    series.forEach(function (s) {
      ctx.beginPath();
      s.points.forEach(function (p, idx) {
        var fn = idx === 0 ? "moveTo" : "lineTo";
        ctx[fn](px(p.x), py(p.y));
      });
      ctx.strokeStyle = s.color || "#0f6b5c";
      ctx.lineWidth = 2.4;
      ctx.lineJoin = "round";
      ctx.stroke();
    });

    // axis baseline
    ctx.strokeStyle = "#b9c2c0";
    ctx.beginPath();
    ctx.moveTo(padL, padT + h);
    ctx.lineTo(padL + w, padT + h);
    ctx.stroke();
  }

  // Simple stacked bar chart per period (used for mortgage principal-vs-interest split).
  function drawStackedBars(canvas, bars, opts) {
    opts = opts || {};
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cssW = canvas.clientWidth || 320, cssH = canvas.clientHeight || 220;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var padL = 46, padR = 10, padT = 14, padB = 26;
    var w = cssW - padL - padR, h = cssH - padT - padB;
    var maxTotal = Math.max.apply(null, bars.map(function (b) { return b.a + b.b; })) * 1.08 || 1;

    ctx.strokeStyle = "#dde3e1"; ctx.fillStyle = "#5c6b68"; ctx.font = "11px Inter, sans-serif";
    var steps = 4;
    for (var i = 0; i <= steps; i++) {
      var yVal = maxTotal * (i / steps);
      var yPix = padT + h - (yVal / maxTotal) * h;
      ctx.beginPath(); ctx.moveTo(padL, yPix); ctx.lineTo(padL + w, yPix); ctx.stroke();
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(opts.formatY ? opts.formatY(yVal) : String(Math.round(yVal)), padL - 8, yPix);
    }

    var n = bars.length;
    var slot = w / n;
    var barW = Math.min(28, slot * 0.6);
    bars.forEach(function (b, idx) {
      var cx = padL + slot * (idx + 0.5);
      var hA = (b.a / maxTotal) * h, hB = (b.b / maxTotal) * h;
      var yBase = padT + h;
      ctx.fillStyle = opts.colorA || "#0f6b5c";
      ctx.fillRect(cx - barW / 2, yBase - hA, barW, hA);
      ctx.fillStyle = opts.colorB || "#c17a1f";
      ctx.fillRect(cx - barW / 2, yBase - hA - hB, barW, hB);
    });

    ctx.fillStyle = "#5c6b68"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    var labelEvery = Math.max(1, Math.ceil(n / 8));
    bars.forEach(function (b, idx) {
      if (idx % labelEvery !== 0 && idx !== n - 1) return;
      var cx = padL + slot * (idx + 0.5);
      ctx.fillText(b.label, cx, padT + h + 8);
    });

    ctx.strokeStyle = "#b9c2c0";
    ctx.beginPath(); ctx.moveTo(padL, padT + h); ctx.lineTo(padL + w, padT + h); ctx.stroke();
  }

  window.__CHART__ = { drawLineChart: drawLineChart, drawStackedBars: drawStackedBars };
})();
