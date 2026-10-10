/* =========================================================
   应用入口
   - 页面切换、登录、首页参数、历史记录、导航
   ========================================================= */
(function (NS) {
  'use strict';

  var M = NS.math;
  var C = NS.charts;
  var USER_KEY = 'cakesdt.user.v1';

  var state = {
    user: { name: '', studentId: '', isGuest: true },
    dPrime: 1.8,
    pS: 0.5,
    values: { VH: 10, VM: -20, VFA: -2, VCR: 5 },
    voice: true
  };

  function q(id) {
    return document.getElementById(id);
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (screen) {
      screen.classList.toggle('active', screen.id === id);
    });
    window.scrollTo(0, 0);
    if (id === 'screen-history') renderHistory();
    if (id === 'screen-lab') {
      var activeTab = document.querySelector('#labTabs button.active');
      NS.lab.showTab(activeTab ? activeTab.getAttribute('data-tab') : 'dist');
    }
  }

  function saveUser() {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    } catch (error) {
      console.warn('保存用户信息失败：', error);
    }
  }

  function restoreUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.name) return false;
      state.user = parsed;
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearUser() {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (error) {
      console.warn('清除用户信息失败：', error);
    }
  }

  function updateHomeUser() {
    var label = state.user.name || '游客';
    if (!state.user.isGuest && state.user.studentId) label += ' · ' + state.user.studentId;
    q('homeUser').textContent = label;
  }

  function renderHomePreview() {
    q('diffValue').textContent = M.format(state.dPrime, 1);
    C.distributionChart(q('homePreview'), {
      dPrime: state.dPrime,
      c: 0,
      width: 640,
      height: 220,
      compact: true,
      xTicks: 4,
      yTicks: 2,
      title: ''
    });
  }

  function goHome() {
    updateHomeUser();
    showScreen('screen-home');
    renderHomePreview();
  }

  function startGame() {
    NS.game.startRun({
      name: state.user.name || '游客',
      studentId: state.user.studentId || '',
      isGuest: state.user.isGuest,
      dPrime: state.dPrime,
      pS: state.pS,
      values: state.values,
      voice: state.voice
    });
  }

  /* ---------- 历史记录 ---------- */

  function summaryCard(label, value) {
    return '<div class="summary-card"><span>' + label + '</span><strong>' + value + '</strong></div>';
  }

  function emptyChart(svg, text) {
    C.clear(svg);
    svg.setAttribute('viewBox', '0 0 720 340');
    svg.appendChild(C.el('text', {
      x: 360, y: 170,
      'text-anchor': 'middle',
      'font-size': 14,
      fill: '#6b7785'
    }, text));
  }

  function renderHistory() {
    var runs = NS.history.loadRuns();
    var summary = NS.history.summarize(runs);

    q('historySummary').innerHTML = [
      summaryCard('总局数', summary.count),
      summaryCard('最佳 d\'', summary.count ? M.format(summary.bestDPrime, 2) : '—'),
      summaryCard('平均 c', summary.count ? M.signed(summary.meanC, 2) : '—'),
      summaryCard('平均准确率', summary.count ? M.pct(summary.meanAccuracy, 1) : '—'),
      summaryCard('平均反应时', summary.count && isFinite(summary.meanRT) ? M.format(summary.meanRT, 0) + ' ms' : '—')
    ].join('');

    if (!runs.length) {
      emptyChart(q('historyTrendChart'), '还没有记录，先完成一局质检。');
      emptyChart(q('historyRocChart'), '完成一局后，这里会出现你的 ROC 点。');
      q('historyList').innerHTML = '<div class="empty-state">暂无历史记录。</div>';
      return;
    }

    var chronological = runs.slice().reverse();
    var xValues = chronological.map(function (_, index) { return index + 1; });
    var dPoints = chronological.map(function (run, index) { return [index + 1, run.dPrime]; });
    var cPoints = chronological.map(function (run, index) { return [index + 1, run.c]; });
    var allY = dPoints.concat(cPoints).map(function (point) { return point[1]; });
    var minY = Math.min.apply(null, allY.concat([0]));
    var maxY = Math.max.apply(null, allY.concat([1]));
    var pad = Math.max(0.3, (maxY - minY) * 0.15);

    C.lineChart(q('historyTrendChart'), {
      series: [
        { name: "d'", color: '#2b5d8c', points: dPoints },
        { name: 'c', color: '#b93a2f', points: cPoints }
      ],
      xDomain: xValues.length === 1 ? [0.5, 1.5] : [1, xValues.length],
      yDomain: [minY - pad, maxY + pad],
      xTicks: Math.max(1, Math.min(8, xValues.length - 1)),
      yTicks: 5,
      xLabel: '第几局',
      yLabel: "d' / c",
      title: '多局 d\' 与 c 趋势',
      zeroLine: true
    });

    var rocPoints = runs.map(function (run) {
      var nSig = run.H + run.M || 1;
      var nNoise = run.FA + run.CR || 1;
      return {
        x: (run.FA + 0.5) / (nNoise + 1),
        y: (run.H + 0.5) / (nSig + 1),
        color: '#2b5d8c',
        r: 5,
        opacity: 0.8
      };
    });
    C.scatter(q('historyRocChart'), {
      points: rocPoints,
      xDomain: [0, 1],
      yDomain: [0, 1],
      xLabel: 'P(FA) →',
      yLabel: 'P(Hit) →',
      title: '每局一个 ROC 点',
      diagonal: true
    });

    q('historyList').innerHTML = runs.map(function (run) {
      return '<div class="history-row" data-id="' + run.id + '">' +
        '<div><strong>' + new Date(run.timestamp).toLocaleString('zh-CN') + '</strong>' +
        '<div class="history-time">' + M.escapeHtml(run.name || '游客') + ' · d\'=' + M.format(run.systemDPrime, 1) +
        ' · P(S)=' + M.pct(run.pS, 0) + '</div></div>' +
        '<div class="num">d\' ' + M.format(run.dPrime, 2) + '</div>' +
        '<div class="num">c ' + M.signed(run.c, 2) + '</div>' +
        '<div class="num">' + M.pct(run.accuracy, 1) + '</div>' +
        '<div class="num">' + (isFinite(run.meanRT) ? M.format(run.meanRT, 0) + ' ms' : '—') + '</div>' +
        '<div class="num">H' + run.H + ' / FA' + run.FA + '</div>' +
        '<button class="btn btn-small btn-danger-ghost" data-delete="' + run.id + '">删除</button>' +
        '</div>';
    }).join('');

    q('historyList').querySelectorAll('[data-delete]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-delete');
        if (window.confirm('确定删除这条记录吗？')) {
          NS.history.removeRun(id);
          renderHistory();
        }
      });
    });
  }

  /* ---------- 事件绑定 ---------- */

  function bindLogin() {
    q('btnLogin').addEventListener('click', function () {
      var name = q('loginName').value.trim();
      var studentId = q('loginId').value.trim();
      if (!name) {
        q('loginMsg').textContent = '请输入姓名或昵称。';
        q('loginName').focus();
        return;
      }
      state.user = { name: name, studentId: studentId, isGuest: false };
      saveUser();
      goHome();
    });

    q('btnGuest').addEventListener('click', function () {
      state.user = { name: '游客', studentId: '', isGuest: true };
      saveUser();
      goHome();
    });

    q('loginName').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') q('btnLogin').click();
    });
  }

  function bindHome() {
    q('diffSlider').addEventListener('input', function () {
      state.dPrime = parseFloat(q('diffSlider').value);
      renderHomePreview();
    });

    document.querySelectorAll('#priorGroup button').forEach(function (button) {
      button.addEventListener('click', function () {
        document.querySelectorAll('#priorGroup button').forEach(function (item) {
          item.classList.remove('active');
        });
        button.classList.add('active');
        state.pS = parseFloat(button.getAttribute('data-prior'));
        var nSig = Math.round(20 * state.pS);
        q('priorHint').textContent = '课堂模式：20 次中约 ' + nSig + ' 次为霉变蛋糕。';
      });
    });

    q('btnStart').addEventListener('click', startGame);
    q('btnReplay').addEventListener('click', startGame);
    q('btnLogout').addEventListener('click', function () {
      clearUser();
      state.user = { name: '', studentId: '', isGuest: true };
      q('loginMsg').textContent = '';
      showScreen('screen-login');
    });

    q('btnLab').addEventListener('click', function () { showScreen('screen-lab'); });
    q('btnHistory').addEventListener('click', function () { showScreen('screen-history'); });
    q('btnResultsLab').addEventListener('click', function () { showScreen('screen-lab'); });
    q('btnResultsHistory').addEventListener('click', function () { showScreen('screen-history'); });
    q('btnExportRun').addEventListener('click', function () {
      if (NS.results.lastRun) NS.results.exportRunCSV(NS.results.lastRun);
    });
  }

  function bindNavigation() {
    q('btnLabBack').addEventListener('click', goHome);
    q('btnHistoryBack').addEventListener('click', goHome);

    q('btnExportHistoryCsv').addEventListener('click', function () {
      NS.history.exportCSV();
    });
    q('btnExportHistoryJson').addEventListener('click', function () {
      NS.history.exportJSON();
    });
    q('importHistory').addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      NS.history.importJSON(file).then(function () {
        renderHistory();
      }).catch(function (error) {
        window.alert('导入失败：' + error.message);
      });
      event.target.value = '';
    });
    q('btnClearHistory').addEventListener('click', function () {
      if (window.confirm('确定清空本机所有历史记录吗？此操作不可撤销。')) {
        NS.history.clearRuns();
        renderHistory();
      }
    });
  }

  function init() {
    bindLogin();
    bindHome();
    bindNavigation();
    NS.game.init();
    NS.lab.init();

    q('diffSlider').value = state.dPrime;
    renderHomePreview();

    if (restoreUser()) {
      goHome();
    } else {
      showScreen('screen-login');
    }
  }

  NS.app = {
    showScreen: showScreen,
    state: state,
    init: init
  };

  document.addEventListener('DOMContentLoaded', init);
})(window.CakeSDT = window.CakeSDT || {});
