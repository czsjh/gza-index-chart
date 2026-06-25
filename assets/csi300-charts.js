(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  function fmtDate(v) {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    var d = new Date(v);
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  // --- Calculate deviation: (close - ma) / ma * 100 ---
  function calcDeviation(closeArr, maArr) {
    var dev = [];
    for (var i = 0; i < closeArr.length; i++) {
      if (maArr[i] !== null && maArr[i] !== 0) {
        dev.push((closeArr[i] - maArr[i]) / maArr[i] * 100);
      } else {
        dev.push(null);
      }
    }
    return dev;
  }

  // --- Calculate MA1250 ---
  function calcMA1250(closeArr) {
    var ma = [];
    for (var i = 0; i < closeArr.length; i++) {
      if (i < 1249) {
        var sum = 0;
        for (var j = 0; j <= i; j++) sum += closeArr[j];
        ma.push(sum / (i + 1));
      } else {
        var sum = 0;
        for (var j = i - 1249; j <= i; j++) sum += closeArr[j];
        ma.push(sum / 1250);
      }
    }
    return ma;
  }

  // --- Stats bar ---
  function updateStats() {
    var last300 = CSI300_CLOSE[CSI300_CLOSE.length - 1];
    var prev300 = CSI300_CLOSE[CSI300_CLOSE.length - 2];
    var change300 = last300 - prev300;
    var change300Pct = (change300 / prev300 * 100);

    var lastFund = MIXFUND_CLOSE[MIXFUND_CLOSE.length - 1];
    var prevFund = MIXFUND_CLOSE[MIXFUND_CLOSE.length - 2];
    var changeFund = lastFund - prevFund;
    var changeFundPct = (changeFund / prevFund * 100);

    var ma1250 = calcMA1250(CSI300_CLOSE);
    var lastMa = ma1250[ma1250.length - 1];
    var deviation = calcDeviation(CSI300_CLOSE, ma1250);
    var lastDev = deviation[deviation.length - 1];
    var maxDev = Math.max.apply(null, deviation.filter(function(v) { return v !== null; }));

    var statsHtml = '' +
      '<div class="stat-item"><span class="stat-label">沪深300全收益</span><span class="stat-value">' + last300.toFixed(2) + '</span></div>' +
      '<div class="stat-item"><span class="stat-label">日涨跌</span><span class="stat-value ' + (change300 >= 0 ? 'up' : 'down') + '">' + (change300 >= 0 ? '+' : '') + change300.toFixed(2) + ' (' + (change300Pct >= 0 ? '+' : '') + change300Pct.toFixed(2) + '%)</span></div>' +
      '<div class="stat-item"><span class="stat-label">非纯债基指数</span><span class="stat-value">' + lastFund.toFixed(2) + '</span></div>' +
      '<div class="stat-item"><span class="stat-label">基金日涨跌</span><span class="stat-value ' + (changeFund >= 0 ? 'up' : 'down') + '">' + (changeFund >= 0 ? '+' : '') + changeFund.toFixed(2) + ' (' + (changeFundPct >= 0 ? '+' : '') + changeFundPct.toFixed(2) + '%)</span></div>' +
      '<div class="stat-item"><span class="stat-label">偏离均线</span><span class="stat-value ' + (lastDev >= 0 ? 'up' : 'down') + '">' + (lastDev >= 0 ? '+' : '') + lastDev.toFixed(1) + '%</span></div>' +
      '<div class="stat-item"><span class="stat-label">历史最高偏离</span><span class="stat-value up">+' + maxDev.toFixed(1) + '%</span></div>';

    document.getElementById('stats-bar-csi300').innerHTML = statsHtml;
    return { ma1250: ma1250, deviation: deviation };
  }

  var calcData = updateStats();

  // --- Charts ---
  var chart = echarts.init(document.getElementById('chart-csi300-main'), null, { renderer: 'svg' });
  var devChart = echarts.init(document.getElementById('chart-csi300-deviation'), null, { renderer: 'svg' });

  function buildMainData() {
    var close300 = [];
    var closeFund = [];
    for (var i = 0; i < CSI300_DATES.length; i++) {
      close300.push([CSI300_DATES[i], CSI300_CLOSE[i]]);
      closeFund.push([CSI300_DATES[i], MIXFUND_CLOSE[i]]);
    }
    return { close300: close300, closeFund: closeFund };
  }

  function buildDevData() {
    var devData = [];
    for (var i = 0; i < CSI300_DATES.length; i++) {
      if (calcData.deviation[i] !== null) {
        devData.push([CSI300_DATES[i], calcData.deviation[i]]);
      }
    }
    return devData;
  }

  function getMainOption() {
    var data = buildMainData();

    return {
      animation: false,
      backgroundColor: 'transparent',
      grid: {
        left: 60,
        right: 60,
        top: 20,
        bottom: 30
      },
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        backgroundColor: '#1a2035',
        borderColor: rule,
        textStyle: {
          color: ink,
          fontFamily: "'GeistMono', monospace",
          fontSize: 12
        },
        formatter: function(params) {
          var date = fmtDate(params[0].axisValue);
          var html = '<div style="font-weight:600;margin-bottom:4px">' + date + '</div>';
          params.forEach(function(p) {
            var color = p.seriesIndex === 0 ? '#3b82f6' : '#22c55e';
            var name = p.seriesIndex === 0 ? '沪深300全收益' : '非纯债基指数';
            html += '<div style="display:flex;align-items:center;gap:6px">' +
              '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + '"></span>' +
              '<span style="color:' + muted + '">' + name + '</span>' +
              '<span style="margin-left:auto;font-weight:600">' + (p.value[1] !== null ? p.value[1].toFixed(2) : '-') + '</span>' +
              '</div>';
          });
          return html;
        }
      },
      axisPointer: {
        type: 'cross',
        link: [{ xAxisIndex: 'all' }],
        lineStyle: {
          color: muted,
          opacity: 0.3
        },
        crossStyle: {
          color: muted,
          opacity: 0.3
        }
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: {
          show: true,
          lineStyle: { color: rule, opacity: 0.4 }
        }
      },
      yAxis: {
        type: 'value',
        scale: true,
        position: 'left',
        min: 0,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: ink,
          fontSize: 11,
          fontFamily: "'GeistMono', monospace",
          formatter: function(v) {
            return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0);
          }
        },
        splitLine: {
          lineStyle: { color: rule, opacity: 0.4 }
        }
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 0,
          end: 100
        },
        {
          type: 'slider',
          xAxisIndex: [0, 1],
          start: 0,
          end: 100,
          height: 24,
          bottom: 8,
          borderColor: rule,
          backgroundColor: 'transparent',
          fillerColor: accent + '20',
          handleStyle: { color: accent, borderColor: accent },
          textStyle: { color: muted, fontSize: 10 },
          dataBackground: {
            lineStyle: { color: accent, opacity: 0.3 },
            areaStyle: { color: accent, opacity: 0.05 }
          },
          selectedDataBackground: {
            lineStyle: { color: accent, opacity: 0.5 },
            areaStyle: { color: accent, opacity: 0.1 }
          }
        }
      ],
      series: [
        {
          name: '沪深300全收益',
          type: 'line',
          data: data.close300,
          showSymbol: false,
          lineStyle: {
            color: '#3b82f6',
            width: 1.2
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#3b82f630' },
                { offset: 1, color: '#3b82f602' }
              ]
            }
          },
          emphasis: {
            lineStyle: { width: 2 }
          }
        },
        {
          name: '非纯债基指数',
          type: 'line',
          data: data.closeFund,
          showSymbol: false,
          lineStyle: {
            color: '#22c55e',
            width: 1.2
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#22c55e30' },
                { offset: 1, color: '#22c55e02' }
              ]
            }
          },
          emphasis: {
            lineStyle: { width: 2 }
          }
        }
      ]
    };
  }

  function getDevOption() {
    var devData = buildDevData();

    return {
      animation: false,
      backgroundColor: 'transparent',
      grid: {
        left: 60,
        right: 30,
        top: 30,
        bottom: 50
      },
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        backgroundColor: '#1a2035',
        borderColor: rule,
        textStyle: {
          color: ink,
          fontFamily: "'GeistMono', monospace",
          fontSize: 12
        },
        formatter: function(params) {
          var p = params[0];
          var val = p.value[1];
          var color = val >= 0 ? '#ef4444' : '#22c55e';
          return '<div style="font-weight:600;margin-bottom:4px">' + fmtDate(p.axisValue) + '</div>' +
            '<div style="display:flex;align-items:center;gap:6px">' +
            '<span style="color:' + muted + '">沪深300偏离1250日均线</span>' +
            '<span style="margin-left:auto;font-weight:600;color:' + color + '">' + (val >= 0 ? '+' : '') + val.toFixed(2) + '%</span>' +
            '</div>';
        }
      },
      axisPointer: {
        type: 'cross',
        link: [{ xAxisIndex: 'all' }],
        lineStyle: {
          color: muted,
          opacity: 0.3
        }
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false },
        axisLabel: {
          color: muted,
          fontSize: 11,
          fontFamily: "'GeistMono', monospace"
        },
        splitLine: {
          show: true,
          lineStyle: { color: rule, opacity: 0.4 }
        }
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: muted,
          fontSize: 11,
          fontFamily: "'GeistMono', monospace",
          formatter: function(v) {
            return v.toFixed(0) + '%';
          }
        },
        splitLine: {
          lineStyle: { color: rule, opacity: 0.4 }
        }
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        }
      ],
      series: [
        {
          name: '偏离值',
          type: 'line',
          data: devData,
          showSymbol: false,
          lineStyle: {
            color: '#22d3ee',
            width: 1.2
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#22d3ee20' },
                { offset: 0.5, color: '#22d3ee05' },
                { offset: 1, color: '#22d3ee20' }
              ]
            }
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: muted,
              type: 'dashed',
              opacity: 0.5
            },
            data: [
              { yAxis: 0, label: { show: false } }
            ]
          }
        }
      ]
    };
  }

  chart.setOption(getMainOption());
  devChart.setOption(getDevOption());

  // Synchronize zoom between main and deviation charts
  var isSyncing = false;
  function syncZoom(sourceChart, targetCharts) {
    sourceChart.on('dataZoom', function(params) {
      if (isSyncing) return;
      var opt = sourceChart.getOption().dataZoom;
      if (!opt || !opt.length) return;
      var start = opt[0].start;
      var end = opt[0].end;
      isSyncing = true;
      targetCharts.forEach(function(tc) {
        tc.setOption({
          dataZoom: [{ start: start, end: end }]
        });
      });
      isSyncing = false;
    });
  }

  syncZoom(chart, [devChart]);
  syncZoom(devChart, [chart]);

  window.addEventListener('resize', function() {
    chart.resize();
    devChart.resize();
  });
})();
