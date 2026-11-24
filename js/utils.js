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
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localDateTimeString);
  if (!match) return new Date(localDateTimeString).toISOString();

  const targetWallTime = Date.UTC(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6] || 0)
  );
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const wallTimeAt = (timestamp) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
    return Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
  };

  const offsets = new Set();
  [-36, -24, -12, 0, 12, 24, 36].forEach(hours => {
    const sample = targetWallTime + hours * 3600000;
    offsets.add(wallTimeAt(sample) - sample);
  });

  const candidates = [...offsets].map(offset => {
    const timestamp = targetWallTime - offset;
    return { timestamp, wallTime: wallTimeAt(timestamp) };
  });
  const exactMatches = candidates
    .filter(candidate => candidate.wallTime === targetWallTime)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (exactMatches.length) return new Date(exactMatches[0].timestamp).toISOString();

  const nextValidTime = candidates
    .filter(candidate => candidate.wallTime > targetWallTime)
    .sort((a, b) => a.wallTime - b.wallTime)[0];
  if (nextValidTime) return new Date(nextValidTime.timestamp).toISOString();

  return new Date(candidates[0].timestamp).toISOString();
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
