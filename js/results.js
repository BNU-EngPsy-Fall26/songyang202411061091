/* =========================================================
   结果页渲染
   - 混淆矩阵、SDT 指标、结果解读、标准对比、期望收益
   ========================================================= */
(function (NS) {
  'use strict';

  var M = NS.math;

  function q(id) {
    return document.getElementById(id);
  }

  function statCard(label, value, highlight) {
    return '<div class="stat-card' + (highlight ? ' highlight' : '') + '">' +
      '<span class="stat-label">' + label + '</span>' +
      '<span class="stat-value">' + value + '</span>' +
      '</div>';
  }

  function renderStats(run) {
    var cards = [
      statCard('拦下率 P(Hit)', M.format(run.pH, 3), true),
      statCard('误扔率 P(FA)', M.format(run.pFA, 3)),
      statCard("分辨能力 d'", M.format(run.dPrime, 2), true),
      statCard('判断标准 c', M.signed(run.c, 2), true),
      statCard('似然比 β', M.format(run.beta, 2)),
      statCard('总判断正确率', M.pct(run.accuracy, 1)),
      statCard('平均反应时', isFinite(run.meanRT) ? M.format(run.meanRT, 0) + ' ms' : '—'),
      statCard("A'（非参数）", M.format(run.aPrime, 3))
    ];
    if (run.noResponseCount) {
      cards.push(statCard('超时未答', run.noResponseCount + ' 次'));
    }
    q('statsGrid').innerHTML = cards.join('');
  }

  function renderInterpretation(run) {
    var cStar = M.optimalC(run.pS, run.values, run.dPrime);
    var betaStar = M.optimalBeta(run.pS, run.values);
    var items = [];

    items.push({
      title: "分辨能力 d' = " + M.format(run.dPrime, 2),
      text: M.describeDPrime(run.dPrime) +
        "。d' 衡量的是你能不能分辨坏蛋糕和好蛋糕，和敢不敢冒险无关。"
    });

    items.push({
      title: '判断标准 c = ' + M.signed(run.c, 2),
      text: M.describeC(run.c) +
        "。负 c 表示标准偏宽松，宁可冒险也不想多扔；正 c 表示标准偏严格，宁可多扔也绝不卖出坏蛋糕。"
    });

    items.push({
      title: '总判断正确率 = ' + M.pct(run.accuracy, 1),
      text: '总正确率同时受到 d\' 和 c 的影响。两位店主的正确率可能一样，但一个靠分辨能力，一个靠冒险或保守的策略。'
    });

    if (isFinite(cStar)) {
      items.push({
        title: '考虑后果后的最优标准 c* = ' + M.signed(cStar, 2),
        text: '最优 β = ' + M.format(betaStar, 2) +
          '。你的 c 与 c* 的差值为 ' + M.signed(run.c - cStar, 2) +
          '。卖出坏蛋糕的后果越严重，最优标准越应该往负方向移动。'
      });
    }

    q('interpretation').innerHTML = items.map(function (item) {
      return '<div class="interpretation-item"><strong>' + item.title + '</strong><p>' + item.text + '</p></div>';
    }).join('');
  }

  function renderComparison(run) {
    var rows = [
      { name: '谨慎店主（宁可多扔）', pH: 0.60, pFA: 0.10, d: 1.80, c: 0.51, acc: 0.75 },
      { name: '宽松店主（宁可冒险）', pH: 0.90, pFA: 0.40, d: 1.80, c: -0.51, acc: 0.75 },
      {
        name: '你',
        pH: run.pH,
        pFA: run.pFA,
        d: run.dPrime,
        c: run.c,
        acc: run.accuracy,
        highlight: true
      }
    ];

    var tbody = q('comparisonTable').querySelector('tbody');
    tbody.innerHTML = rows.map(function (row) {
      return '<tr' + (row.highlight ? ' style="background:#fdf0da;font-weight:700;"' : '') + '>' +
        '<td>' + row.name + '</td>' +
        '<td class="num">' + M.format(row.pH, 2) + '</td>' +
        '<td class="num">' + M.format(row.pFA, 2) + '</td>' +
        '<td class="num">' + M.format(row.d, 2) + '</td>' +
        '<td class="num">' + M.signed(row.c, 2) + '</td>' +
        '<td class="num">' + M.pct(row.acc, 0) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderPayoff(run) {
    var values = run.values;
    var cStar = M.optimalC(run.pS, values, run.dPrime);
    var betaStar = M.optimalBeta(run.pS, values);
    var degenerate = !isFinite(cStar) || run.dPrime <= 0.05;
    var gap = NaN;
    var message;

    if (degenerate) {
      message = "本局 d' 接近 0，说明你还没有表现出稳定的区分能力。" +
        '当敏感性接近 0 时，最优策略会退化为始终选择收益更高的一侧，' +
        '因此最优标准 c* 不能用有限数值表示。';
    } else {
      var yourProbs = M.modelProbs(run.dPrime, run.c, 1);
      var optimalProbs = M.modelProbs(run.dPrime, cStar, 1);
      var yourEV = M.expectedValue(yourProbs, run.pS, values);
      var optimalEV = M.expectedValue(optimalProbs, run.pS, values);
      gap = (optimalEV - yourEV) * 100;
      if (gap > 5) {
        message = '你的判断标准和今晚的后果设定不太匹配。如果每 100 个晚上都这样判断，调整到最优标准大约可以多挽回 ' +
          M.format(gap, 1) + ' 个收益点。';
      } else if (gap > 0) {
        message = '你的判断标准已经接近最优，如果每 100 个晚上都这样判断，差距约为 ' +
          M.format(gap, 1) + ' 个收益点。';
      } else {
        message = '你的判断标准在这个代价结构下已经非常接近最优，继续保持。';
      }
    }

    q('payoffAnalysis').innerHTML = [
      '<div class="payoff-box"><span>你的 c</span><strong>' + M.signed(run.c, 2) + '</strong></div>',
      '<div class="payoff-box"><span>最优 c*</span><strong>' + (degenerate ? '不可估计' : M.format(cStar, 2)) + '</strong></div>',
      '<div class="payoff-box"><span>每 100 块蛋糕的期望收益差</span><strong>' + (degenerate ? '—' : M.format(gap, 1)) + '</strong></div>',
      '<div class="payoff-box" style="grid-column:1/-1;"><span>解读</span><p style="margin:6px 0 0;color:#3d4b59;">' + message + '</p></div>'
    ].join('');
  }

  function renderEnding(run) {
    var nSig = run.H + run.M;
    var nNoise = run.FA + run.CR;
    var missRate = nSig ? run.M / nSig : 0;
    var faRate = nNoise ? run.FA / nNoise : 0;
    var title;
    var text;
    var tone;

    if (missRate <= 0.2 && faRate <= 0.2) {
      title = '完美的一炉';
      tone = 'good';
      text = '没有一块坏蛋糕流出去，也没有浪费太多好蛋糕。第二天，甜点节顺利开幕，你的店门口排起了长队。';
    } else if (missRate <= 0.2 && faRate > 0.2) {
      title = '宁可多扔的一晚';
      tone = 'warn';
      text = '坏蛋糕都被你拦下了，但你扔掉了不少好蛋糕。订单勉强交上，利润薄了一些，至少没有人吃坏肚子。';
    } else if (missRate > 0.2 && faRate <= 0.2) {
      title = '有人吃坏了肚子';
      tone = 'bad';
      text = '有几块坏蛋糕被你摆上了货架。第二天，店里收到了顾客的投诉，甜点节变得不那么顺利。';
    } else {
      title = '最糟糕的一晚';
      tone = 'bad';
      text = '坏蛋糕流了出去，好蛋糕也被你扔掉不少。你既收到了投诉，又没能完成订单。';
    }

    var stats = [
      { label: '拦下的坏蛋糕', value: run.H + ' 块' },
      { label: '卖出的坏蛋糕', value: run.M + ' 块' },
      { label: '扔掉的好蛋糕', value: run.FA + ' 块' },
      { label: '顺利上架的好蛋糕', value: run.CR + ' 块' }
    ];

    var extra = '';
    if (missRate > 0.2) {
      extra = '<p class="ending-extra">你的漏报率是 ' + M.pct(missRate, 0) +
        '：标准放得太松，坏蛋糕更容易溜出去。</p>';
    } else if (faRate > 0.2) {
      extra = '<p class="ending-extra">你的误报率是 ' + M.pct(faRate, 0) +
        '：标准收得太紧，很多好蛋糕被浪费了。</p>';
    }

    q('storyEnding').innerHTML =
      '<div class="ending-badge ' + tone + '">今晚的结局</div>' +
      '<h2 class="ending-title">' + title + '</h2>' +
      '<p class="ending-text">' + text + '</p>' +
      '<div class="ending-stats">' + stats.map(function (item) {
        return '<div class="ending-stat"><span>' + item.label + '</span><strong>' + item.value + '</strong></div>';
      }).join('') + '</div>' + extra;
  }

  function render(run) {
    NS.results.lastRun = run;
    q('resTitle').textContent = '最后一炉的结果';
    q('resSub').textContent = (run.name || '游客') + ' · 今晚 20 块蛋糕 · 分辨难度 d\' = ' +
      M.format(run.systemDPrime, 2) + ' · 坏蛋糕比例 P(S) = ' + M.pct(run.pS, 0) +
      ' · ' + new Date(run.timestamp).toLocaleString('zh-CN');

    q('resH').textContent = 'H = ' + run.H;
    q('resFA').textContent = 'FA = ' + run.FA;
    q('resM').textContent = 'M = ' + run.M;
    q('resCR').textContent = 'CR = ' + run.CR;

    renderEnding(run);
    renderStats(run);
    renderInterpretation(run);
    renderComparison(run);
    renderPayoff(run);
  }

  function exportRunCSV(run) {
    var header = [
      '时间', '姓名', '学号', '系统d\'', 'P(S)',
      'H', 'M', 'FA', 'CR',
      'P(Hit)', 'P(FA)', 'd\'', 'c', 'beta', '准确率', '平均反应时(ms)'
    ];
    var row = [
      new Date(run.timestamp).toLocaleString('zh-CN'),
      run.name || '游客',
      run.studentId || '',
      M.format(run.systemDPrime, 2),
      M.format(run.pS, 2),
      run.H, run.M, run.FA, run.CR,
      M.format(run.pH, 4),
      M.format(run.pFA, 4),
      M.format(run.dPrime, 4),
      M.format(run.c, 4),
      M.format(run.beta, 4),
      M.format(run.accuracy, 4),
      M.format(run.meanRT, 0)
    ];
    var csv = [header, row].map(function (line) {
      return line.map(M.csvEscape).join(',');
    }).join('\r\n');
    NS.history.download(
      'cake-sdt-run-' + String(run.id).slice(-6) + '.csv',
      '\uFEFF' + csv,
      'text/csv;charset=utf-8'
    );
  }

  NS.results = {
    render: render,
    exportRunCSV: exportRunCSV
  };
})(window.CakeSDT = window.CakeSDT || {});
