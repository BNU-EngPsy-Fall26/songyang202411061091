/* =========================================================
   SVG 图表工具
   - 不依赖 ECharts 等外部库，保证离线双击可运行
   - 提供分布图、ROC、zROC、阈值图、直方图、散点图、折线图
   ========================================================= */
(function (NS) {
  'use strict';

  var M = NS.math;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, text) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (attrs[key] !== null && attrs[key] !== undefined) {
          node.setAttribute(key, attrs[key]);
        }
      });
    }
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function prepareSvg(container, width, height) {
    clear(container);
    var svg;
    if (container.tagName && container.tagName.toLowerCase() === 'svg') {
      svg = container;
    } else {
      svg = el('svg', { class: 'chart-svg' });
      container.appendChild(svg);
    }
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (!svg.getAttribute('role')) svg.setAttribute('role', 'img');
    return svg;
  }

  function niceTicks(min, max, count) {
    var ticks = [];
    var span = max - min;
    if (span <= 0) return [min];
    for (var i = 0; i <= count; i++) {
      ticks.push(min + span * i / count);
    }
    return ticks;
  }

  function makeChart(container, options) {
    options = options || {};
    var width = options.width || 720;
    var height = options.height || 360;
    var margin = Object.assign({ top: 34, right: 26, bottom: 48, left: 58 }, options.margin || {});
    var xDomain = options.xDomain || [0, 1];
    var yDomain = options.yDomain || [0, 1];
    var xTicks = options.xTicks || 5;
    var yTicks = options.yTicks || 5;
    var xFormat = options.xFormat || function (v) { return M.format(v, 1); };
    var yFormat = options.yFormat || function (v) { return M.format(v, 2); };

    var svg = prepareSvg(container, width, height);
    var plot = {
      left: margin.left,
      right: width - margin.right,
      top: margin.top,
      bottom: height - margin.bottom
    };

    function x(value) {
      var t = (value - xDomain[0]) / (xDomain[1] - xDomain[0] || 1);
      return plot.left + t * (plot.right - plot.left);
    }

    function y(value) {
      var t = (value - yDomain[0]) / (yDomain[1] - yDomain[0] || 1);
      return plot.bottom - t * (plot.bottom - plot.top);
    }

    var bg = el('rect', {
      x: plot.left, y: plot.top,
      width: plot.right - plot.left,
      height: plot.bottom - plot.top,
      fill: '#fbfcfd'
    });
    svg.appendChild(bg);

    /* 网格 */
    niceTicks(xDomain[0], xDomain[1], xTicks).forEach(function (value) {
      svg.appendChild(el('line', {
        x1: x(value), y1: plot.top, x2: x(value), y2: plot.bottom,
        stroke: '#e7ebef', 'stroke-width': 1
      }));
      svg.appendChild(el('text', {
        x: x(value), y: plot.bottom + 17,
        'text-anchor': 'middle', 'font-size': 10, fill: '#6b7785'
      }, xFormat(value)));
    });

    niceTicks(yDomain[0], yDomain[1], yTicks).forEach(function (value) {
      svg.appendChild(el('line', {
        x1: plot.left, y1: y(value), x2: plot.right, y2: y(value),
        stroke: '#e7ebef', 'stroke-width': 1
      }));
      svg.appendChild(el('text', {
        x: plot.left - 8, y: y(value) + 3,
        'text-anchor': 'end', 'font-size': 10, fill: '#6b7785'
      }, yFormat(value)));
    });

    /* 坐标轴 */
    svg.appendChild(el('line', {
      x1: plot.left, y1: plot.bottom, x2: plot.right, y2: plot.bottom,
      stroke: '#9aa6b2', 'stroke-width': 1.2
    }));
    svg.appendChild(el('line', {
      x1: plot.left, y1: plot.top, x2: plot.left, y2: plot.bottom,
      stroke: '#9aa6b2', 'stroke-width': 1.2
    }));

    if (options.xLabel) {
      svg.appendChild(el('text', {
        x: (plot.left + plot.right) / 2,
        y: height - 10,
        'text-anchor': 'middle',
        'font-size': 11,
        fill: '#3d4b59'
      }, options.xLabel));
    }

    if (options.yLabel) {
      svg.appendChild(el('text', {
        x: 14,
        y: (plot.top + plot.bottom) / 2,
        'text-anchor': 'middle',
        'font-size': 11,
        fill: '#3d4b59',
        transform: 'rotate(-90 14 ' + ((plot.top + plot.bottom) / 2) + ')'
      }, options.yLabel));
    }

    if (options.title) {
      svg.appendChild(el('text', {
        x: plot.left,
        y: 18,
        'font-size': 12,
        'font-weight': 700,
        fill: '#15202b'
      }, options.title));
    }

    var chart = {
      svg: svg,
      plot: plot,
      width: width,
      height: height,
      xDomain: xDomain,
      yDomain: yDomain,
      x: x,
      y: y,
      addPath: function (d, attrs) {
        var node = el('path', Object.assign({ d: d, fill: 'none' }, attrs || {}));
        svg.appendChild(node);
        return node;
      },
      addLine: function (x1, y1, x2, y2, attrs) {
        var node = el('line', Object.assign({
          x1: x1, y1: y1, x2: x2, y2: y2,
          stroke: '#334455', 'stroke-width': 1
        }, attrs || {}));
        svg.appendChild(node);
        return node;
      },
      addCircle: function (cx, cy, r, attrs) {
        var node = el('circle', Object.assign({
          cx: cx, cy: cy, r: r, fill: '#d98a1f'
        }, attrs || {}));
        svg.appendChild(node);
        return node;
      },
      addRect: function (x1, y1, w, h, attrs) {
        var node = el('rect', Object.assign({
          x: x1, y: y1, width: w, height: h, fill: '#d98a1f'
        }, attrs || {}));
        svg.appendChild(node);
        return node;
      },
      addText: function (x1, y1, text, attrs) {
        var node = el('text', Object.assign({
          x: x1, y: y1, 'font-size': 11, fill: '#15202b'
        }, attrs || {}), text);
        svg.appendChild(node);
        return node;
      },
      addPolygon: function (points, attrs) {
        var d = points.map(function (p, index) {
          return (index === 0 ? 'M' : 'L') + p[0] + ',' + p[1];
        }).join(' ') + ' Z';
        return chart.addPath(d, attrs);
      },
      addLegend: function (items, options2) {
        options2 = options2 || {};
        var startX = options2.x || (plot.left + 10);
        var startY = options2.y || (plot.top + 14);
        items.forEach(function (item, index) {
          var yy = startY + index * 16;
          chart.addLine(startX, yy, startX + 18, yy, {
            stroke: item.color, 'stroke-width': 3
          });
          chart.addText(startX + 24, yy + 4, item.name, {
            'font-size': 10,
            fill: '#3d4b59'
          });
        });
      }
    };

    return chart;
  }

  function curvePoints(fn, domain, steps) {
    var points = [];
    steps = steps || 220;
    for (var i = 0; i <= steps; i++) {
      var x = domain[0] + (domain[1] - domain[0]) * i / steps;
      points.push({ x: x, y: fn(x) });
    }
    return points;
  }

  function pathFromPoints(points, xScale, yScale) {
    return points.map(function (point, index) {
      return (index === 0 ? 'M' : 'L') + xScale(point.x) + ',' + yScale(point.y);
    }).join(' ');
  }

  function areaFromPoints(points, xScale, yScale, baseline) {
    if (!points.length) return '';
    var d = 'M' + xScale(points[0].x) + ',' + yScale(baseline);
    points.forEach(function (point) {
      d += ' L' + xScale(point.x) + ',' + yScale(point.y);
    });
    d += ' L' + xScale(points[points.length - 1].x) + ',' + yScale(baseline) + ' Z';
    return d;
  }

  /* ---------- 两个分布图 ---------- */

  function distributionChart(container, options) {
    options = options || {};
    var dPrime = options.dPrime === undefined ? 1.5 : options.dPrime;
    var c = options.c === undefined ? 0 : options.c;
    var sigma = options.sigmaSignal || 1;
    var xMin = options.xMin === undefined ? (-3.6 - Math.max(0, dPrime) * 0.35) : options.xMin;
    var xMax = options.xMax === undefined ? (3.6 + Math.max(0, dPrime) * 0.85) : options.xMax;
    var probs = M.modelProbs(dPrime, c, sigma);
    var xc = probs.xc;
    var yMax = Math.max(
      M.normPdf(0),
      M.normPdf(0) / sigma
    ) * 1.22;

    var chart = makeChart(container, {
      width: options.width || 720,
      height: options.height || 400,
      xDomain: [xMin, xMax],
      yDomain: [0, yMax],
      xTicks: 6,
      yTicks: 4,
      xLabel: options.xLabel || '感知证据强度',
      yLabel: options.yLabel || '概率密度',
      title: options.title,
      margin: { top: 42, right: 26, bottom: 50, left: 58 }
    });

    var noiseFn = function (x) { return M.normPdf(x); };
    var signalFn = function (x) { return M.normPdf((x - dPrime) / sigma) / sigma; };
    var noisePoints = curvePoints(noiseFn, [xMin, xMax]);
    var signalPoints = curvePoints(signalFn, [xMin, xMax]);

    /* 四种结果的面积 */
    chart.addPath(areaFromPoints(noisePoints.filter(function (p) { return p.x <= xc; }), chart.x, chart.y, 0), {
      fill: 'rgba(43, 93, 140, 0.20)'
    });
    chart.addPath(areaFromPoints(noisePoints.filter(function (p) { return p.x >= xc; }), chart.x, chart.y, 0), {
      fill: 'rgba(217, 138, 31, 0.22)'
    });
    chart.addPath(areaFromPoints(signalPoints.filter(function (p) { return p.x <= xc; }), chart.x, chart.y, 0), {
      fill: 'rgba(185, 58, 47, 0.20)'
    });
    chart.addPath(areaFromPoints(signalPoints.filter(function (p) { return p.x >= xc; }), chart.x, chart.y, 0), {
      fill: 'rgba(47, 125, 79, 0.22)'
    });

    /* 曲线 */
    chart.addPath(pathFromPoints(noisePoints, chart.x, chart.y), {
      stroke: '#2b5d8c', 'stroke-width': 2.4
    });
    chart.addPath(pathFromPoints(signalPoints, chart.x, chart.y), {
      stroke: '#2f7d4f', 'stroke-width': 2.4
    });

    /* 判定线 */
    chart.addLine(chart.x(xc), chart.y(0), chart.x(xc), chart.y(yMax * 0.94), {
      stroke: '#b93a2f', 'stroke-width': 2, 'stroke-dasharray': '5 4'
    });
    chart.addText(chart.x(xc) + 6, chart.y(yMax * 0.92), '判定线 c=' + M.format(c, 2), {
      'font-size': 10,
      fill: '#b93a2f'
    });

    chart.addLegend(options.compact ? [
      { name: '噪音 N', color: '#2b5d8c' },
      { name: '信号 S', color: '#2f7d4f' }
    ] : [
      { name: '噪音 N（正常蛋糕）', color: '#2b5d8c' },
      { name: '信号 S（霉变蛋糕）', color: '#2f7d4f' },
      { name: 'H 击中', color: '#2f7d4f' },
      { name: 'FA 误报', color: '#d98a1f' },
      { name: 'M 漏报', color: '#b93a2f' },
      { name: 'CR 正确拒斥', color: '#2b5d8c' }
    ], { x: chart.plot.left + 10, y: chart.plot.top + 12 });

    return probs;
  }

  /* ---------- ROC ---------- */

  function rocChart(container, options) {
    options = options || {};
    var dPrime = options.dPrime === undefined ? 1.5 : options.dPrime;
    var c = options.c === undefined ? 0 : options.c;
    var sigma = options.sigmaSignal || 1;
    var probs = M.modelProbs(dPrime, c, sigma);
    var auc = M.aucFromDPrime(dPrime);

    var chart = makeChart(container, {
      width: options.width || 720,
      height: options.height || 360,
      xDomain: [0, 1],
      yDomain: [0, 1],
      xTicks: 5,
      yTicks: 5,
      xLabel: "P(FA) →",
      yLabel: "P(Hit) →",
      title: options.title || "ROC 曲线 · AUC = " + M.format(auc, 3),
      margin: { top: 42, right: 26, bottom: 50, left: 58 }
    });

    /* 随机线 */
    chart.addLine(chart.x(0), chart.y(0), chart.x(1), chart.y(1), {
      stroke: '#b6c0c9', 'stroke-width': 1.4, 'stroke-dasharray': '5 5'
    });

    var rocPoints = [];
    for (var i = 0; i <= 240; i++) {
      var xc = -6 + 12 * i / 240;
      rocPoints.push({
        x: 1 - M.normCdf(xc),
        y: 1 - M.normCdf((xc - dPrime) / sigma)
      });
    }
    chart.addPath(pathFromPoints(rocPoints, chart.x, chart.y), {
      stroke: '#2b5d8c', 'stroke-width': 2.4
    });

    chart.addCircle(chart.x(probs.pFA), chart.y(probs.pH), 6, {
      fill: '#d98a1f', stroke: '#ffffff', 'stroke-width': 2
    });
    chart.addText(chart.x(probs.pFA) + 9, chart.y(probs.pH) - 7,
      'c=' + M.format(c, 2), { 'font-size': 10, fill: '#a9630d' });

    return { probs: probs, auc: auc };
  }

  function zrocChart(container, options) {
    options = options || {};
    var dPrime = options.dPrime === undefined ? 1.5 : options.dPrime;
    var c = options.c === undefined ? 0 : options.c;
    var sigma = options.sigmaSignal || 1;
    var probs = M.modelProbs(dPrime, c, sigma);
    var zH = M.normInv(M.clamp(probs.pH, 0.001, 0.999));
    var zFA = M.normInv(M.clamp(probs.pFA, 0.001, 0.999));

    var chart = makeChart(container, {
      width: options.width || 720,
      height: options.height || 360,
      xDomain: [-3.5, 3.5],
      yDomain: [-3.5, 3.5],
      xTicks: 7,
      yTicks: 7,
      xLabel: 'z(P(FA))',
      yLabel: 'z(P(Hit))',
      title: options.title || "z 变换 ROC · 斜率 = 1/σ(SN)",
      margin: { top: 42, right: 26, bottom: 50, left: 58 }
    });

    chart.addLine(chart.x(-3.5), chart.y(-3.5), chart.x(3.5), chart.y(3.5), {
      stroke: '#b6c0c9', 'stroke-width': 1.2, 'stroke-dasharray': '5 5'
    });
    chart.addLine(chart.x(-3.5), chart.y(0), chart.x(3.5), chart.y(0), {
      stroke: '#dfe4e9', 'stroke-width': 1
    });
    chart.addLine(chart.x(0), chart.y(-3.5), chart.x(0), chart.y(3.5), {
      stroke: '#dfe4e9', 'stroke-width': 1
    });

    var linePoints = [
      { x: -3.2, y: (-3.2 + dPrime) / sigma },
      { x: 3.2, y: (3.2 + dPrime) / sigma }
    ];
    chart.addPath(pathFromPoints(linePoints, chart.x, chart.y), {
      stroke: '#2b5d8c', 'stroke-width': 2.4
    });
    chart.addCircle(chart.x(zFA), chart.y(zH), 6, {
      fill: '#d98a1f', stroke: '#ffffff', 'stroke-width': 2
    });

    return { zH: zH, zFA: zFA };
  }

  /* ---------- 最优阈值图 ---------- */

  function thresholdChart(container, options) {
    options = options || {};
    var dPrime = options.dPrime === undefined ? 1.8 : options.dPrime;
    var c = options.c === undefined ? 0 : options.c;
    var optimalC = options.optimalC === undefined ? 0 : options.optimalC;
    var xMin = -3.6 - Math.max(0, dPrime) * 0.35;
    var xMax = 3.6 + Math.max(0, dPrime) * 0.85;
    var yMax = M.normPdf(0) * 1.22;

    var chart = makeChart(container, {
      width: options.width || 720,
      height: options.height || 360,
      xDomain: [xMin, xMax],
      yDomain: [0, yMax],
      xTicks: 6,
      yTicks: 4,
      xLabel: '感知证据强度',
      yLabel: '概率密度',
      title: options.title || '当前标准与最优标准',
      margin: { top: 42, right: 26, bottom: 50, left: 58 }
    });

    var noisePoints = curvePoints(function (x) { return M.normPdf(x); }, [xMin, xMax]);
    var signalPoints = curvePoints(function (x) { return M.normPdf(x - dPrime); }, [xMin, xMax]);
    chart.addPath(areaFromPoints(noisePoints, chart.x, chart.y, 0), { fill: 'rgba(43, 93, 140, 0.13)' });
    chart.addPath(areaFromPoints(signalPoints, chart.x, chart.y, 0), { fill: 'rgba(47, 125, 79, 0.13)' });
    chart.addPath(pathFromPoints(noisePoints, chart.x, chart.y), { stroke: '#2b5d8c', 'stroke-width': 2.2 });
    chart.addPath(pathFromPoints(signalPoints, chart.x, chart.y), { stroke: '#2f7d4f', 'stroke-width': 2.2 });

    var currentX = c + dPrime / 2;
    var optimalX = optimalC + dPrime / 2;
    chart.addLine(chart.x(currentX), chart.y(0), chart.x(currentX), chart.y(yMax * 0.95), {
      stroke: '#b93a2f', 'stroke-width': 2, 'stroke-dasharray': '5 4'
    });
    chart.addText(chart.x(currentX) + 6, chart.y(yMax * 0.90), '你的 c=' + M.format(c, 2), {
      'font-size': 10, fill: '#b93a2f'
    });
    chart.addLine(chart.x(optimalX), chart.y(0), chart.x(optimalX), chart.y(yMax * 0.95), {
      stroke: '#2f7d4f', 'stroke-width': 2, 'stroke-dasharray': '5 4'
    });
    chart.addText(chart.x(optimalX) + 6, chart.y(yMax * 0.82), '最优 c=' + M.format(optimalC, 2), {
      'font-size': 10, fill: '#2f7d4f'
    });
    chart.addLegend([
      { name: '正常蛋糕 N', color: '#2b5d8c' },
      { name: '霉变蛋糕 S', color: '#2f7d4f' }
    ], { x: chart.plot.left + 10, y: chart.plot.top + 12 });
  }

  /* ---------- 机器学习分数分布 ---------- */

  function mlChart(container, options) {
    options = options || {};
    var dPrime = options.dPrime === undefined ? 1.5 : options.dPrime;
    var xc = options.xc === undefined ? 0 : options.xc;
    var xMin = -3.6 - Math.max(0, dPrime) * 0.35;
    var xMax = 3.6 + Math.max(0, dPrime) * 0.85;
    var yMax = M.normPdf(0) * 1.22;

    var chart = makeChart(container, {
      width: options.width || 720,
      height: options.height || 360,
      xDomain: [xMin, xMax],
      yDomain: [0, yMax],
      xTicks: 6,
      yTicks: 4,
      xLabel: '模型分数',
      yLabel: '概率密度',
      title: options.title || '自动分拣机的分数分布',
      margin: { top: 42, right: 26, bottom: 50, left: 58 }
    });

    var negative = curvePoints(function (x) { return M.normPdf(x); }, [xMin, xMax]);
    var positive = curvePoints(function (x) { return M.normPdf(x - dPrime); }, [xMin, xMax]);
    chart.addPath(areaFromPoints(negative.filter(function (p) { return p.x >= xc; }), chart.x, chart.y, 0), {
      fill: 'rgba(217, 138, 31, 0.30)'
    });
    chart.addPath(areaFromPoints(positive.filter(function (p) { return p.x <= xc; }), chart.x, chart.y, 0), {
      fill: 'rgba(185, 58, 47, 0.28)'
    });
    chart.addPath(pathFromPoints(negative, chart.x, chart.y), { stroke: '#2b5d8c', 'stroke-width': 2.2 });
    chart.addPath(pathFromPoints(positive, chart.x, chart.y), { stroke: '#2f7d4f', 'stroke-width': 2.2 });
    chart.addLine(chart.x(xc), chart.y(0), chart.x(xc), chart.y(yMax * 0.95), {
      stroke: '#334455', 'stroke-width': 2, 'stroke-dasharray': '5 4'
    });
    chart.addText(chart.x(xc) + 6, chart.y(yMax * 0.92), '阈值', {
      'font-size': 10, fill: '#334455'
    });
    chart.addLegend([
      { name: '负例（正常）', color: '#2b5d8c' },
      { name: '正例（霉变）', color: '#2f7d4f' },
      { name: 'FP 误报', color: '#d98a1f' },
      { name: 'FN 漏报', color: '#b93a2f' }
    ], { x: chart.plot.left + 10, y: chart.plot.top + 12 });
  }

  /* ---------- 折线图 ---------- */

  function lineChart(container, options) {
    options = options || {};
    var series = options.series || [];
    var allPoints = [];
    series.forEach(function (item) {
      (item.points || []).forEach(function (p) { allPoints.push(p); });
    });
    var xDomain = options.xDomain;
    var yDomain = options.yDomain;
    if (!xDomain) {
      var xs = allPoints.map(function (p) { return p[0]; });
      xDomain = [Math.min.apply(null, xs), Math.max.apply(null, xs)];
    }
    if (!yDomain) {
      var ys = allPoints.map(function (p) { return p[1]; });
      var minY = Math.min.apply(null, ys);
      var maxY = Math.max.apply(null, ys);
      var pad = (maxY - minY) * 0.15 || 0.2;
      yDomain = [minY - pad, maxY + pad];
    }

    var chart = makeChart(container, {
      width: options.width || 720,
      height: options.height || 340,
      xDomain: xDomain,
      yDomain: yDomain,
      xTicks: options.xTicks || 6,
      yTicks: options.yTicks || 5,
      xLabel: options.xLabel,
      yLabel: options.yLabel,
      title: options.title,
      margin: { top: 42, right: 26, bottom: 50, left: 58 }
    });

    if (options.zeroLine && yDomain[0] < 0 && yDomain[1] > 0) {
      chart.addLine(chart.plot.left, chart.y(0), chart.plot.right, chart.y(0), {
        stroke: '#9aa6b2', 'stroke-width': 1, 'stroke-dasharray': '4 4'
      });
    }

    series.forEach(function (item) {
      var points = (item.points || []).map(function (p) { return { x: p[0], y: p[1] }; });
      if (!points.length) return;
      chart.addPath(pathFromPoints(points, chart.x, chart.y), {
        stroke: item.color || '#2b5d8c',
        'stroke-width': item.width || 2.2,
        'stroke-dasharray': item.dash || null
      });
      if (item.points !== false) {
        points.forEach(function (point) {
          chart.addCircle(chart.x(point.x), chart.y(point.y), item.dotRadius || 3, {
            fill: item.color || '#2b5d8c', stroke: '#ffffff', 'stroke-width': 1.2
          });
        });
      }
    });

    chart.addLegend(series.map(function (item) {
      return { name: item.name, color: item.color || '#2b5d8c' };
    }), { x: chart.plot.left + 10, y: chart.plot.top + 12 });
  }

  /* ---------- 直方图 ---------- */

  function histogram(container, options) {
    options = options || {};
    var values = (options.values || []).filter(function (v) { return isFinite(v); });
    var domain = options.domain || [-1, 4];
    var bins = options.bins || 12;
    var counts = new Array(bins).fill(0);
    values.forEach(function (value) {
      var t = (value - domain[0]) / (domain[1] - domain[0] || 1);
      var index = M.clamp(Math.floor(t * bins), 0, bins - 1);
      counts[index]++;
    });
    var maxCount = Math.max.apply(null, counts.concat([1]));

    var chart = makeChart(container, {
      width: options.width || 720,
      height: options.height || 340,
      xDomain: domain,
      yDomain: [0, maxCount * 1.15],
      xTicks: options.xTicks || 6,
      yTicks: 4,
      xLabel: options.xLabel,
      yLabel: '人数',
      title: options.title,
      margin: { top: 42, right: 26, bottom: 50, left: 58 }
    });

    var binWidth = (domain[1] - domain[0]) / bins;
    counts.forEach(function (count, index) {
      var x0 = domain[0] + index * binWidth;
      var x1 = x0 + binWidth * 0.86;
      chart.addRect(chart.x(x0), chart.y(count), chart.x(x1) - chart.x(x0), chart.y(0) - chart.y(count), {
        fill: options.color || '#2b5d8c',
        opacity: 0.78,
        rx: 2
      });
    });
    if (options.mean !== undefined && isFinite(options.mean)) {
      chart.addLine(chart.x(options.mean), chart.y(0), chart.x(options.mean), chart.y(maxCount * 1.08), {
        stroke: '#d98a1f', 'stroke-width': 2, 'stroke-dasharray': '5 4'
      });
      chart.addText(chart.x(options.mean) + 5, chart.y(maxCount * 1.0), '均值 ' + M.format(options.mean, 2), {
        'font-size': 10, fill: '#a9630d'
      });
    }
  }

  /* ---------- 散点图 ---------- */

  function scatter(container, options) {
    options = options || {};
    var points = options.points || [];
    var xDomain = options.xDomain || [0, 1];
    var yDomain = options.yDomain || [0, 1];

    var chart = makeChart(container, {
      width: options.width || 720,
      height: options.height || 340,
      xDomain: xDomain,
      yDomain: yDomain,
      xTicks: options.xTicks || 5,
      yTicks: options.yTicks || 5,
      xLabel: options.xLabel,
      yLabel: options.yLabel,
      title: options.title,
      margin: { top: 42, right: 26, bottom: 50, left: 58 }
    });

    if (options.diagonal) {
      var min = Math.max(xDomain[0], yDomain[0]);
      var max = Math.min(xDomain[1], yDomain[1]);
      chart.addLine(chart.x(min), chart.y(min), chart.x(max), chart.y(max), {
        stroke: '#b6c0c9', 'stroke-width': 1.4, 'stroke-dasharray': '5 5'
      });
    }

    points.forEach(function (point) {
      chart.addCircle(chart.x(point.x), chart.y(point.y), point.r || 4, {
        fill: point.color || '#2b5d8c',
        opacity: point.opacity === undefined ? 0.78 : point.opacity,
        stroke: point.stroke || '#ffffff',
        'stroke-width': point.strokeWidth === undefined ? 1 : point.strokeWidth
      });
      if (point.label) {
        chart.addText(chart.x(point.x) + 6, chart.y(point.y) - 5, point.label, {
          'font-size': 9,
          fill: point.labelColor || '#3d4b59'
        });
      }
    });
  }

  /* ---------- 柱状图 ---------- */

  function barChart(container, options) {
    options = options || {};
    var items = options.items || [];
    var maxValue = Math.max.apply(null, items.map(function (item) { return item.value; }).concat([1]));

    var chart = makeChart(container, {
      width: options.width || 720,
      height: options.height || 340,
      xDomain: [0, items.length],
      yDomain: [0, maxValue * 1.2],
      xTicks: 0,
      yTicks: 5,
      xLabel: options.xLabel,
      yLabel: options.yLabel,
      title: options.title,
      margin: { top: 42, right: 26, bottom: 50, left: 58 }
    });

    var slot = (chart.plot.right - chart.plot.left) / Math.max(1, items.length);
    items.forEach(function (item, index) {
      var x0 = chart.plot.left + slot * index + slot * 0.2;
      var x1 = chart.plot.left + slot * (index + 1) - slot * 0.2;
      chart.addRect(x0, chart.y(item.value), x1 - x0, chart.y(0) - chart.y(item.value), {
        fill: item.color || '#2b5d8c',
        opacity: 0.8,
        rx: 2
      });
      chart.addText((x0 + x1) / 2, chart.y(0) + 16, item.label, {
        'text-anchor': 'middle', 'font-size': 10, fill: '#3d4b59'
      });
      chart.addText((x0 + x1) / 2, chart.y(item.value) - 5, M.format(item.value, 2), {
        'text-anchor': 'middle', 'font-size': 10, fill: '#15202b'
      });
    });
  }

  NS.charts = {
    el: el,
    clear: clear,
    makeChart: makeChart,
    distributionChart: distributionChart,
    rocChart: rocChart,
    zrocChart: zrocChart,
    thresholdChart: thresholdChart,
    mlChart: mlChart,
    lineChart: lineChart,
    histogram: histogram,
    scatter: scatter,
    barChart: barChart
  };
})(window.CakeSDT = window.CakeSDT || {});
