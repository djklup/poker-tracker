export const PACIFIC_TZ = 'America/Los_Angeles';

export function formatPacificDate(dateString) {
  if (!dateString) return '--';
  return new Date(dateString).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ });
}

export function formatPacificTime(dateString) {
  if (!dateString) return '--';
  return new Date(dateString).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: '2-digit', minute: '2-digit' });
}

export function getCurrentPacificInputString() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]));
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

export function isoToPacificLocalInput(isoString) {
  if (!isoString) return getCurrentPacificInputString();
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

export function pacificInputToISO(localDateTimeString) {
  if (!localDateTimeString) return new Date().toISOString();
  const tempDate = new Date(localDateTimeString);
  const jan = new Date(tempDate.getFullYear(), 0, 1);
  const jul = new Date(tempDate.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = tempDate.getTimezoneOffset() < stdOffset;
  const offset = isDST ? '-07:00' : '-08:00';
  return `${localDateTimeString}:00${offset}`;
}

export function populateDropdowns(loggedSessions) {
  const config = window.POKER_CONFIG || { stakes: [], gameTypes: [] };
  
  const fillSelect = (elemId, items, includeAllOption = false, allLabel = 'All Games') => {
    const select = document.getElementById(elemId);
    if (!select) return;
    let html = '';
    if (includeAllOption) html += `<option value="all">${allLabel}</option>`;
    html += items.map(i => `<option value="${i.value}">${i.label}</option>`).join('');
    select.innerHTML = html;
  };

  fillSelect('startGameType', config.gameTypes);
  fillSelect('editGameType', config.gameTypes);
  fillSelect('editActiveGameType', config.gameTypes);
  fillSelect('filterGame', config.gameTypes, true, 'All Games');

  fillSelect('startStakes', config.stakes);
  fillSelect('editStakes', config.stakes);
  fillSelect('editActiveStakes', config.stakes);
  fillSelect('filterStakes', config.stakes, true, 'All Stakes');

  if (loggedSessions.length > 0) {
    const last = loggedSessions[0];
    if (last.gameType) {
      const gtElem = document.getElementById('startGameType');
      if (gtElem) gtElem.value = last.gameType;
    }
    if (last.stakes) {
      const stElem = document.getElementById('startStakes');
      if (stElem) stElem.value = last.stakes;
    }
  }
}
