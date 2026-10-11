/* =========================================================
   数学工具
   - 正态分布、d'、c、β、A'、AUC
   - 极端率的 log-linear 修正
   - 可复现随机数
   ========================================================= */
(function (NS) {
  'use strict';

  var SQRT2 = Math.SQRT2;

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /* 稳定的 32 位伪随机数生成器，便于复现试次 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Box-Muller 标准正态随机数 */
  function randn(rng) {
    var u = 0;
    var v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* Abramowitz & Stegun 7.1.26，精度足够课堂可视化使用 */
  function erf(x) {
    var sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * y;
  }

  function normCdf(z) {
    return 0.5 * (1 + erf(z / SQRT2));
  }

  function normPdf(z) {
    return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  }

  /* Acklam 逆正态算法，加一步 Halley 修正 */
  function normInv(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;

    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
      1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
      6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
      3.754408661907416e+00];

    var plow = 0.02425;
    var phigh = 1 - plow;
    var q;
    var r;
    var x;

    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p > phigh) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else {
      q = p - 0.5;
      r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }

    /* Halley 修正 */
    var e = normCdf(x) - p;
    var u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    x = x - u / (1 + x * u / 2);
    return x;
  }

  /* log-linear 修正：避免 0 或 1 导致 d' 无穷大 */
  function correctedRate(count, total) {
    return (count + 0.5) / (total + 1);
  }

  function zFromCounts(count, total) {
    return normInv(correctedRate(count, total));
  }

  /* 由 z(H)、z(FA) 计算 β（信号分布 / 噪音分布的似然比） */
  function betaFromZ(zH, zFA) {
    return Math.exp((zFA * zFA - zH * zH) / 2);
  }

  function aPrime(hitRate, faRate) {
    var h = clamp(hitRate, 0.001, 0.999);
    var f = clamp(faRate, 0.001, 0.999);
    if (h >= f) {
      return 0.5 + ((h - f) * (1 + h - f)) / (4 * h * (1 - f));
    }
    return 0.5 - ((f - h) * (1 + f - h)) / (4 * f * (1 - h));
  }

  /* 由四格计数计算完整 SDT 指标 */
  function calcStats(counts, options) {
    options = options || {};
    var H = counts.H || 0;
    var M = counts.M || 0;
    var FA = counts.FA || 0;
    var CR = counts.CR || 0;
    var nSig = H + M;
    var nNoise = FA + CR;
    var n = nSig + nNoise;

    var pHRaw = nSig ? H / nSig : NaN;
    var pFARaw = nNoise ? FA / nNoise : NaN;
    var pH = correctedRate(H, nSig);
    var pFA = correctedRate(FA, nNoise);
    var zH = normInv(pH);
    var zFA = normInv(pFA);
    var dPrime = zH - zFA;
    var c = -0.5 * (zH + zFA);
    var beta = betaFromZ(zH, zFA);
    var accuracy = n ? (H + CR) / n : NaN;
    var meanRT = NaN;

    if (options.rts && options.rts.length) {
      var sum = 0;
      for (var i = 0; i < options.rts.length; i++) sum += options.rts[i];
      meanRT = sum / options.rts.length;
    }

    return {
      H: H, M: M, FA: FA, CR: CR,
      nSig: nSig, nNoise: nNoise, n: n,
      pH: pHRaw, pFA: pFARaw,
      pHcorr: pH, pFAcorr: pFA,
      zH: zH, zFA: zFA,
      dPrime: dPrime,
      c: c,
      beta: beta,
      accuracy: accuracy,
      aPrime: aPrime(pH, pFA),
      meanRT: meanRT
    };
  }

  /* 给定 d'、c，计算理论命中率和误报率 */
  function modelProbs(dPrime, c, sigmaSignal) {
    var sigma = sigmaSignal || 1;
    var xc = c + dPrime / 2;
    return {
      xc: xc,
      pH: 1 - normCdf((xc - dPrime) / sigma),
      pFA: 1 - normCdf(xc)
    };
  }

  /* 最优 β（信号 / 噪音似然比） */
  function optimalBeta(pS, values) {
    var pN = 1 - pS;
    var numerator = values.VCR - values.VFA;
    var denominator = values.VH - values.VM;
    if (denominator === 0) return NaN;
    return (pN / pS) * (numerator / denominator);
  }

  /* 最优 c，与 c = -0.5(zH+zFA) 的定义一致 */
  function optimalC(pS, values, dPrime) {
    var beta = optimalBeta(pS, values);
    if (!isFinite(beta) || beta <= 0 || dPrime <= 0) return NaN;
    return Math.log(beta) / dPrime;
  }

  function aucFromDPrime(dPrime) {
    return normCdf(dPrime / SQRT2);
  }

  function dPrimeFromAuc(auc) {
    return SQRT2 * normInv(clamp(auc, 0.5001, 0.9999));
  }

  /* 期望收益：P(S) * [H*V(H) + M*V(M)] + P(N) * [FA*V(FA) + CR*V(CR)] */
  function expectedValue(probs, pS, values) {
    var pN = 1 - pS;
    var signalPart = probs.pH * values.VH + (1 - probs.pH) * values.VM;
    var noisePart = probs.pFA * values.VFA + (1 - probs.pFA) * values.VCR;
    return pS * signalPart + pN * noisePart;
  }

  function binomialSample(trials, probability, rng) {
    var success = 0;
    for (var i = 0; i < trials; i++) {
      if (rng() < probability) success++;
    }
    return success;
  }

  function shuffle(array, rng) {
    var result = array.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result;
  }

  function maxRun(array) {
    var max = 0;
    var run = 0;
    var previous = null;
    for (var i = 0; i < array.length; i++) {
      if (array[i] === previous) {
        run++;
      } else {
        run = 1;
        previous = array[i];
      }
      if (run > max) max = run;
    }
    return max;
  }

  function format(value, digits) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    if (!isFinite(value)) return value > 0 ? "∞" : (value < 0 ? "-∞" : "—");
    return Number(value).toFixed(digits === undefined ? 2 : digits);
  }

  function pct(value, digits) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    return (value * 100).toFixed(digits === undefined ? 1 : digits) + "%";
  }

  function signed(value, digits) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    var text = Number(value).toFixed(digits === undefined ? 2 : digits);
    return value > 0 ? "+" + text : text;
  }

  function describeDPrime(dPrime) {
    if (!isFinite(dPrime)) return "分辨能力无法估计";
    if (dPrime < 0.5) return "几乎无法分辨坏蛋糕和好蛋糕";
    if (dPrime < 1.5) return "分辨能力较弱，容易被斑点干扰";
    if (dPrime < 2.5) return "分辨能力中等，能抓住主要线索";
    return "分辨能力较强，能稳定识别坏蛋糕";
  }

  function describeC(c) {
    if (!isFinite(c)) return "判断标准无法估计";
    if (c < -0.3) return "你的标准偏宽松，宁可冒险也不想多扔";
    if (c > 0.3) return "你的标准偏严格，宁可多扔也绝不卖出坏蛋糕";
    return "你的标准比较中性";
  }

  function csvEscape(value) {
    var text = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  NS.math = {
    clamp: clamp,
    lerp: lerp,
    mulberry32: mulberry32,
    randn: randn,
    erf: erf,
    normCdf: normCdf,
    normPdf: normPdf,
    normInv: normInv,
    correctedRate: correctedRate,
    zFromCounts: zFromCounts,
    betaFromZ: betaFromZ,
    aPrime: aPrime,
    calcStats: calcStats,
    modelProbs: modelProbs,
    optimalBeta: optimalBeta,
    optimalC: optimalC,
    aucFromDPrime: aucFromDPrime,
    dPrimeFromAuc: dPrimeFromAuc,
    expectedValue: expectedValue,
    binomialSample: binomialSample,
    shuffle: shuffle,
    maxRun: maxRun,
    format: format,
    pct: pct,
    signed: signed,
    describeDPrime: describeDPrime,
    describeC: describeC,
    csvEscape: csvEscape,
    escapeHtml: escapeHtml
  };
})(window.CakeSDT = window.CakeSDT || {});
