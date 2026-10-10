/* =========================================================
   概念实验室
   五个面板：分布、ROC、先验与奖惩、机器学习、警觉模拟
   ========================================================= */
(function (NS) {
  'use strict';

  var M = NS.math;
  var C = NS.charts;

  var state = {
    dist: { d: 1.5, c: 0 },
    roc: { d: 1.5, c: 0, sigma: 1 },
    payoff: {
      pS: 0.5,
      c: 0,
      d: 1.8,
      values: { VH: 10, VM: -20, VFA: -2, VCR: 5 }
    },
    ml: { auc: 0.85, threshold: 0.8 },
    vig: { decline: true, shift: true, last: null }
  };

  function q(id) {
    return document.getElementById(id);
  }

  function statCard(label, value, highlight) {
    return '<div class="stat-card' + (highlight ? ' highlight' : '') + '">' +
      '<span class="stat-label">' + label + '</span>' +
      '<span class="stat-value">' + value + '</span>' +
      '</div>';
  }

  function matrixHTML(hit, miss, fa, cr) {
    return '<thead><tr><th rowspan="2">反应</th><th colspan="2">实际状态</th></tr>' +
      '<tr><th>有信号</th><th>无信号</th></tr></thead>' +
      '<tbody><tr><th>说“有”</th>' +
      '<td class="cell-hit">H=' + hit + '</td>' +
      '<td class="cell-fa">FA=' + fa + '</td></tr>' +
      '<tr><th>说“无”</th>' +
      '<td class="cell-miss">M=' + miss + '</td>' +
      '<td class="cell-cr">CR=' + cr + '</td></tr></tbody>';
  }

  /* ---------- 面板一：两个分布 ---------- */

  function renderDist() {
    state.dist.d = parseFloat(q('labDiff').value);
    state.dist.c = parseFloat(q('labC').value);
    var d = state.dist.d;
    var c = state.dist.c;
    q('labDiffValue').textContent = M.format(d, 1);
    q('labCValue').textContent = M.signed(c, 2);

    var probs = M.modelProbs(d, c, 1);
    var zH = M.normInv(M.clamp(probs.pH, 0.0001, 0.9999));
    var zFA = M.normInv(M.clamp(probs.pFA, 0.0001, 0.9999));
    var beta = M.betaFromZ(zH, zFA);
    var aPrime = M.aPrime(probs.pH, probs.pFA);

    q('distStats').innerHTML = [
      statCard("d'", M.format(d, 2), true),
      statCard('β', M.format(beta, 2)),
      statCard('c', M.signed(c, 2), true),
      statCard("A'", M.format(aPrime, 3))
    ].join('');

    q('distMatrix').innerHTML = matrixHTML(
      M.format(probs.pH, 3),
      M.format(1 - probs.pH, 3),
      M.format(probs.pFA, 3),
      M.format(1 - probs.pFA, 3)
    );

    C.distributionChart(q('distChart'), {
      dPrime: d,
      c: c,
      title: '正常蛋糕与霉变蛋糕的证据分布'
    });
  }

  /* ---------- 面板二：ROC ---------- */

  function renderRoc() {
    state.roc.d = parseFloat(q('rocDiff').value);
    state.roc.c = parseFloat(q('rocC').value);
    state.roc.sigma = parseFloat(q('rocSigma').value);
    var d = state.roc.d;
    var c = state.roc.c;
    var sigma = state.roc.sigma;

    q('rocDiffValue').textContent = M.format(d, 1);
    q('rocCValue').textContent = M.signed(c, 2);
    q('rocSigmaValue').textContent = M.format(sigma, 2);

    var roc = C.rocChart(q('rocChart'), {
      dPrime: d,
      c: c,
      sigmaSignal: sigma,
      title: 'ROC 曲线 · AUC = ' + M.format(M.aucFromDPrime(d), 3)
    });
    C.zrocChart(q('zrocChart'), {
      dPrime: d,
      c: c,
      sigmaSignal: sigma
    });

    q('rocStats').innerHTML = [
      statCard('AUC', M.format(roc.auc, 3), true),
      statCard('zROC 斜率', M.format(1 / sigma, 2)),
      statCard('zROC 截距', M.format(d / sigma, 2)),
      statCard('当前 P(Hit)', M.format(roc.probs.pH, 3)),
      statCard('当前 P(FA)', M.format(roc.probs.pFA, 3))
    ].join('');
  }

  /* ---------- 面板三：先验与奖惩 ---------- */

  function readPayoffValues() {
    state.payoff.values = {
      VH: parseFloat(q('payVH').value) || 0,
      VM: parseFloat(q('payVM').value) || 0,
      VFA: parseFloat(q('payVFA').value) || 0,
      VCR: parseFloat(q('payVCR').value) || 0
    };
  }

  function renderPayoff() {
    state.payoff.pS = parseFloat(q('payPrior').value);
    state.payoff.c = parseFloat(q('payC').value);
    state.payoff.d = parseFloat(q('payD').value);
    readPayoffValues();

    var pS = state.payoff.pS;
    var c = state.payoff.c;
    var d = state.payoff.d;
    var values = state.payoff.values;

    q('payPriorValue').textContent = M.format(pS, 2);
    q('payCValue').textContent = M.signed(c, 2);
    q('payDValue').textContent = M.format(d, 2);

    var betaOpt = M.optimalBeta(pS, values);
    var cStar = M.optimalC(pS, values, d);
    var currentBeta = Math.exp(d * c);
    var currentProbs = M.modelProbs(d, c, 1);
    var optimalProbs = M.modelProbs(d, cStar, 1);
    var currentEV = M.expectedValue(currentProbs, pS, values);
    var optimalEV = M.expectedValue(optimalProbs, pS, values);
    var gap = (optimalEV - currentEV) * 100;

    q('payoffStats').innerHTML = [
      statCard('最优 β', M.format(betaOpt, 3), true),
      statCard('最优 c*', M.format(cStar, 2), true),
      statCard('当前 β', M.format(currentBeta, 3)),
      statCard('当前 c', M.signed(c, 2)),
      statCard('每 100 块收益差', M.format(gap, 1))
    ].join('');

    C.thresholdChart(q('payoffChart'), {
      dPrime: d,
      c: c,
      optimalC: cStar,
      title: '当前标准与最优标准'
    });
  }

  /* ---------- 面板四：机器学习 ---------- */

  function renderML() {
    state.ml.auc = parseFloat(q('mlAuc').value);
    state.ml.threshold = parseFloat(q('mlThreshold').value);
    var auc = state.ml.auc;
    var threshold = state.ml.threshold;

    q('mlAucValue').textContent = M.format(auc, 2);
    q('mlThresholdValue').textContent = M.format(threshold, 2);

    var dPrime = M.dPrimeFromAuc(auc);
    var xc = M.normInv(M.clamp(threshold, 0.01, 0.99));
    var probs = M.modelProbs(dPrime, xc - dPrime / 2, 1);
    var pH = probs.pH;
    var pFA = probs.pFA;

    var nPos = 1000;
    var nNeg = 4000;
    var TP = Math.round(nPos * pH);
    var FN = nPos - TP;
    var FP = Math.round(nNeg * pFA);
    var TN = nNeg - FP;
    var precision = (TP + FP) ? TP / (TP + FP) : NaN;
    var recall = nPos ? TP / nPos : NaN;
    var f1 = (precision + recall) ? 2 * precision * recall / (precision + recall) : NaN;
    var specificity = nNeg ? TN / nNeg : NaN;
    var accuracy = (TP + TN) / (nPos + nNeg);

    q('mlStats').innerHTML = [
      statCard('AUC', M.format(auc, 3), true),
      statCard("对应 d'", M.format(dPrime, 2), true),
      statCard('P(Hit) / Recall', M.format(recall, 3)),
      statCard('P(FA) / FPR', M.format(pFA, 3), true),
      statCard('Precision', M.format(precision, 3)),
      statCard('F1', M.format(f1, 3)),
      statCard('Specificity', M.format(specificity, 3)),
      statCard('Accuracy', M.format(accuracy, 3))
    ].join('');

    q('mlMatrix').innerHTML = matrixHTML('TP=' + TP, 'FN=' + FN, 'FP=' + FP, 'TN=' + TN);

    C.mlChart(q('mlChart'), {
      dPrime: dPrime,
      xc: xc,
      title: '自动分拣机的分数分布'
    });
  }

  /* ---------- 面板五：警觉模拟 ---------- */

  function renderVigilanceEmpty() {
    var empty = { x: [1, 2, 3, 4, 5, 6, 7, 8], y: [2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2] };
    C.lineChart(q('vigDChart'), {
      series: [{ name: "d'", color: '#2b5d8c', points: empty.x.map(function (x, i) { return [x, empty.y[i]]; }) }],
      xDomain: [1, 8],
      yDomain: [0, 3],
      xLabel: '15 分钟时段',
      yLabel: "d'",
      title: "d' 随时间变化（尚未运行）"
    });
    C.lineChart(q('vigCChart'), {
      series: [{ name: 'c', color: '#b93a2f', points: empty.x.map(function (x) { return [x, 0]; }) }],
      xDomain: [1, 8],
      yDomain: [-1, 1.5],
      xLabel: '15 分钟时段',
      yLabel: 'c',
      title: 'c 随时间变化（尚未运行）'
    });
  }

  function runVigilance() {
    var decline = q('vigD').checked;
    var shift = q('vigC').checked;
    var rng = M.mulberry32(Date.now() >>> 0);
    var baseD = 2.2;
    var baseC = 0;
    var blocks = 8;
    var dSeries = [];
    var cSeries = [];
    var hSeries = [];
    var faSeries = [];
    var totalH = 0;
    var totalFA = 0;

    for (var b = 0; b < blocks; b++) {
      var fraction = b / (blocks - 1);
      var trueD = decline ? baseD * (0.65 + 0.35 * (1 - fraction)) : baseD;
      var trueC = shift ? baseC + 0.9 * fraction : baseC;
      var probs = M.modelProbs(trueD, trueC, 1);
      var H = M.binomialSample(30, probs.pH, rng);
      var FA = M.binomialSample(270, probs.pFA, rng);
      var stats = M.calcStats({ H: H, M: 30 - H, FA: FA, CR: 270 - FA });
      dSeries.push([b + 1, stats.dPrime]);
      cSeries.push([b + 1, stats.c]);
      hSeries.push([b + 1, H / 30]);
      faSeries.push([b + 1, FA / 270]);
      totalH += H;
      totalFA += FA;
    }

    state.vig.last = { dSeries: dSeries, cSeries: cSeries, hSeries: hSeries, faSeries: faSeries };

    C.lineChart(q('vigDChart'), {
      series: [
        { name: "估计 d'", color: '#2b5d8c', points: dSeries },
        { name: 'P(Hit)', color: '#2f7d4f', points: hSeries, dash: '5 4' }
      ],
      xDomain: [1, 8],
      yDomain: [0, 3],
      xLabel: '15 分钟时段',
      yLabel: "d' / P(Hit)",
      title: "d' 随时间变化"
    });
    C.lineChart(q('vigCChart'), {
      series: [
        { name: '估计 c', color: '#b93a2f', points: cSeries },
        { name: 'P(FA)', color: '#d98a1f', points: faSeries, dash: '5 4' }
      ],
      xDomain: [1, 8],
      yDomain: [-1, 1.5],
      xLabel: '15 分钟时段',
      yLabel: 'c / P(FA)',
      title: 'c 随时间变化'
    });

    var firstD = dSeries[0][1];
    var lastD = dSeries[dSeries.length - 1][1];
    var firstC = cSeries[0][1];
    var lastC = cSeries[cSeries.length - 1][1];
    q('vigStats').innerHTML = [
      statCard('首段 d\'', M.format(firstD, 2)),
      statCard('末段 d\'', M.format(lastD, 2), true),
      statCard('d\' 变化', M.signed(lastD - firstD, 2), true),
      statCard('c 变化', M.signed(lastC - firstC, 2), true),
      statCard('总击中', totalH + ' / 240'),
      statCard('总误报', totalFA + ' / 2160')
    ].join('');
  }

  /* ---------- 标签切换 ---------- */

  function showTab(tab) {
    var buttons = document.querySelectorAll('#labTabs button');
    buttons.forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-tab') === tab);
    });
    var panels = document.querySelectorAll('.lab-panel');
    panels.forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'lab-' + tab);
    });
    if (tab === 'dist') renderDist();
    if (tab === 'roc') renderRoc();
    if (tab === 'payoff') renderPayoff();
    if (tab === 'ml') renderML();
    if (tab === 'vigilance') {
      if (state.vig.last) runVigilance();
      else renderVigilanceEmpty();
    }
  }

  function bindSlider(id, handler) {
    var element = q(id);
    if (element) {
      element.addEventListener('input', handler);
      element.addEventListener('change', handler);
    }
  }

  function init() {
    bindSlider('labDiff', renderDist);
    bindSlider('labC', renderDist);
    bindSlider('rocDiff', renderRoc);
    bindSlider('rocC', renderRoc);
    bindSlider('rocSigma', renderRoc);
    bindSlider('payPrior', renderPayoff);
    bindSlider('payC', renderPayoff);
    bindSlider('payD', renderPayoff);
    ['payVH', 'payVM', 'payVFA', 'payVCR'].forEach(function (id) {
      var input = q(id);
      if (input) {
        input.addEventListener('input', renderPayoff);
        input.addEventListener('change', renderPayoff);
      }
    });
    bindSlider('mlAuc', renderML);
    bindSlider('mlThreshold', renderML);

    document.querySelectorAll('#labTabs button').forEach(function (button) {
      button.addEventListener('click', function () {
        showTab(button.getAttribute('data-tab'));
      });
    });

    var runButton = q('btnRunVig');
    if (runButton) runButton.addEventListener('click', runVigilance);

    renderDist();
    renderRoc();
    renderPayoff();
    renderML();
    renderVigilanceEmpty();
  }

  NS.lab = {
    init: init,
    showTab: showTab
  };
})(window.CakeSDT = window.CakeSDT || {});
