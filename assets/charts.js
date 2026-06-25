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

  // --- Calculate RSI(period) - Wilder's smoothing method ---
  function calcRSI(closeArr, period) {
    var rsi = [];
    var gainsEma = null;
    var lossesEma = null;

    for (var i = 0; i < closeArr.length; i++) {
      if (i < period) {
        rsi.push(null);
        continue;
      }

      if (gainsEma === null) {
        // First value: simple average
        var gains = 0, losses = 0;
        for (var j = i - period + 1; j <= i; j++) {
          var change = closeArr[j] - closeArr[j - 1];
          if (change > 0) gains += change;
          else losses -= change;
        }
        gainsEma = gains / period;
        lossesEma = losses / period;
      } else {
        var change = closeArr[i] - closeArr[i - 1];
        var gain = change > 0 ? change : 0;
        var loss = change < 0 ? -change : 0;
        gainsEma = (gainsEma * (period - 1) + gain) / period;
        lossesEma = (lossesEma * (period - 1) + loss) / period;
      }

      if (lossesEma === 0) {
        rsi.push(100);
      } else {
        var rs = gainsEma / lossesEma;
        rsi.push(100 - 100 / (1 + rs));
      }
    }
    return rsi;
  }

  // --- Stats bar ---
  function updateStats() {
    var closeArr = GZA_CLOSE;
    var label = '国证A指';
    var lastClose = closeArr[closeArr.length - 1];
    var prevClose = closeArr[closeArr.length - 2];
    var changeVal = lastClose - prevClose;
    var changePct = (changeVal / prevClose * 100);

    var ma1250 = calcMA1250(closeArr);
    var lastMa = ma1250[ma1250.length - 1];
    var deviation = calcDeviation(closeArr, ma1250);
    var lastDev = deviation[deviation.length - 1];
    var maxDev = Math.max.apply(null, deviation.filter(function(v) { return v !== null; }));
    var minDev = Math.min.apply(null, deviation.filter(function(v) { return v !== null; }));

    var rsi90 = calcRSI(closeArr, 90);
    var lastRSI = rsi90[rsi90.length - 1];

    var statsHtml = '' +
      '<div class="stat-item"><span class="stat-label">' + label + '最新收盘</span><span class="stat-value">' + lastClose.toFixed(2) + '</span></div>' +
      '<div class="stat-item"><span class="stat-label">日涨跌</span><span class="stat-value ' + (changeVal >= 0 ? 'up' : 'down') + '">' + (changeVal >= 0 ? '+' : '') + changeVal.toFixed(2) + ' (' + (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%)</span></div>' +
      '<div class="stat-item"><span class="stat-label">1250日均线</span><span class="stat-value">' + lastMa.toFixed(2) + '</span></div>' +
      '<div class="stat-item"><span class="stat-label">偏离均线</span><span class="stat-value ' + (lastDev >= 0 ? 'up' : 'down') + '">' + (lastDev >= 0 ? '+' : '') + lastDev.toFixed(1) + '%</span></div>' +
      '<div class="stat-item"><span class="stat-label">RSI(90)</span><span class="stat-value">' + lastRSI.toFixed(1) + '</span></div>' +
      '<div class="stat-item"><span class="stat-label">历史最高偏离</span><span class="stat-value up">+' + maxDev.toFixed(1) + '%</span></div>';

    document.getElementById('stats-bar').innerHTML = statsHtml;
    return { ma1250: ma1250, deviation: deviation, rsi90: rsi90 };
  }

  var calcData = updateStats();

  // Update date range subtitle
  var gzaRange = document.getElementById('gza-date-range');
  if (gzaRange && GZA_DATES.length > 0) {
    gzaRange.textContent = '数据区间：' + GZA_DATES[0] + ' 至 ' + GZA_DATES[GZA_DATES.length - 1] + ' | 数据来源：AKShare（东方财富）';
  }

  // --- Charts ---
  var chart = echarts.init(document.getElementById('chart-main'), null, { renderer: 'svg', group: 'gza-charts' });
  var devChart = echarts.init(document.getElementById('chart-deviation'), null, { renderer: 'svg', group: 'gza-charts' });
  var rsiChart = echarts.init(document.getElementById('chart-rsi'), null, { renderer: 'svg', group: 'gza-charts' });

  function buildMainData() {
    var closeArr = GZA_CLOSE;
    var closeData = [];
    var maData = [];
    var ma85Data = [];
    for (var i = 0; i < GZA_DATES.length; i++) {
      closeData.push([GZA_DATES[i], closeArr[i]]);
      if (calcData.ma1250[i] !== null) {
        maData.push([GZA_DATES[i], calcData.ma1250[i]]);
        ma85Data.push([GZA_DATES[i], calcData.ma1250[i] * 0.85]);
      }
    }
    return { closeData: closeData, maData: maData, ma85Data: ma85Data };
  }

  function buildDevData() {
    var devData = [];
    for (var i = 0; i < GZA_DATES.length; i++) {
      if (calcData.deviation[i] !== null) {
        devData.push([GZA_DATES[i], calcData.deviation[i]]);
      }
    }
    return devData;
  }

  function buildRSIData() {
    var rsiData = [];
    for (var i = 0; i < GZA_DATES.length; i++) {
      if (calcData.rsi90[i] !== null) {
        rsiData.push([GZA_DATES[i], calcData.rsi90[i]]);
      }
    }
    return rsiData;
  }

  function getMainOption() {
    var data = buildMainData();
    var label = '国证A指收盘价';

    return {
      animation: false,
      backgroundColor: 'transparent',
      grid: {
        left: 60,
        right: 30,
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
            var color = p.seriesIndex === 0 ? accent : accent2;
            var name = p.seriesIndex === 0 ? label : (p.seriesIndex === 1 ? '1250日均线' : '1250日均线×85%');
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
        min: function(value) {
          return Math.floor(value.min - (value.max - value.min) * 0.08);
        },
        max: function(value) {
          return Math.ceil(value.max + (value.max - value.min) * 0.05);
        },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: muted,
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
          xAxisIndex: [0, 1, 2],
          start: 0,
          end: 100
        },
        {
          type: 'slider',
          xAxisIndex: [0, 1, 2],
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
          name: label,
          type: 'line',
          data: data.closeData,
          showSymbol: false,
          lineStyle: {
            color: accent,
            width: 1.2
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: accent + '30' },
                { offset: 1, color: accent + '02' }
              ]
            }
          },
          emphasis: {
            lineStyle: { width: 2 }
          }
        },
        {
          name: '1250日均线',
          type: 'line',
          data: data.maData,
          showSymbol: false,
          lineStyle: {
            color: accent2,
            width: 2,
            type: 'solid'
          },
          emphasis: {
            lineStyle: { width: 3 }
          }
        },
        {
          name: '1250日均线×85%',
          type: 'line',
          data: data.ma85Data,
          showSymbol: false,
          lineStyle: {
            color: accent2,
            width: 1.2,
            type: 'dashed',
            opacity: 0.6
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
    var label = '国证A指';

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
            '<span style="color:' + muted + '">' + label + '偏离1250日均线</span>' +
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

  function getRSIOption() {
    var rsiData = buildRSIData();
    var label = '国证A指';

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
          var color = val >= 70 ? '#ef4444' : val <= 43 ? '#22c55e' : ink;
          return '<div style="font-weight:600;margin-bottom:4px">' + fmtDate(p.axisValue) + '</div>' +
            '<div style="display:flex;align-items:center;gap:6px">' +
            '<span style="color:' + muted + '">' + label + ' RSI(90)</span>' +
            '<span style="margin-left:auto;font-weight:600;color:' + color + '">' + val.toFixed(2) + '</span>' +
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
        min: 20,
        max: 80,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: muted,
          fontSize: 11,
          fontFamily: "'GeistMono', monospace",
          formatter: function(v) {
            return v.toFixed(0);
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
      graphic: [],
      series: [
        {
          name: 'RSI(90)',
          type: 'line',
          data: rsiData,
          showSymbol: false,
          lineStyle: {
            color: '#a78bfa',
            width: 1.2
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#a78bfa15' },
                { offset: 1, color: '#a78bfa02' }
              ]
            }
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#fbbf24',
              type: 'dashed',
              opacity: 0.45
            },
            label: {
              show: true,
              position: 'insideStartTop',
              formatter: function(p) {
                var labels = { '70': '超买 70', '57': '超买 57', '43': '超卖 43' };
                return labels[p.value] || p.value;
              },
              fontSize: 10,
              fontWeight: 'bold',
              fontFamily: 'InstrumentSans, sans-serif',
              color: '#fbbf24',
              backgroundColor: '#1a2035',
              padding: [2, 5],
              borderRadius: 3
            },
            data: [
              { yAxis: 70 },
              { yAxis: 57 },
              { yAxis: 43 }
            ]
          },
          markArea: {
            silent: true,
            data: [
              [{ yAxis: 70, itemStyle: { color: '#ef444408' } }, { yAxis: 100 }],
              [{ yAxis: 57, itemStyle: { color: '#f59e0b08' } }, { yAxis: 70 }],
              [{ yAxis: 0, itemStyle: { color: '#22c55e08' } }, { yAxis: 43 }]
            ]
          }
        }
      ]
    };
  }

  chart.setOption(getMainOption());
  devChart.setOption(getDevOption());
  rsiChart.setOption(getRSIOption());

  // Synchronize zoom across all charts
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

  syncZoom(chart, [devChart, rsiChart]);
  syncZoom(devChart, [chart, rsiChart]);
  syncZoom(rsiChart, [chart, devChart]);

  window.addEventListener('resize', function() {
    chart.resize();
    devChart.resize();
    rsiChart.resize();
  });
})();
