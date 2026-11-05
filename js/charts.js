import { formatPacificDate } from './utils.js';

let performanceChartInstance = null;

export function renderPerformanceChart(filteredSessions) {
  const ctx = document.getElementById('performanceChart').getContext('2d');
  const metric = document.getElementById('graphMetricSelect').value;

  const titleElem = document.getElementById('graphTitle');
  if (metric === 'hands') titleElem.textContent = "Performance & Bankroll Growth (Cumulative Hands)";
  else if (metric === 'hours') titleElem.textContent = "Performance & Bankroll Growth (Cumulative Hours)";
  else titleElem.textContent = "Performance & Bankroll Growth (Session Timeline)";

  const sorted = [...filteredSessions].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  let chartData = [];
  let cumulativeNet = 0;
  let cumulativeHands = 0;
  let cumulativeHours = 0;

  sorted.forEach((s, index) => {
    const profit = s.netProfit || 0;
    cumulativeNet += profit;
    
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    const durationHrs = Math.max(0, (end - start) / 3600000);
    cumulativeHours += durationHrs;

    const hands = (s.endHand && s.startHand) ? (s.endHand - s.startHand) : 0;
    cumulativeHands += hands;

    let xVal = index + 1;
    if (metric === 'hands') xVal = cumulativeHands;
    else if (metric === 'hours') xVal = parseFloat(cumulativeHours.toFixed(2));

    chartData.push({ x: xVal, y: cumulativeNet, dateStr: formatPacificDate(s.startTime) });
  });

  if (performanceChartInstance) performanceChartInstance.destroy();

  const isCategory = metric === 'sessions';

  performanceChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Total Net Profit ($)',
        data: chartData.length > 0 ? chartData : [{x: 0, y: 0}],
        borderColor: '#34d399',
        backgroundColor: 'rgba(52, 211, 153, 0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.1,
        pointRadius: 4,
        pointBackgroundColor: '#34d399'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function(context) {
              const pt = context[0].raw;
              if (metric === 'hands') return `Hands Played: ${Number(pt.x).toLocaleString()}`;
              if (metric === 'hours') return `Hours Played: ${Number(pt.x).toFixed(1)} hrs`;
              return `Session Date: ${pt.dateStr}`;
            },
            label: function(context) {
              return ` Net Profit: $${context.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: isCategory ? 'category' : 'linear',
          labels: isCategory ? (chartData.length > 0 ? chartData.map(d => d.dateStr) : ['Start']) : undefined,
          grid: { color: 'rgba(55, 65, 81, 0.5)' },
          ticks: { 
            color: '#9ca3af', 
            font: { size: 11 },
            maxTicksLimit: 8,
            callback: function(value) {
              if (metric === 'hands') return Number(value).toLocaleString();
              if (metric === 'hours') return Number(value).toFixed(1);
              return value;
            }
          }
        },
        y: {
          grid: { color: 'rgba(55, 65, 81, 0.5)' },
          ticks: { 
            color: '#9ca3af', 
            font: { size: 11 },
            maxTicksLimit: 6,
            callback: function(value) { return '$' + value; }
          }
        }
      }
    }
  });
}
