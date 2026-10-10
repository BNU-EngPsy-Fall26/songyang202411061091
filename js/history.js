/* =========================================================
   本机历史记录
   - 使用 localStorage，不涉及服务器
   - 支持 CSV / JSON 导出与 JSON 导入
   ========================================================= */
(function (NS) {
  'use strict';

  var KEY = 'cakesdt.runs.v1';
  var MAX_RUNS = 60;

  function loadRuns() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('读取本机记录失败：', error);
      return [];
    }
  }

  function saveRuns(runs) {
    try {
      localStorage.setItem(KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
    } catch (error) {
      console.warn('保存本机记录失败：', error);
    }
  }

  function addRun(run) {
    var runs = loadRuns();
    runs.unshift(run);
    if (runs.length > MAX_RUNS) runs.length = MAX_RUNS;
    saveRuns(runs);
    return runs;
  }

  function removeRun(id) {
    var runs = loadRuns().filter(function (run) { return run.id !== id; });
    saveRuns(runs);
    return runs;
  }

  function clearRuns() {
    try {
      localStorage.removeItem(KEY);
    } catch (error) {
      console.warn('清空本机记录失败：', error);
    }
  }

  function summarize(runs) {
    if (!runs.length) {
      return { count: 0, bestDPrime: NaN, meanC: NaN, meanAccuracy: NaN, meanRT: NaN };
    }
    var bestDPrime = -Infinity;
    var sumC = 0;
    var sumAcc = 0;
    var sumRT = 0;
    var rtCount = 0;
    runs.forEach(function (run) {
      if (run.dPrime > bestDPrime) bestDPrime = run.dPrime;
      sumC += run.c;
      sumAcc += run.accuracy;
      if (isFinite(run.meanRT) && run.meanRT > 0) {
        sumRT += run.meanRT;
        rtCount++;
      }
    });
    return {
      count: runs.length,
      bestDPrime: bestDPrime,
      meanC: sumC / runs.length,
      meanAccuracy: sumAcc / runs.length,
      meanRT: rtCount ? sumRT / rtCount : NaN
    };
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportCSV(runs, filename) {
    runs = runs || loadRuns();
    var header = [
      '时间', '姓名', '学号', '系统d\'', 'P(S)',
      'H', 'M', 'FA', 'CR',
      'P(Hit)', 'P(FA)', 'd\'', 'c', 'beta', '准确率', '平均反应时(ms)'
    ];
    var lines = [header.map(NS.math.csvEscape).join(',')];
    runs.forEach(function (run) {
      var row = [
        new Date(run.timestamp).toLocaleString('zh-CN'),
        run.name || '游客',
        run.studentId || '',
        NS.math.format(run.systemDPrime, 2),
        NS.math.format(run.pS, 2),
        run.H, run.M, run.FA, run.CR,
        NS.math.format(run.pH, 4),
        NS.math.format(run.pFA, 4),
        NS.math.format(run.dPrime, 4),
        NS.math.format(run.c, 4),
        NS.math.format(run.beta, 4),
        NS.math.format(run.accuracy, 4),
        NS.math.format(run.meanRT, 0)
      ];
      lines.push(row.map(NS.math.csvEscape).join(','));
    });
    download(filename || 'cake-sdt-history.csv', '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function exportJSON(runs, filename) {
    runs = runs || loadRuns();
    download(
      filename || 'cake-sdt-history.json',
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), runs: runs }, null, 2),
      'application/json;charset=utf-8'
    );
  }

  function importJSON(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          var incoming = Array.isArray(parsed) ? parsed : (parsed.runs || []);
          if (!Array.isArray(incoming)) throw new Error('文件格式不正确');
          var current = loadRuns();
          var seen = {};
          current.forEach(function (run) { seen[run.id] = true; });
          incoming.forEach(function (run) {
            if (run && run.id && !seen[run.id]) {
              current.push(run);
              seen[run.id] = true;
            }
          });
          current.sort(function (a, b) {
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          });
          saveRuns(current);
          resolve(current);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = function () { reject(reader.error || new Error('读取文件失败')); };
      reader.readAsText(file);
    });
  }

  NS.history = {
    KEY: KEY,
    loadRuns: loadRuns,
    saveRuns: saveRuns,
    addRun: addRun,
    removeRun: removeRun,
    clearRuns: clearRuns,
    summarize: summarize,
    exportCSV: exportCSV,
    exportJSON: exportJSON,
    importJSON: importJSON,
    download: download
  };
})(window.CakeSDT = window.CakeSDT || {});
