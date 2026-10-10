/* =========================================================
   游戏引擎
   - 20 试次流程
   - 键盘 F / 1 = 合格，J / 2 = 不合格
   - 记录反应时，结束后计算 SDT 指标并写入本机历史
   - 刺激限时呈现：超过反应时限按“合格（无信号）”计入结果
   ========================================================= */
(function (NS) {
  'use strict';

  var M = NS.math;
  var T = NS.trials;
  var R = NS.render;

  var PRESTIM_MS = 620;      /* 质检灯扫描、刺激出现前的准备时间 */
  var STIMULUS_MS = 2500;    /* 刺激呈现时长 */
  var GRACE_MS = 2000;       /* 刺激消失后允许作答的宽限时间 */

  var state = {
    active: false,
    name: '游客',
    studentId: '',
    isGuest: true,
    dPrime: 1.8,
    pS: 0.5,
    values: { VH: 10, VM: -20, VFA: -2, VCR: 5 },
    voice: true,
    trials: [],
    index: 0,
    counts: { H: 0, M: 0, FA: 0, CR: 0 },
    rts: [],
    current: null,
    phase: 'idle',
    showSpot: false,
    revealTime: 0,
    responseEnabled: false,
    awaiting: false,
    lastResult: null,
    resultTime: 0,
    stimulusOnset: 0,
    stimulusDeadline: 0,
    stimulusVisible: false,
    noResponseCount: 0,
    time: 0,
    raf: null,
    startedAt: 0,
    canvas: null
  };

  var els = {};
  var revealTimer = null;
  var stimulusOffTimer = null;
  var deadlineTimer = null;
  var nextTimer = null;

  function q(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    els.canvas = q('gameCanvas');
    els.trialNum = q('trialNum');
    els.trialCounter = q('trialCounter');
    els.instruction = q('gameInstruction');
    els.feedback = q('gameFeedback');
    els.btnPass = q('btnPass');
    els.btnFail = q('btnFail');
  }

  function updateHud() {
    if (els.trialNum) els.trialNum.textContent = String(Math.min(state.index + 1, T.TRIAL_COUNT));
    if (els.trialCounter) {
      var recorded = state.counts.H + state.counts.M + state.counts.FA + state.counts.CR;
      els.trialCounter.textContent = '已记录 ' + recorded + ' 次';
    }
  }

  function setInstruction(text) {
    if (els.instruction) els.instruction.textContent = text;
  }

  function setFeedback(text, className) {
    if (!els.feedback) return;
    els.feedback.textContent = text || '';
    els.feedback.className = 'feedback ' + (className || '');
  }

  function setResponseEnabled(enabled) {
    state.responseEnabled = enabled;
    if (els.btnPass) els.btnPass.disabled = !enabled;
    if (els.btnFail) els.btnFail.disabled = !enabled;
  }

  function resetState(config) {
    config = config || {};
    if (config.name !== undefined) state.name = config.name;
    if (config.studentId !== undefined) state.studentId = config.studentId;
    if (config.isGuest !== undefined) state.isGuest = config.isGuest;
    if (config.dPrime !== undefined) state.dPrime = config.dPrime;
    if (config.pS !== undefined) state.pS = config.pS;
    if (config.values) state.values = config.values;
    if (config.voice !== undefined) state.voice = config.voice;

    state.trials = T.generateTrials({
      n: T.TRIAL_COUNT,
      pS: state.pS,
      dPrime: state.dPrime,
      seed: Date.now()
    });
    state.index = 0;
    state.counts = { H: 0, M: 0, FA: 0, CR: 0 };
    state.rts = [];
    state.current = null;
    state.phase = 'idle';
    state.showSpot = false;
    state.revealTime = 0;
    state.responseEnabled = false;
    state.awaiting = false;
    state.lastResult = null;
    state.resultTime = 0;
    state.stimulusOnset = 0;
    state.stimulusDeadline = 0;
    state.stimulusVisible = false;
    state.noResponseCount = 0;
    state.startedAt = Date.now();
  }

  function startRun(config) {
    resetState(config);
    state.active = true;
    state.canvas = els.canvas;
    R.prepare(state.canvas);
    updateHud();
    setFeedback('', '');
    setResponseEnabled(false);
    setInstruction('样本正在进入质检台……');
    if (NS.app && NS.app.showScreen) NS.app.showScreen('screen-game');
    startLoop();
    nextTrial();
  }

  function nextTrial() {
    if (!state.active) return;
    if (state.index >= state.trials.length) {
      finish();
      return;
    }

    state.current = state.trials[state.index];
    state.phase = 'wait';
    state.showSpot = false;
    state.stimulusVisible = false;
    state.revealTime = 0;
    state.stimulusOnset = 0;
    state.stimulusDeadline = 0;
    state.awaiting = false;
    state.lastResult = null;
    setResponseEnabled(false);
    setFeedback('', '');
    setInstruction('样本进入质检台，等待质检灯扫描……');
    updateHud();

    clearTimeout(revealTimer);
    clearTimeout(stimulusOffTimer);
    clearTimeout(deadlineTimer);
    revealTimer = setTimeout(function () {
      if (!state.active || !state.current) return;
      state.showSpot = true;
      state.stimulusVisible = true;
      state.phase = 'judge';
      state.revealTime = performance.now();
      state.stimulusOnset = state.revealTime;
      state.stimulusDeadline = state.revealTime + STIMULUS_MS + GRACE_MS;
      setResponseEnabled(true);
      setInstruction('刺激呈现约 ' + (STIMULUS_MS / 1000).toFixed(1) + ' 秒，请尽快判断：合格，还是不合格？');

      /* 刺激限时：到时后刺激消失 */
      stimulusOffTimer = setTimeout(function () {
        if (!state.active || state.awaiting) return;
        state.showSpot = false;
        state.stimulusVisible = false;
        setInstruction('刺激已消失，请在剩余时间内作答。');
      }, STIMULUS_MS);

      /* 反应时限：超时未作答自动计入 */
      deadlineTimer = setTimeout(function () {
        if (!state.active || state.awaiting) return;
        respond('timeout');
      }, STIMULUS_MS + GRACE_MS);
    }, PRESTIM_MS);
  }

  function countResponse(signalPresent, saidSignal) {
    if (signalPresent && saidSignal) return 'H';
    if (signalPresent && !saidSignal) return 'M';
    if (!signalPresent && saidSignal) return 'FA';
    return 'CR';
  }

  function respond(choice) {
    if (!state.active || !state.responseEnabled || !state.current || state.awaiting) return;
    state.awaiting = true;
    setResponseEnabled(false);
    clearTimeout(stimulusOffTimer);
    clearTimeout(deadlineTimer);

    var isTimeout = choice === 'timeout';
    var saidSignal = choice === 'signal';
    var signalPresent = state.current.signal;
    var type = countResponse(signalPresent, saidSignal);
    var rt = isTimeout ? null : (performance.now() - state.revealTime);
    state.counts[type]++;
    if (rt !== null) state.rts.push(rt);
    if (isTimeout) state.noResponseCount++;
    state.current.response = isTimeout ? 'timeout' : (saidSignal ? 'signal' : 'noise');
    state.current.rt = rt;
    state.current.type = type;
    state.current.correct = (type === 'H' || type === 'CR');
    state.phase = 'feedback';
    updateHud();

    var labels = { H: '击中', M: '漏报', FA: '误报', CR: '正确拒斥' };
    var details = {
      H: '实际有霉变，你判了不合格。',
      M: '实际有霉变，你判了合格。',
      FA: '实际没有霉变，你判了不合格。',
      CR: '实际没有霉变，你判了合格。'
    };
    var className = (type === 'H' || type === 'CR') ? 'correct' : 'wrong';
    var displayLabel;
    var displayType;
    var displayDetail;

    if (isTimeout) {
      displayLabel = '超时未答';
      displayType = '';
      displayDetail = (signalPresent ? '实际有霉变。' : '实际没有霉变。') + '按“合格”计入结果。';
      className = 'wrong';
    } else {
      displayLabel = labels[type];
      displayType = type;
      displayDetail = details[type];
    }

    state.lastResult = {
      type: displayType,
      label: displayLabel,
      detail: displayDetail,
      correct: className === 'correct'
    };
    state.resultTime = performance.now();
    setFeedback(displayLabel + (displayType ? ' ' + displayType : '') + '｜' + displayDetail, className);
    speakResult(displayLabel);

    clearTimeout(nextTimer);
    nextTimer = setTimeout(function () {
      state.index++;
      state.awaiting = false;
      nextTrial();
    }, 1450);
  }

  function speakResult(text) {
    if (!state.voice) return;
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    try {
      window.speechSynthesis.cancel();
      var utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.08;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      /* 部分浏览器不允许自动语音，静默忽略即可 */
    }
  }

  function buildRun() {
    var stats = M.calcStats(state.counts, { rts: state.rts });
    return {
      id: 'run-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
      timestamp: new Date().toISOString(),
      name: state.name || '游客',
      studentId: state.studentId || '',
      isGuest: state.isGuest,
      systemDPrime: state.dPrime,
      pS: state.pS,
      values: state.values,
      H: stats.H,
      M: stats.M,
      FA: stats.FA,
      CR: stats.CR,
      pH: stats.pH,
      pFA: stats.pFA,
      pHcorr: stats.pHcorr,
      pFAcorr: stats.pFAcorr,
      dPrime: stats.dPrime,
      c: stats.c,
      beta: stats.beta,
      accuracy: stats.accuracy,
      aPrime: stats.aPrime,
      meanRT: stats.meanRT,
      noResponseCount: state.noResponseCount,
      durationMs: Date.now() - state.startedAt,
      trials: state.trials.map(function (trial) {
        return {
          signal: trial.signal,
          s: trial.s,
          response: trial.response || null,
          rt: trial.rt || null,
          type: trial.type || null
        };
      })
    };
  }

  function finish() {
    state.active = false;
    stopLoop();
    setResponseEnabled(false);
    setInstruction('本局完成，正在生成质检报告……');
    var run = buildRun();
    NS.history.addRun(run);
    NS.results.render(run);
    if (NS.app && NS.app.showScreen) NS.app.showScreen('screen-results');
  }

  function loop(timestamp) {
    if (!state.active) return;
    state.time = timestamp;
    R.drawScene(state.canvas, state);
    state.raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    stopLoop();
    state.raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
  }

  function handleKey(event) {
    if (!state.active || !state.responseEnabled) return;
    var key = event.key ? event.key.toLowerCase() : '';
    if (key === 'f' || key === '1') {
      event.preventDefault();
      respond('noise');
    } else if (key === 'j' || key === '2') {
      event.preventDefault();
      respond('signal');
    }
  }

  function handleResize() {
    if (state.canvas && state.active) {
      R.prepare(state.canvas);
      R.drawScene(state.canvas, state);
    } else if (state.canvas && q('screen-game').classList.contains('active')) {
      R.prepare(state.canvas);
      R.drawScene(state.canvas, {
        time: 0,
        showSpot: false,
        s: 0,
        seed: 1,
        angle: 0,
        radius: 0.3,
        trialIndex: 0,
        total: T.TRIAL_COUNT
      });
    }
  }

  function init() {
    cacheElements();
    if (els.btnPass) els.btnPass.addEventListener('click', function () { respond('noise'); });
    if (els.btnFail) els.btnFail.addEventListener('click', function () { respond('signal'); });
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
  }

  NS.game = {
    init: init,
    startRun: startRun,
    respond: respond,
    state: state,
    buildRun: buildRun
  };
})(window.CakeSDT = window.CakeSDT || {});
