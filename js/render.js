/* =========================================================
   Canvas 视觉渲染（可爱圆形奶油蛋糕版）
   - 工业质检流水线
   - 蛋糕、候选斑点、质检灯、放大镜、HUD
   - 斑点的“霉变程度”由潜在证据 s 决定
   ========================================================= */
(function (NS) {
  'use strict';

  var M = NS.math;
  var BASE_W = 960;
  var BASE_H = 540;

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function mixColor(a, b, t) {
    return [
      Math.round(mix(a[0], b[0], t)),
      Math.round(mix(a[1], b[1], t)),
      Math.round(mix(a[2], b[2], t))
    ];
  }

  function rgba(color, alpha) {
    return 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + alpha + ')';
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function prepare(canvas) {
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(480, Math.round(rect.width || BASE_W));
    var height = Math.round(width * BASE_H / BASE_W);
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = height + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas._dims = { ctx: ctx, w: width, h: height, dpr: dpr };
    return canvas._dims;
  }

  function drawBackground(ctx, w, h, time) {
    ctx.fillStyle = '#0f1720';
    ctx.fillRect(0, 0, w, h);

    /* 工厂地面网格 */
    ctx.save();
    ctx.strokeStyle = 'rgba(120, 145, 165, 0.07)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx < w; gx += 48) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (var gy = 0; gy < h; gy += 48) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawConveyor(ctx, w, h, time, scale) {
    var beltTop = h * 0.70;
    var beltHeight = h * 0.30;

    /* 支撑架 */
    ctx.fillStyle = '#101820';
    ctx.fillRect(0, beltTop - 16 * scale, w, 16 * scale);

    /* 传送带主体 */
    var gradient = ctx.createLinearGradient(0, beltTop, 0, h);
    gradient.addColorStop(0, '#263541');
    gradient.addColorStop(1, '#17222d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, beltTop, w, beltHeight);

    /* 移动的防滑条纹 */
    var stripeWidth = 42 * scale;
    var offset = (time * 0.06) % stripeWidth;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, beltTop, w, beltHeight);
    ctx.clip();
    ctx.strokeStyle = 'rgba(150, 175, 195, 0.13)';
    ctx.lineWidth = 6 * scale;
    for (var x = -stripeWidth; x < w + stripeWidth; x += stripeWidth) {
      ctx.beginPath();
      ctx.moveTo(x - offset, beltTop + 12 * scale);
      ctx.lineTo(x - offset + 26 * scale, h - 10 * scale);
      ctx.stroke();
    }
    ctx.restore();

    /* 两侧导轨 */
    ctx.fillStyle = '#3b4c5c';
    ctx.fillRect(0, beltTop, w, 5 * scale);
    ctx.fillStyle = '#0b1117';
    ctx.fillRect(0, h - 10 * scale, w, 10 * scale);

    /* 导轨铆钉 */
    ctx.fillStyle = 'rgba(200, 215, 225, 0.18)';
    for (var rx = 20 * scale; rx < w; rx += 80 * scale) {
      ctx.beginPath();
      ctx.arc(rx, beltTop + 2.5 * scale, 2.4 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlate(ctx, cx, cy, radius) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#c9d3dc';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#eef2f5';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#aeb9c3';
    ctx.lineWidth = Math.max(1, radius * 0.012);
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.055, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawCake(ctx, cx, cy, radius) {
    /* 蛋糕胚 */
    var sponge = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
    sponge.addColorStop(0, '#f1d9b3');
    sponge.addColorStop(0.68, '#dfbc8b');
    sponge.addColorStop(1, '#c79b66');
    ctx.fillStyle = sponge;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    /* 蛋糕胚纹理 */
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(150, 105, 55, 0.18)';
    ctx.lineWidth = 1.2;
    for (var i = 0; i < 46; i++) {
      var angle = i * 2.399;
      var r = radius * (0.18 + (i % 7) * 0.11);
      var px = cx + Math.cos(angle) * r;
      var py = cy + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.arc(px, py, radius * (0.025 + (i % 3) * 0.01), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    /* 奶油层 */
    var cream = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.25, radius * 0.08, cx, cy, radius * 0.94);
    cream.addColorStop(0, '#fffaf0');
    cream.addColorStop(0.78, '#fff2da');
    cream.addColorStop(1, '#eedcc0');
    ctx.fillStyle = cream;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.92, 0, Math.PI * 2);
    ctx.fill();

    /* 奶油旋纹 */
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.92, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(214, 188, 146, 0.42)';
    ctx.lineWidth = Math.max(1.2, radius * 0.018);
    for (var s = 0; s < 5; s++) {
      ctx.beginPath();
      var sr = radius * (0.18 + s * 0.15);
      ctx.arc(cx, cy, sr, 0.2 + s * 0.4, Math.PI * 1.55 + s * 0.34);
      ctx.stroke();
    }
    ctx.restore();

    /* 边缘高光 */
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, radius * 0.012);
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.91, Math.PI * 1.05, Math.PI * 1.78);
    ctx.stroke();
  }

  function drawToppings(ctx, cx, cy, radius) {
    /* 固定装饰物，与试次类型无关 */
    var items = [
      { type: 'chip', angle: 0.45, dist: 0.62 },
      { type: 'berry', angle: 1.35, dist: 0.70 },
      { type: 'chip', angle: 2.35, dist: 0.58 },
      { type: 'crumb', angle: 3.15, dist: 0.72 },
      { type: 'berry', angle: 4.05, dist: 0.60 },
      { type: 'chip', angle: 5.05, dist: 0.68 },
      { type: 'crumb', angle: 5.75, dist: 0.56 }
    ];

    items.forEach(function (item) {
      var x = cx + Math.cos(item.angle) * radius * item.dist;
      var y = cy + Math.sin(item.angle) * radius * item.dist;

      if (item.type === 'chip') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(item.angle);
        ctx.fillStyle = '#5a3723';
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.055, radius * 0.035, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(-radius * 0.015, -radius * 0.01, radius * 0.022, radius * 0.012, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (item.type === 'berry') {
        ctx.fillStyle = '#a72d35';
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.052, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.arc(x - radius * 0.016, y - radius * 0.018, radius * 0.014, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(150, 105, 60, 0.75)';
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function roundCakeGeometry(w, h) {
    var scale = Math.min(w / BASE_W, h / BASE_H);
    var size = Math.min(w, h) * 0.72;
    var cx = w * 0.46;
    var cy = h * 0.54;
    var rx = size * 0.40;
    var ry = size * 0.125;
    var bodyHeight = size * 0.42;
    var topY = cy - bodyHeight * 0.52;
    var bottomY = topY + bodyHeight;
    return {
      scale: scale,
      size: size,
      cx: cx,
      cy: cy,
      rx: rx,
      ry: ry,
      bodyHeight: bodyHeight,
      topY: topY,
      bottomY: bottomY,
      bodyLeft: cx - rx * 0.94,
      bodyRight: cx + rx * 0.94,
      bodyTop: topY + ry * 0.15,
      bodyBottom: bottomY - ry * 0.05
    };
  }

  function drawShape(ctx, points, fillStyle, whiteWidth, darkWidth) {
    if (!points || !points.length) return;
    ctx.beginPath();
    points.forEach(function (point, index) {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (whiteWidth) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = whiteWidth;
      ctx.stroke();
    }
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (darkWidth) {
      ctx.strokeStyle = '#3a2a20';
      ctx.lineWidth = darkWidth;
      ctx.stroke();
    }
  }

  function drawEllipse(ctx, x, y, rx, ry, fillStyle, whiteWidth, darkWidth, rotation) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rotation || 0, 0, Math.PI * 2);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (whiteWidth) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = whiteWidth;
      ctx.stroke();
    }
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (darkWidth) {
      ctx.strokeStyle = '#3a2a20';
      ctx.lineWidth = darkWidth;
      ctx.stroke();
    }
  }

  function drawBody(ctx, geo, fillStyle, whiteWidth, darkWidth) {
    var rx = geo.rx * 0.94;
    var bottomRy = geo.ry * 0.95;
    ctx.beginPath();
    ctx.moveTo(geo.cx - rx, geo.topY);
    ctx.lineTo(geo.cx - rx, geo.bottomY - bottomRy * 0.35);
    ctx.quadraticCurveTo(geo.cx - rx, geo.bottomY, geo.cx, geo.bottomY);
    ctx.quadraticCurveTo(geo.cx + rx, geo.bottomY, geo.cx + rx, geo.bottomY - bottomRy * 0.35);
    ctx.lineTo(geo.cx + rx, geo.topY);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (whiteWidth) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = whiteWidth;
      ctx.stroke();
    }
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (darkWidth) {
      ctx.strokeStyle = '#3a2a20';
      ctx.lineWidth = darkWidth;
      ctx.stroke();
    }
  }

  function spotPoint(angle, radius, geo) {
    var factor = M.clamp(radius, 0.15, 0.85);
    var px = geo.cx + Math.cos(angle) * geo.rx * 0.52 * factor;
    var py = geo.bodyTop + geo.bodyHeight * (0.14 + 0.22 * ((Math.sin(angle) + 1) / 2) * factor);
    px = M.clamp(px, geo.cx - geo.rx * 0.68, geo.cx + geo.rx * 0.68);
    py = M.clamp(py, geo.bodyTop + geo.bodyHeight * 0.12, geo.bodyTop + geo.bodyHeight * 0.36);
    return { x: px, y: py };
  }

  function drawSliceLegacy(ctx, geo) {
    var s = geo.scale;
    var size = geo.size;
    var dark = Math.max(2, 3.2 * s);
    var white = Math.max(5, 9 * s);

    /* 阴影 */
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
    ctx.beginPath();
    ctx.ellipse(geo.cx + size * 0.02, geo.cy + size * 0.26, size * 0.42, size * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* 右侧饼干底 */
    drawShape(ctx, [geo.backTop, geo.backBottom, geo.frontBottom, geo.frontTop], '#8a5a2b', white, dark);
    drawShape(ctx, [
      geo.backTop,
      { x: geo.backTop.x + size * 0.015, y: geo.backTop.y + size * 0.02 },
      { x: geo.backBottom.x + size * 0.015, y: geo.backBottom.y - size * 0.01 },
      geo.backBottom
    ], '#b07a3f', 0, 0);

    /* 饼干碎屑纹理 */
    ctx.save();
    ctx.fillStyle = 'rgba(70, 42, 20, 0.55)';
    for (var i = 0; i < 28; i++) {
      var t = (i * 0.37) % 1;
      var px = geo.frontTop.x + (geo.backTop.x - geo.frontTop.x) * t + Math.sin(i * 2.1) * size * 0.012;
      var py = geo.frontTop.y + (geo.frontBottom.y - geo.frontTop.y) * t + Math.cos(i * 1.7) * size * 0.012;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.8, size * 0.006 * (0.6 + (i % 3) * 0.4)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* 顶层红色果酱 */
    drawShape(ctx, [geo.tip, geo.frontTop, geo.backTop, geo.backTip], '#c62828', white, dark);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = Math.max(1.5, size * 0.012);
    ctx.beginPath();
    ctx.ellipse(geo.cx + size * 0.02, geo.cy - size * 0.06, size * 0.20, size * 0.055, -0.12, 0, Math.PI * 1.65);
    ctx.stroke();
    ctx.restore();

    /* 芝士蛋糕正面 */
    var faceGradient = ctx.createLinearGradient(geo.tip.x, geo.cy - size * 0.12, geo.frontBottom.x, geo.frontBottom.y);
    faceGradient.addColorStop(0, '#fff3c9');
    faceGradient.addColorStop(0.55, '#f3e2ab');
    faceGradient.addColorStop(1, '#e2c98a');
    drawShape(ctx, [geo.tip, geo.frontTop, geo.frontBottom], faceGradient, white, dark);

    /* 正面高光与底部阴影 */
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = Math.max(1.4, size * 0.012);
    ctx.beginPath();
    ctx.moveTo(geo.tip.x + size * 0.10, geo.cy - size * 0.005);
    ctx.lineTo(geo.frontTop.x - size * 0.04, geo.cy - size * 0.115);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150, 110, 60, 0.25)';
    ctx.beginPath();
    ctx.moveTo(geo.tip.x + size * 0.06, geo.cy + size * 0.055);
    ctx.lineTo(geo.frontBottom.x - size * 0.04, geo.cy + size * 0.185);
    ctx.stroke();
    ctx.restore();

    /* 果酱滴落 */
    var dripFractions = [0.24, 0.46, 0.68];
    var dripLengths = [0.14, 0.19, 0.12];
    dripFractions.forEach(function (t, index) {
      var startX = geo.tip.x + (geo.frontTop.x - geo.tip.x) * t;
      var startY = geo.tip.y + (geo.frontTop.y - geo.tip.y) * t;
      var width = size * 0.055;
      var length = size * dripLengths[index];
      drawShape(ctx, [
        { x: startX - width / 2, y: startY },
        { x: startX - width * 0.42, y: startY + length * 0.65 },
        { x: startX, y: startY + length },
        { x: startX + width * 0.42, y: startY + length * 0.65 },
        { x: startX + width / 2, y: startY }
      ], '#c62828', white * 0.72, dark);
    });

    /* 装饰：草莓、奶油、樱桃 */
    drawStrawberry(ctx, geo);
    drawCream(ctx, geo);
    drawCherries(ctx, geo);
  }

  function drawRoundCakeLegacy(ctx, geo) {
    var s = geo.scale;
    var size = geo.size;
    var dark = Math.max(2, 3.2 * s);
    var white = Math.max(5, 9 * s);

    /* 阴影 */
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
    ctx.beginPath();
    ctx.ellipse(geo.cx, geo.bottomY + geo.ry * 0.45, geo.rx * 1.12, geo.ry * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* 底部饼干底 */
    drawEllipse(ctx, geo.cx, geo.bottomY - geo.ry * 0.05, geo.rx * 1.02, geo.ry * 0.95, '#8a5a2b', white, dark);
    ctx.save();
    ctx.fillStyle = 'rgba(70, 42, 20, 0.55)';
    for (var i = 0; i < 30; i++) {
      var a = i * 2.399;
      var rr = (i % 10) / 10;
      var px = geo.cx + Math.cos(a) * geo.rx * 0.92 * rr;
      var py = geo.bottomY - geo.ry * 0.05 + Math.sin(a) * geo.ry * 0.78 * rr;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.8, size * 0.006 * (0.6 + (i % 3) * 0.4)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* 芝士蛋糕圆柱体 */
    var bodyGradient = ctx.createLinearGradient(geo.cx - geo.rx, geo.topY, geo.cx + geo.rx, geo.bottomY);
    bodyGradient.addColorStop(0, '#fff3c9');
    bodyGradient.addColorStop(0.5, '#f3e2ab');
    bodyGradient.addColorStop(1, '#e2c98a');
    drawBody(ctx, geo, bodyGradient, white, dark);

    /* 正面高光与阴影 */
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.lineWidth = Math.max(1.4, size * 0.012);
    ctx.beginPath();
    ctx.moveTo(geo.bodyLeft + geo.rx * 0.18, geo.topY + geo.ry * 0.55);
    ctx.lineTo(geo.bodyLeft + geo.rx * 0.18, geo.bottomY - geo.ry * 0.65);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150, 110, 60, 0.25)';
    ctx.beginPath();
    ctx.moveTo(geo.bodyRight - geo.rx * 0.18, geo.topY + geo.ry * 0.65);
    ctx.lineTo(geo.bodyRight - geo.rx * 0.18, geo.bottomY - geo.ry * 0.55);
    ctx.stroke();
    ctx.restore();

    /* 顶层圆形果酱面 */
    drawEllipse(ctx, geo.cx, geo.topY, geo.rx, geo.ry, '#c62828', white, dark);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = Math.max(1.5, size * 0.012);
    ctx.beginPath();
    ctx.ellipse(geo.cx + geo.rx * 0.05, geo.topY + geo.ry * 0.05, geo.rx * 0.66, geo.ry * 0.55, -0.08, 0, Math.PI * 1.7);
    ctx.stroke();
    ctx.restore();

    /* 果酱滴落 */
    var dripAngles = [0.22 * Math.PI, 0.5 * Math.PI, 0.78 * Math.PI];
    var dripLengths = [0.14, 0.20, 0.12];
    dripAngles.forEach(function (angle, index) {
      var startX = geo.cx + Math.cos(angle) * geo.rx * 0.88;
      var startY = geo.topY + Math.sin(angle) * geo.ry * 0.92;
      var width = size * 0.055;
      var length = size * dripLengths[index];
      drawShape(ctx, [
        { x: startX - width / 2, y: startY },
        { x: startX - width * 0.42, y: startY + length * 0.65 },
        { x: startX, y: startY + length },
        { x: startX + width * 0.42, y: startY + length * 0.65 },
        { x: startX + width / 2, y: startY }
      ], '#c62828', white * 0.72, dark);
    });

    /* 装饰：草莓、奶油、樱桃 */
    drawStrawberry(ctx, geo);
    drawCream(ctx, geo);
    drawCherries(ctx, geo);
  }

  function drawCuteCake(ctx, geo) {
    var s = geo.scale;
    var size = geo.size;
    var rx = geo.rx;
    var ry = geo.ry;
    var dark = Math.max(3, 4.2 * s);
    var left = geo.cx - rx * 0.88;
    var right = geo.cx + rx * 0.88;
    var top = geo.bodyTop;
    var bottom = geo.bottomY;
    var corner = rx * 0.30;

    /* 阴影 */
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(geo.cx, bottom + ry * 0.45, rx * 0.98, ry * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* 蛋糕主体底色：橙色 */
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom - corner);
    ctx.quadraticCurveTo(left, bottom, left + corner, bottom);
    ctx.lineTo(right - corner, bottom);
    ctx.quadraticCurveTo(right, bottom, right, bottom - corner);
    ctx.lineTo(right, top);
    ctx.closePath();
    ctx.fillStyle = '#f2b775';
    ctx.fill();
    ctx.strokeStyle = '#5a3a2a';
    ctx.lineWidth = dark;
    ctx.lineJoin = 'round';
    ctx.stroke();

    /* 粉色波浪条纹 */
    var waveY = top + geo.bodyHeight * 0.52;
    var waveAmp = geo.bodyHeight * 0.07;
    ctx.beginPath();
    ctx.moveTo(left, waveY);
    ctx.quadraticCurveTo(geo.cx - rx * 0.45, waveY - waveAmp, geo.cx, waveY);
    ctx.quadraticCurveTo(geo.cx + rx * 0.45, waveY + waveAmp, right, waveY);
    ctx.lineTo(right, waveY + geo.bodyHeight * 0.16);
    ctx.quadraticCurveTo(geo.cx + rx * 0.45, waveY + waveAmp + geo.bodyHeight * 0.16, geo.cx, waveY + geo.bodyHeight * 0.16);
    ctx.quadraticCurveTo(geo.cx - rx * 0.45, waveY - waveAmp + geo.bodyHeight * 0.16, left, waveY + geo.bodyHeight * 0.16);
    ctx.closePath();
    ctx.fillStyle = '#f4a7ad';
    ctx.fill();

    /* 上半部奶油色 */
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, waveY + geo.bodyHeight * 0.02);
    ctx.quadraticCurveTo(geo.cx + rx * 0.45, waveY + waveAmp + geo.bodyHeight * 0.02, geo.cx, waveY + geo.bodyHeight * 0.02);
    ctx.quadraticCurveTo(geo.cx - rx * 0.45, waveY - waveAmp + geo.bodyHeight * 0.02, left, waveY + geo.bodyHeight * 0.02);
    ctx.closePath();
    ctx.fillStyle = '#fff8e8';
    ctx.fill();

    /* 补描主体外轮廓，避免被色带盖住 */
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom - corner);
    ctx.quadraticCurveTo(left, bottom, left + corner, bottom);
    ctx.lineTo(right - corner, bottom);
    ctx.quadraticCurveTo(right, bottom, right, bottom - corner);
    ctx.lineTo(right, top);
    ctx.strokeStyle = '#5a3a2a';
    ctx.lineWidth = dark;
    ctx.stroke();

    /* 蛋糕体上的小点 */
    ctx.save();
    ctx.fillStyle = 'rgba(242, 183, 117, 0.85)';
    var dots = [
      [0.18, 0.20], [0.72, 0.18], [0.36, 0.34], [0.84, 0.36],
      [0.24, 0.68], [0.62, 0.72], [0.42, 0.86], [0.78, 0.82]
    ];
    dots.forEach(function (dot) {
      ctx.beginPath();
      ctx.arc(left + (right - left) * dot[0], top + geo.bodyHeight * dot[1], Math.max(1, size * 0.008), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    /* 奶油下垂的波浪边 */
    ctx.beginPath();
    ctx.moveTo(geo.cx - rx * 1.00, geo.topY + ry * 0.15);
    ctx.bezierCurveTo(geo.cx - rx * 0.80, geo.topY + ry * 0.95, geo.cx - rx * 0.55, geo.topY + ry * 0.35, geo.cx - rx * 0.30, geo.topY + ry * 0.78);
    ctx.bezierCurveTo(geo.cx - rx * 0.05, geo.topY + ry * 1.15, geo.cx + rx * 0.20, geo.topY + ry * 0.30, geo.cx + rx * 0.48, geo.topY + ry * 0.85);
    ctx.bezierCurveTo(geo.cx + rx * 0.70, geo.topY + ry * 1.20, geo.cx + rx * 0.88, geo.topY + ry * 0.40, geo.cx + rx * 1.00, geo.topY + ry * 0.15);
    ctx.lineTo(geo.cx + rx * 1.00, geo.topY - ry * 0.15);
    ctx.lineTo(geo.cx - rx * 1.00, geo.topY - ry * 0.15);
    ctx.closePath();
    ctx.fillStyle = '#fff8e8';
    ctx.fill();
    ctx.strokeStyle = '#5a3a2a';
    ctx.lineWidth = dark;
    ctx.stroke();

    /* 奶油顶盖 */
    ctx.beginPath();
    ctx.ellipse(geo.cx, geo.topY, rx * 1.02, ry * 1.05, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8e8';
    ctx.fill();
    ctx.strokeStyle = '#5a3a2a';
    ctx.lineWidth = dark;
    ctx.stroke();

    /* 顶部草莓底座 */
    ctx.beginPath();
    ctx.ellipse(geo.cx, geo.topY - ry * 0.62, rx * 0.38, ry * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8e8';
    ctx.fill();
    ctx.strokeStyle = '#5a3a2a';
    ctx.lineWidth = dark * 0.9;
    ctx.stroke();

    /* 草莓 */
    var strawberryX = geo.cx;
    var strawberryY = geo.topY - ry * 1.05;
    var sw = rx * 0.32;
    var sh = ry * 0.95;
    ctx.beginPath();
    ctx.moveTo(strawberryX - sw, strawberryY);
    ctx.quadraticCurveTo(strawberryX - sw * 1.08, strawberryY - sh * 0.95, strawberryX, strawberryY - sh * 1.05);
    ctx.quadraticCurveTo(strawberryX + sw * 1.08, strawberryY - sh * 0.95, strawberryX + sw, strawberryY);
    ctx.quadraticCurveTo(strawberryX + sw * 0.55, strawberryY + sh, strawberryX, strawberryY + sh);
    ctx.quadraticCurveTo(strawberryX - sw * 0.55, strawberryY + sh, strawberryX - sw, strawberryY);
    ctx.closePath();
    ctx.fillStyle = '#e2555f';
    ctx.fill();
    ctx.strokeStyle = '#5a3a2a';
    ctx.lineWidth = dark * 0.9;
    ctx.stroke();

    /* 草莓上的点 */
    ctx.save();
    ctx.fillStyle = '#c94a55';
    var seeds = [
      [-0.45, -0.45], [0.05, -0.55], [0.50, -0.35],
      [-0.25, -0.05], [0.28, -0.02], [-0.05, 0.35]
    ];
    seeds.forEach(function (seed) {
      ctx.beginPath();
      ctx.arc(strawberryX + sw * seed[0], strawberryY + sh * seed[1], Math.max(1, size * 0.009), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    /* 草莓小蒂 */
    ctx.save();
    ctx.strokeStyle = '#5a3a2a';
    ctx.lineWidth = Math.max(2, size * 0.012);
    ctx.beginPath();
    ctx.moveTo(strawberryX, strawberryY - sh * 1.02);
    ctx.quadraticCurveTo(strawberryX + sw * 0.18, strawberryY - sh * 1.28, strawberryX + sw * 0.42, strawberryY - sh * 1.22);
    ctx.stroke();
    ctx.restore();
  }

  function drawCream(ctx, geo) {
    var s = geo.scale;
    var size = geo.size;
    var dark = Math.max(2, 3.2 * s);
    var white = Math.max(5, 9 * s);
    var baseX = geo.cx + size * 0.02;
    var baseY = geo.cy - size * 0.23;
    var layers = [
      { dx: 0, dy: 0.02, rx: 0.145, ry: 0.060, rot: 0 },
      { dx: -0.012, dy: -0.035, rx: 0.125, ry: 0.052, rot: -0.08 },
      { dx: 0.008, dy: -0.072, rx: 0.100, ry: 0.045, rot: 0.06 },
      { dx: -0.006, dy: -0.104, rx: 0.072, ry: 0.034, rot: -0.05 },
      { dx: 0.002, dy: -0.128, rx: 0.042, ry: 0.022, rot: 0.04 }
    ];
    layers.forEach(function (layer) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(baseX + size * layer.dx, baseY + size * layer.dy, size * layer.rx, size * layer.ry, layer.rot, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = white;
      ctx.stroke();
      ctx.fillStyle = '#fffdf7';
      ctx.fill();
      ctx.strokeStyle = '#3a2a20';
      ctx.lineWidth = dark;
      ctx.stroke();
      ctx.restore();
    });

    ctx.save();
    ctx.strokeStyle = 'rgba(180, 160, 130, 0.55)';
    ctx.lineWidth = Math.max(1, size * 0.008);
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(baseX - size * 0.01, baseY - size * (0.01 + i * 0.045), size * (0.09 - i * 0.02), Math.PI * 0.15, Math.PI * 1.15);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStrawberry(ctx, geo) {
    var s = geo.scale;
    var size = geo.size;
    var dark = Math.max(2, 3.2 * s);
    var white = Math.max(5, 9 * s);
    var x = geo.cx + size * 0.16;
    var y = geo.cy - size * 0.31;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.085, size * 0.062, -0.45, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = white;
    ctx.stroke();
    ctx.fillStyle = '#c62828';
    ctx.fill();
    ctx.strokeStyle = '#3a2a20';
    ctx.lineWidth = dark;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(x - size * 0.005, y + size * 0.004, size * 0.035, size * 0.026, -0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#fff7e8';
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 60, 60, 0.6)';
    ctx.lineWidth = Math.max(1, size * 0.006);
    ctx.stroke();

    ctx.fillStyle = '#7a2d24';
    for (var i = 0; i < 7; i++) {
      var a = i * 0.9;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * size * 0.052, y + Math.sin(a) * size * 0.034, Math.max(0.6, size * 0.006), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#3f7a3a';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.02, y - size * 0.065, size * 0.035, size * 0.014, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + size * 0.02, y - size * 0.070, size * 0.035, size * 0.014, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCherries(ctx, geo) {
    var s = geo.scale;
    var size = geo.size;
    var dark = Math.max(2, 3.2 * s);
    var white = Math.max(5, 9 * s);
    var cherries = [
      { x: geo.cx + size * 0.00, y: geo.cy - size * 0.29, r: size * 0.045 },
      { x: geo.cx + size * 0.075, y: geo.cy - size * 0.315, r: size * 0.042 }
    ];

    cherries.forEach(function (cherry) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cherry.x, cherry.y, cherry.r, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = white;
      ctx.stroke();
      ctx.fillStyle = '#c62828';
      ctx.fill();
      ctx.strokeStyle = '#3a2a20';
      ctx.lineWidth = dark;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
      ctx.beginPath();
      ctx.arc(cherry.x - cherry.r * 0.35, cherry.y - cherry.r * 0.35, cherry.r * 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#3f5f2a';
      ctx.lineWidth = Math.max(1.2, size * 0.008);
      ctx.beginPath();
      ctx.moveTo(cherry.x, cherry.y - cherry.r * 0.9);
      ctx.quadraticCurveTo(cherry.x + cherry.r * 0.3, cherry.y - cherry.r * 1.6, cherry.x + cherry.r * 0.8, cherry.y - cherry.r * 1.5);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawSpot(ctx, x, y, s, seed, radius, scale, options) {
    options = options || {};
    var rng = M.mulberry32((seed || 1) >>> 0);
    var t = M.clamp(0.14 + 0.24 * s, 0.02, 0.98);
    var baseR = (5 + 11 * t) * scale * (radius / 300);
    baseR = Math.max(3, baseR);

    var caramel = [168, 98, 46];
    var mold = [86, 112, 62];
    var caramelEdge = [208, 158, 92];
    var moldEdge = [128, 150, 98];
    var core = mixColor(caramel, mold, t);
    var edge = mixColor(caramelEdge, moldEdge, t);

    ctx.save();

    /* 柔和底色 */
    var glow = ctx.createRadialGradient(x, y, 0, x, y, baseR * 1.5);
    glow.addColorStop(0, rgba(core, 0.72));
    glow.addColorStop(0.55, rgba(edge, 0.44));
    glow.addColorStop(1, rgba(edge, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, baseR * 1.5, 0, Math.PI * 2);
    ctx.fill();

    /* 不规则菌落 / 焦糖斑 */
    var blobs = Math.round(9 + 14 * t);
    for (var i = 0; i < blobs; i++) {
      var angle = rng() * Math.PI * 2;
      var distance = rng() * baseR * 0.72;
      var bx = x + Math.cos(angle) * distance;
      var by = y + Math.sin(angle) * distance;
      var br = baseR * (0.25 + rng() * 0.55);
      var blobGradient = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      blobGradient.addColorStop(0, rgba(core, 0.72));
      blobGradient.addColorStop(0.7, rgba(edge, 0.42));
      blobGradient.addColorStop(1, rgba(edge, 0));
      ctx.fillStyle = blobGradient;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    /* 深色孢点：霉变越强越明显 */
    var spores = Math.round(3 + 16 * t);
    ctx.fillStyle = 'rgba(38, 48, 24, ' + (0.18 + 0.34 * t).toFixed(3) + ')';
    for (var j = 0; j < spores; j++) {
      var sa = rng() * Math.PI * 2;
      var sd = rng() * baseR * 0.95;
      var sr = Math.max(0.6, baseR * (0.04 + rng() * 0.09));
      ctx.beginPath();
      ctx.arc(x + Math.cos(sa) * sd, y + Math.sin(sa) * sd, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    /* 菌丝：高霉变时出现 */
    if (t > 0.42) {
      var filaments = Math.round(6 + 12 * t);
      ctx.strokeStyle = 'rgba(150, 172, 112, ' + (0.12 + 0.30 * t).toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.8, baseR * 0.08);
      for (var k = 0; k < filaments; k++) {
        var fa = rng() * Math.PI * 2;
        var len = baseR * (0.35 + rng() * 0.85);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(fa) * baseR * 0.25, y + Math.sin(fa) * baseR * 0.25);
        ctx.quadraticCurveTo(
          x + Math.cos(fa + 0.35) * len * 0.7,
          y + Math.sin(fa + 0.35) * len * 0.7,
          x + Math.cos(fa) * len,
          y + Math.sin(fa) * len
        );
        ctx.stroke();
      }
    }

    /* 低霉变时的焦糖反光 */
    if (t < 0.52) {
      ctx.fillStyle = 'rgba(255, 235, 190, ' + (0.30 * (1 - t)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(x - baseR * 0.20, y - baseR * 0.24, baseR * 0.42, baseR * 0.24, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    /* 放大镜模式下加一圈定位环 */
    if (options.lensCenter) {
      ctx.strokeStyle = 'rgba(217, 138, 31, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, baseR * 1.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
    return { t: t, radius: baseR };
  }

  function drawInspectionLamp(ctx, w, h, cx, cy, radius, time) {
    ctx.save();
    var glow = ctx.createRadialGradient(cx, cy - radius * 0.2, radius * 0.1, cx, cy, radius * 1.65);
    glow.addColorStop(0, 'rgba(255, 246, 220, 0.16)');
    glow.addColorStop(0.55, 'rgba(255, 246, 220, 0.05)');
    glow.addColorStop(1, 'rgba(255, 246, 220, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.65, 0, Math.PI * 2);
    ctx.fill();

    var sweep = ((time * 0.08) % (w + 240)) - 120;
    var beam = ctx.createLinearGradient(sweep - 90, 0, sweep + 90, 0);
    beam.addColorStop(0, 'rgba(255, 248, 225, 0)');
    beam.addColorStop(0.5, 'rgba(255, 248, 225, 0.055)');
    beam.addColorStop(1, 'rgba(255, 248, 225, 0)');
    ctx.fillStyle = beam;
    ctx.fillRect(sweep - 90, 0, 180, h);
    ctx.restore();
  }

  function drawMagnifier(ctx, w, h, state, cakeRadius, spotX, spotY) {
    var scale = Math.min(w / BASE_W, h / BASE_H);
    var cx = w - 116 * scale;
    var cy = h * 0.255;
    var radius = 78 * scale;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#0b1117';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.92, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#fff8e8';
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    /* 放大镜里的蛋糕表面纹理 */
    ctx.fillStyle = 'rgba(180, 145, 90, 0.18)';
    for (var j = 0; j < 45; j++) {
      var angle = j * 2.399;
      var rr = (j % 9) / 9 * radius * 0.9;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr, Math.max(0.6, radius * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(160, 125, 75, 0.10)';
    ctx.lineWidth = 1;
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 30 * scale, cy - radius);
      ctx.lineTo(cx + i * 30 * scale, cy + radius);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy + i * 30 * scale);
      ctx.lineTo(cx + radius, cy + i * 30 * scale);
      ctx.stroke();
    }

    if (state.showSpot) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(3.2, 3.2);
      drawSpot(ctx, 0, 0, state.s, state.seed, cakeRadius, scale, { lensCenter: true });
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(180, 195, 210, 0.45)';
      ctx.font = (12 * scale) + 'px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('等待样本', cx, cy);
    }
    ctx.restore();

    /* 镜框 */
    ctx.strokeStyle = '#d98a1f';
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.94, 0, Math.PI * 2);
    ctx.stroke();

    /* 十字线 */
    ctx.strokeStyle = 'rgba(217, 138, 31, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.28, cy);
    ctx.lineTo(cx + radius * 0.28, cy);
    ctx.moveTo(cx, cy - radius * 0.28);
    ctx.lineTo(cx, cy + radius * 0.28);
    ctx.stroke();

    ctx.fillStyle = '#d98a1f';
    ctx.font = '700 ' + (10 * scale) + 'px "Cascadia Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('放大镜 3.2x', cx, cy + radius + 16 * scale);
  }

  function drawHud(ctx, w, h, state, scale) {
    ctx.save();
    ctx.strokeStyle = 'rgba(217, 138, 31, 0.7)';
    ctx.lineWidth = 2;
    var pad = 16 * scale;
    var len = 26 * scale;

    /* 四角框 */
    ctx.beginPath();
    ctx.moveTo(pad, pad + len);
    ctx.lineTo(pad, pad);
    ctx.lineTo(pad + len, pad);
    ctx.moveTo(w - pad - len, pad);
    ctx.lineTo(w - pad, pad);
    ctx.lineTo(w - pad, pad + len);
    ctx.moveTo(w - pad, h - pad - len);
    ctx.lineTo(w - pad, h - pad);
    ctx.lineTo(w - pad - len, h - pad);
    ctx.moveTo(pad + len, h - pad);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(pad, h - pad - len);
    ctx.stroke();

    ctx.fillStyle = 'rgba(220, 232, 240, 0.72)';
    ctx.font = (11 * scale) + 'px "Cascadia Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('MIDNIGHT BAKERY · LAST BATCH', pad + 12 * scale, pad + 8 * scale);
    ctx.textAlign = 'right';
    ctx.fillText('FESTIVAL EVE · 20 CAKES', w - pad - 12 * scale, pad + 8 * scale);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('CAKE ' + String(state.trialIndex + 1).padStart(2, '0') + ' / ' + state.total, pad + 12 * scale, h - pad - 10 * scale);
    ctx.textAlign = 'right';
    ctx.fillText('F = 可以卖   J = 不能卖', w - pad - 12 * scale, h - pad - 10 * scale);

    /* 进度条 */
    var barX = w * 0.30;
    var barY = h - pad - 16 * scale;
    var barW = w * 0.40;
    var barH = 6 * scale;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();
    ctx.fillStyle = '#d98a1f';
    roundRect(ctx, barX, barY, barW * ((state.trialIndex + (state.showSpot ? 0.5 : 0)) / state.total), barH, barH / 2);
    ctx.fill();

    /* 刺激限时倒计时条：刺激呈现期间显示剩余时间 */
    if (state.stimulusOnset && state.stimulusDeadline) {
      var totalWindow = state.stimulusDeadline - state.stimulusOnset;
      var remain = M.clamp((state.stimulusDeadline - state.time) / totalWindow, 0, 1);
      var cdWidth = w * 0.30;
      var cdX = (w - cdWidth) / 2;
      var cdY = barY - 22 * scale;
      var cdH = 5 * scale;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      roundRect(ctx, cdX, cdY, cdWidth, cdH, cdH / 2);
      ctx.fill();
      ctx.fillStyle = state.stimulusVisible ? '#6fd3a0' : '#e0a94a';
      roundRect(ctx, cdX, cdY, cdWidth * remain, cdH, cdH / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 232, 240, 0.72)';
      ctx.font = (10 * scale) + 'px "Cascadia Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(state.stimulusVisible ? '刺激呈现中' : '请作答', w / 2, cdY - 4 * scale);
    }

    ctx.restore();
  }

  function drawResultOverlay(ctx, w, h, state, scale) {
    if (!state.lastResult || !state.resultTime) return;
    var age = state.time - state.resultTime;
    if (age < 0 || age > 1500) return;

    var alpha = age < 120
      ? age / 120
      : (age > 1220 ? Math.max(0, (1500 - age) / 280) : 1);
    var color = state.lastResult.correct ? [47, 125, 79] : [185, 58, 47];
    var boxW = Math.min(470 * scale, w * 0.66);
    var boxH = 88 * scale;
    var x = (w - boxW) / 2;
    var y = h * 0.20;

    ctx.save();
    ctx.globalAlpha = M.clamp(alpha, 0, 1);

    ctx.fillStyle = 'rgba(10, 16, 22, 0.93)';
    roundRect(ctx, x, y, boxW, boxH, 8 * scale);
    ctx.fill();

    ctx.strokeStyle = rgba(color, 0.95);
    ctx.lineWidth = 2 * scale;
    roundRect(ctx, x, y, boxW, boxH, 8 * scale);
    ctx.stroke();

    ctx.fillStyle = rgba(color, 1);
    roundRect(ctx, x, y, 7 * scale, boxH, 4 * scale);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 ' + (25 * scale) + 'px "Segoe UI", "PingFang SC", sans-serif';
    var headline = state.lastResult.label + (state.lastResult.type ? ' ' + state.lastResult.type : '');
    ctx.fillText(headline, w / 2, y + 31 * scale);

    ctx.fillStyle = 'rgba(220, 232, 240, 0.82)';
    ctx.font = (13 * scale) + 'px "Segoe UI", "PingFang SC", sans-serif';
    ctx.fillText(state.lastResult.detail, w / 2, y + 61 * scale);

    ctx.restore();
  }

  function drawScan(ctx, w, h, cx, cy, radius, time, active) {
    if (!active) return;
    var t = (time * 0.0012) % 1;
    var x = cx - radius * 1.05 + t * radius * 2.1;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.98, 0, Math.PI * 2);
    ctx.clip();
    var gradient = ctx.createLinearGradient(x - 24, 0, x + 24, 0);
    gradient.addColorStop(0, 'rgba(120, 220, 255, 0)');
    gradient.addColorStop(0.5, 'rgba(120, 220, 255, 0.22)');
    gradient.addColorStop(1, 'rgba(120, 220, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 24, cy - radius, 48, radius * 2);
    ctx.restore();
  }

  function drawScene(canvas, state) {
    var dims = canvas._dims || prepare(canvas);
    var ctx = dims.ctx;
    var w = dims.w;
    var h = dims.h;
    var scale = Math.min(w / BASE_W, h / BASE_H);
    var geo = roundCakeGeometry(w, h);
    var current = state.current || state;
    var spotS = current.s !== undefined ? current.s : 0;
    var spotSeed = current.seed !== undefined ? current.seed : 1;
    var spotAngle = current.angle !== undefined ? current.angle : 0;
    var spotRadius = current.radius !== undefined ? current.radius : 0.3;
    var trialIndex = state.index !== undefined ? state.index : (state.trialIndex || 0);
    var total = state.total || 20;
    var stimulusOnset = current.stimulusOnset || state.stimulusOnset || 0;
    var stimulusDeadline = current.stimulusDeadline || state.stimulusDeadline || 0;
    var stimulusVisible = state.stimulusVisible !== undefined ? state.stimulusVisible : state.showSpot;

    drawBackground(ctx, w, h, state.time);
    drawConveyor(ctx, w, h, state.time, scale);
    drawInspectionLamp(ctx, w, h, geo.cx, geo.cy, geo.size * 0.52, state.time);
    drawCuteCake(ctx, geo);
    drawScan(ctx, w, h, geo.cx, geo.cy, geo.size * 0.52, state.time, !state.showSpot);

    var spot = spotPoint(spotAngle, spotRadius, geo);
    var spotX = spot.x;
    var spotY = spot.y;

    if (state.showSpot) {
      var revealAge = state.time - (state.revealTime || 0);
      var pulse = 1 + 0.18 * Math.exp(-Math.max(0, revealAge) / 320) * Math.sin(revealAge / 90);
      ctx.save();
      ctx.globalAlpha = M.clamp(revealAge / 260, 0.2, 1);
      drawSpot(ctx, spotX, spotY, spotS, spotSeed, geo.size, scale * pulse, {});
      ctx.restore();
    }

    drawMagnifier(ctx, w, h, { showSpot: state.showSpot, s: spotS, seed: spotSeed }, geo.size, spotX, spotY);
    drawHud(ctx, w, h, {
      trialIndex: trialIndex,
      total: total,
      showSpot: state.showSpot,
      stimulusOnset: stimulusOnset,
      stimulusDeadline: stimulusDeadline,
      stimulusVisible: stimulusVisible
    }, scale);
    drawResultOverlay(ctx, w, h, state, scale);
  }

  NS.render = {
    prepare: prepare,
    drawScene: drawScene,
    drawSpot: drawSpot
  };
})(window.CakeSDT = window.CakeSDT || {});
