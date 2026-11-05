import { formatPacificDate, formatPacificTime } from './utils.js';
import { renderPerformanceChart } from './charts.js';

export function getFilteredEntries(loggedSessions, bankrollTransactions) {
  const gameFilter = document.getElementById('filterGame')?.value || 'all';
  const stakesFilter = document.getElementById('filterStakes')?.value || 'all';
  const timeframeFilter = document.getElementById('filterTimeframe')?.value || 'all';

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const filterItem = (item, isSession) => {
    const timestamp = new Date(isSession ? item.startTime : item.timestamp);

    if (timeframeFilter === '30days' && timestamp < thirtyDaysAgo) return false;
    if (timeframeFilter === 'ytd' && timestamp.getFullYear() !== currentYear) return false;
    if (timeframeFilter === 'month' && (timestamp.getFullYear() !== currentYear || timestamp.getMonth() !== currentMonth)) return false;

    if (isSession) {
      if (gameFilter !== 'all' && item.gameType !== gameFilter) return false;
      if (stakesFilter !== 'all' && item.stakes !== stakesFilter) return false;
    }
    return true;
  };

  const filteredSessions = loggedSessions.filter(s => filterItem(s, true));
  const filteredTx = bankrollTransactions.filter(t => filterItem(t, false));

  return { filteredSessions, filteredTx };
}

export function renderDashboardData(loggedSessions, bankrollTransactions) {
  renderUnifiedActivityTable(loggedSessions, bankrollTransactions);
  const { filteredSessions } = getFilteredEntries(loggedSessions, bankrollTransactions);
  renderPerformanceChart(filteredSessions);
}

function renderUnifiedActivityTable(loggedSessions, bankrollTransactions) {
  const tbody = document.getElementById('activityTableBody');
  const mobileContainer = document.getElementById('mobileActivityCards');

  const { filteredSessions, filteredTx } = getFilteredEntries(loggedSessions, bankrollTransactions);

  const combined = [
    ...filteredSessions.map(s => ({ ...s, entryType: 'session', sortTime: new Date(s.startTime).getTime() })),
    ...filteredTx.map(t => ({ ...t, entryType: 'transaction', sortTime: new Date(t.timestamp).getTime() }))
  ].sort((a, b) => b.sortTime - a.sortTime);

  document.getElementById('activityCount').textContent = `${combined.length} entries shown`;

  calculateOverallStats(filteredSessions, filteredTx, loggedSessions, bankrollTransactions);

  if (combined.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-gray-500">No recorded sessions or transactions match the selected filters.</td></tr>`;
    mobileContainer.innerHTML = `<div class="p-6 text-center text-gray-500 text-sm">No recorded sessions or transactions match the selected filters.</div>`;
    return;
  }

  tbody.innerHTML = combined.map(item => {
    if (item.entryType === 'session') {
      const start = new Date(item.startTime);
      const end = new Date(item.endTime);
      const durationHrs = Math.max(0.1, (end - start) / 3600000);
      const totalHands = (item.endHand && item.startHand) ? (item.endHand - item.startHand) : 0;
      const profit = item.netProfit || 0;
      const hourly = profit / durationHrs;
      const per100 = totalHands > 0 ? (profit / totalHands) * 100 : 0;
      const gameIcon = item.gameType && item.gameType.toLowerCase().includes('plo') ? '♣️' : '♠️';

      return `
        <tr class="bg-gray-850 hover:bg-gray-750 transition shadow-sm border border-gray-700/60 rounded-xl">
          <td class="py-3 px-3 rounded-l-xl">
            <div class="font-medium text-gray-200">${formatPacificDate(item.startTime)}</div>
            <div class="text-xs text-gray-400">${formatPacificTime(item.startTime)}</div>
          </td>
          <td class="py-3 px-3 font-semibold text-gray-200">${gameIcon} ${item.gameType} <span class="text-xs text-gray-400">(${item.stakes})</span></td>
          <td class="py-3 px-3">${durationHrs.toFixed(1)} hrs</td>
          <td class="py-3 px-3">
            <div>${totalHands > 0 ? totalHands.toLocaleString() + ' hands' : '--'}</div>
            <div class="text-xs text-gray-400">${item.startHand || 0} - ${item.endHand || 0}</div>
          </td>
          <td class="py-3 px-3 font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
            <div>${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}</div>
            <div class="text-xs text-gray-400 font-normal">$${(item.cashOut || 0).toFixed(2)} - $${(item.buyIn || 0).toFixed(2)}</div>
          </td>
          <td class="py-3 px-3 ${hourly >= 0 ? 'text-emerald-400' : 'text-rose-400'}">$${hourly.toFixed(2)}/hr</td>
          <td class="py-3 px-3 ${per100 >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${totalHands > 0 ? (per100 >= 0 ? '+' : '') + '$' + per100.toFixed(2) : '--'}</td>
          <td class="py-3 px-3 max-w-xs truncate text-xs text-gray-400" title="${item.notes || ''}">${item.notes || '--'}</td>
          <td class="py-3 px-3 text-right space-x-2 rounded-r-xl">
            <button onclick="window.editSession('${item.id}')" class="text-indigo-400 hover:text-indigo-300 font-medium text-xs">Edit</button>
            <button onclick="window.deleteSession('${item.id}')" class="text-rose-400 hover:text-rose-300 font-medium text-xs">Delete</button>
          </td>
        </tr>
      `;
    } else {
      const isDeposit = item.type === 'deposit';
      return `
        <tr class="bg-gray-850/60 hover:bg-gray-750 transition shadow-sm border border-gray-700/40 rounded-xl">
          <td class="py-3 px-3 rounded-l-xl">
            <div class="font-medium text-gray-200">${formatPacificDate(item.timestamp)}</div>
            <div class="text-xs text-gray-400">${formatPacificTime(item.timestamp)}</div>
          </td>
          <td class="py-3 px-3 font-semibold capitalize ${isDeposit ? 'text-emerald-400' : 'text-amber-400'}">💳 Bankroll ${item.type}</td>
          <td class="py-3 px-3 text-gray-500">--</td>
          <td class="py-3 px-3 text-gray-500">--</td>
          <td class="py-3 px-3 font-bold ${item.amount >= 0 ? 'text-emerald-400' : 'text-amber-400'}">${item.amount >= 0 ? '+' : ''}$${item.amount.toFixed(2)}</td>
          <td class="py-3 px-3 text-gray-500">--</td>
          <td class="py-3 px-3 text-gray-500">--</td>
          <td class="py-3 px-3 text-xs text-gray-300">${item.note || '--'}</td>
          <td class="py-3 px-3 text-right space-x-2 rounded-r-xl">
            <button onclick="window.editTransaction('${item.id}')" class="text-indigo-400 text-xs">Edit</button>
            <button onclick="window.deleteTransaction('${item.id}')" class="text-rose-400 text-xs">Delete</button>
          </td>
        </tr>
      `;
    }
  }).join('');
}

