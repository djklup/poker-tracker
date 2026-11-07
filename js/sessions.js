import { formatPacificTime, pacificInputToISO, getCurrentPacificInputString } from './utils.js';

let timerInterval = null;

export function renderActiveSessionBar(activeSession) {
  const bar = document.getElementById('activeSessionBar');
  if (!activeSession) {
    bar.classList.add('hidden');
    if (timerInterval) clearInterval(timerInterval);
    return;
  }
  bar.classList.remove('hidden');
  const gameIcon = activeSession.gameType && activeSession.gameType.toLowerCase().includes('plo') ? '♣️' : '♠️';
  document.getElementById('activeGameDetails').textContent = `${gameIcon} ${activeSession.gameType} (${activeSession.stakes})`;
  document.getElementById('activeBuyIn').textContent = `$${activeSession.buyIn.toFixed(2)}`;
  document.getElementById('activeStartTime').textContent = formatPacificTime(activeSession.startTime);
  document.getElementById('activeStartHand').textContent = activeSession.startHand.toLocaleString();

  if (timerInterval) clearInterval(timerInterval);
  const updateTimer = () => {
    const diffMs = new Date() - new Date(activeSession.startTime);
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    document.getElementById('activeTimer').textContent = 
      `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

export function initSessionModals(currentUser, loggedSessions, getActiveSession) {
  document.getElementById('toggleStartOverride').addEventListener('change', (e) => {
    const container = document.getElementById('startOverrideContainer');
    container.classList.toggle('hidden', !e.target.checked);
    if (e.target.checked && !document.getElementById('startTimeOverride').value) {
      document.getElementById('startTimeOverride').value = getCurrentPacificInputString();
    }
  });

  document.getElementById('toggleEndOverride').addEventListener('change', (e) => {
    const container = document.getElementById('endOverrideContainer');
    container.classList.toggle('hidden', !e.target.checked);
    if (e.target.checked && !document.getElementById('endTimeOverride').value) {
      document.getElementById('endTimeOverride').value = getCurrentPacificInputString();
    }
  });

  document.getElementById('endHandNum').addEventListener('input', (e) => {
    const noteElem = document.getElementById('handCalcNote');
    const endVal = parseInt(e.target.value, 10);
    const activeSession = getActiveSession();
    if (activeSession && activeSession.startHand && !isNaN(endVal)) {
      const handsPlayed = endVal - activeSession.startHand;
      if (handsPlayed >= 0) {
        noteElem.textContent = `Total hands played this session: ${handsPlayed.toLocaleString()}`;
        noteElem.classList.remove('hidden');
      } else {
        noteElem.textContent = `Warning: Ending hand is below starting hand.`;
        noteElem.classList.remove('hidden');
      }
    } else {
      noteElem.classList.add('hidden');
    }
  });

  document.getElementById('startSessionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const startHand = parseInt(document.getElementById('startHandNum').value, 10);
    const lastSession = loggedSessions[0];

    if (lastSession && lastSession.endHand && startHand < lastSession.endHand) {
      const confirmHand = confirm(`Warning: Starting hand #${startHand.toLocaleString()} is LESS than your previous session's ending hand #${lastSession.endHand.toLocaleString()}.\n\nAre you sure you want to save this starting hand count?`);
      if (!confirmHand) return;
    }

    const isOverride = document.getElementById('toggleStartOverride').checked;
    const overrideTime = document.getElementById('startTimeOverride').value;
    const startTimeISO = (isOverride && overrideTime) ? pacificInputToISO(overrideTime) : new Date().toISOString();

    const fb = window.FirebaseServices;
    const sessionData = {
      userId: currentUser().uid, // <-- Added the parentheses () here!
      gameType: document.getElementById('startGameType').value,
      stakes: document.getElementById('startStakes').value,
      buyIn: parseFloat(document.getElementById('startBuyIn').value),
      startHand: startHand,
      startTime: startTimeISO,
      status: 'active',
      createdAt: fb.serverTimestamp()
    };

    await fb.addDoc(fb.collection(fb.db, 'sessions'), sessionData);
    document.getElementById('startModal').classList.add('hidden');
    document.getElementById('startSessionForm').reset();
  });

  document.getElementById('endSessionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const activeSession = getActiveSession();
    if (!activeSession) return;

    const endHand = parseInt(document.getElementById('endHandNum').value, 10);
    if (endHand < activeSession.startHand) {
      const confirmHand = confirm("Ending hand number is lower than your starting hand number. Proceed anyway?");
      if (!confirmHand) return;
    }

    const isOverride = document.getElementById('toggleEndOverride').checked;
    const overrideTime = document.getElementById('endTimeOverride').value;
    const endTimeISO = (isOverride && overrideTime) ? pacificInputToISO(overrideTime) : new Date().toISOString();
    
    const cashOut = parseFloat(document.getElementById('endCashOut').value);
    const buyIn = activeSession.buyIn;
    const netProfit = cashOut - buyIn;

    const gameType = activeSession.gameType;
    const stakes = activeSession.stakes;
    const startHand = activeSession.startHand;
    const startDt = new Date(activeSession.startTime);
    const endDt = new Date(endTimeISO);
    const durationHrs = Math.max(0.1, (endDt - startDt) / 3600000);
    const totalHandsPlayed = endHand - startHand;
    const hourlyRate = netProfit / durationHrs;
    const per100Rate = totalHandsPlayed > 0 ? (netProfit / totalHandsPlayed) * 100 : 0;

    try {
      const fb = window.FirebaseServices;
      const sessionRef = fb.doc(fb.db, 'sessions', activeSession.id);
      await fb.updateDoc(sessionRef, {
        status: 'completed',
        cashOut: cashOut,
        netProfit: netProfit,
        endHand: endHand,
        endTime: endTimeISO,
        notes: document.getElementById('endNotes').value || ""
      });

      document.getElementById('summaryGameTitle').textContent = `${gameType} (${stakes})`;
      
      const summaryNetElem = document.getElementById('summaryNetProfit');
      summaryNetElem.textContent = `${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}`;
      summaryNetElem.className = `text-3xl font-extrabold ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
      
      document.getElementById('summaryWalletRange').textContent = `$${cashOut.toFixed(2)} cashout - $${buyIn.toFixed(2)} buyin`;
      document.getElementById('summaryDuration').textContent = `${durationHrs.toFixed(1)} hrs`;
      document.getElementById('summaryHands').textContent = `${totalHandsPlayed.toLocaleString()} hands`;
      
      const summaryHourlyElem = document.getElementById('summaryHourly');
      summaryHourlyElem.textContent = `${hourlyRate >= 0 ? '+' : ''}$${hourlyRate.toFixed(2)}/hr`;
      summaryHourlyElem.className = `text-base font-bold ${hourlyRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

      const summaryPer100Elem = document.getElementById('summaryPer100');
      summaryPer100Elem.textContent = `${per100Rate >= 0 ? '+' : ''}$${per100Rate.toFixed(2)}`;
      summaryPer100Elem.className = `text-base font-bold ${per100Rate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

      document.getElementById('endModalFormStep').classList.add('hidden');
      document.getElementById('endModalSummaryStep').classList.remove('hidden');

    } catch (err) {
      alert("Error ending session: " + err.message);
    }
  });
}
