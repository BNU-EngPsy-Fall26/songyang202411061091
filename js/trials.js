/* =========================================================
   试次生成器
   - 每局固定 20 次
   - 根据 P(S) 预先确定信号 / 噪音试次数
   - 打乱顺序，并限制连续同类不超过 3 次
   ========================================================= */
(function (NS) {
  'use strict';

  var M = NS.math;
  var TRIAL_COUNT = 20;

  function generateTrials(options) {
    options = options || {};
    var n = options.n || TRIAL_COUNT;
    var pS = options.pS === undefined ? 0.5 : options.pS;
    var dPrime = options.dPrime === undefined ? 1.8 : options.dPrime;
    var seed = options.seed === undefined ? Date.now() : options.seed;
    var rng = M.mulberry32(seed >>> 0);

    var nSig = Math.round(n * pS);
    nSig = M.clamp(nSig, 2, n - 2);
    var nNoise = n - nSig;

    var types = [];
    var i;
    for (i = 0; i < nSig; i++) types.push(1);
    for (i = 0; i < nNoise; i++) types.push(0);

    var order = null;
    for (var attempt = 0; attempt < 300; attempt++) {
      order = M.shuffle(types, rng);
      if (M.maxRun(order) <= 3) break;
    }

    return order.map(function (signal, index) {
      var s = signal
        ? M.randn(rng) + dPrime
        : M.randn(rng);

      return {
        index: index,
        signal: signal === 1,
        s: s,
        seed: Math.floor(rng() * 2147483647),
        angle: rng() * Math.PI * 2,
        radius: 0.16 + rng() * 0.42
      };
    });
  }

  NS.trials = {
    TRIAL_COUNT: TRIAL_COUNT,
    generateTrials: generateTrials
  };
})(window.CakeSDT = window.CakeSDT || {});