function calculateOverallStats(filteredSessions, filteredTx, loggedSessions, bankrollTransactions) {
  let totalSessionProfit = 0;
  let totalHours = 0;
  let totalHands = 0;
  let winningSessionsCount = 0;

  filteredSessions.forEach(s => {
    const profit = s.netProfit || 0;
    totalSessionProfit += profit;
    if (profit > 0) winningSessionsCount++;

    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    totalHours += Math.max(0, (end - start) / 3600000);

    if (s.endHand && s.startHand) totalHands += (s.endHand - s.startHand);
  });

  const winRatePct = filteredSessions.length > 0 ? Math.round((winningSessionsCount / filteredSessions.length) * 100) : 0;

  let allTxAdjustments = bankrollTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
  let allSessionProfit = loggedSessions.reduce((acc, s) => acc + (s.netProfit || 0), 0);
  let grandTotalBankroll = allSessionProfit + allTxAdjustments;

  document.getElementById('statBankroll').textContent = `$${grandTotalBankroll.toFixed(2)}`;
  document.getElementById('statNetProfit').textContent = `${totalSessionProfit >= 0 ? '+' : ''}$${totalSessionProfit.toFixed(2)}`;
  document.getElementById('statNetProfit').className = `text-xl md:text-2xl font-bold ${totalSessionProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
  document.getElementById('statHours').textContent = `${totalHours.toFixed(1)} hrs`;
  document.getElementById('statHands').innerHTML = `${totalHands.toLocaleString()} <span class="text-xs font-normal text-gray-400">(${winRatePct}% win)</span>`;

  const overallHourly = totalHours > 0 ? (totalSessionProfit / totalHours) : 0;
  document.getElementById('statHourly').textContent = `$${overallHourly.toFixed(2)}/hr`;
  document.getElementById('statHourly').className = `text-xl md:text-2xl font-bold ${overallHourly >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
}

export function exportToCSV(loggedSessions) {
  if (loggedSessions.length === 0) {
    alert("No session data available to export.");
    return;
  }
  let csv = "Date (PT),Game,Stakes,Start Time (PT),End Time (PT),Hours,Start Hand,End Hand,Total Hands,Net Profit,$/100 Hands,Notes\n";
  loggedSessions.forEach(s => {
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    const hrs = ((end - start) / 3600000).toFixed(2);
    const hands = (s.endHand && s.startHand) ? (s.endHand - s.startHand) : 0;
    const profit = s.netProfit || 0;
    const per100 = hands > 0 ? (profit / hands) * 100 : 0;
    const cleanNotes = (s.notes || "").replace(/"/g, '""');
    csv += `"${formatPacificDate(s.startTime)}","${s.gameType}","${s.stakes}","${formatPacificTime(s.startTime)}","${formatPacificTime(s.endTime)}",${hrs},${s.startHand},${s.endHand || ''},${hands},${profit},${per100.toFixed(2)},"${cleanNotes}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `poker_bankroll_export_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
