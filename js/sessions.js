import { formatPacificTime, pacificInputToISO, getCurrentPacificInputString } from './utils.js';

let timerInterval = null;
let notificationFired = false; // Tracks if the break reminder has already been sent for this session

export function renderActiveSessionBar(activeSession) {
  const bar = document.getElementById('activeSessionBar');
  if (!activeSession) {
    bar.classList.add('hidden');
    if (timerInterval) clearInterval(timerInterval);
    notificationFired = false; // Reset when session ends
    return;
  }
  bar.classList.remove('hidden');
  const gameIcon = activeSession.gameType && activeSession.gameType.toLowerCase().includes('plo') ? '♣️' : '♠️';
  document.getElementById('activeGameDetails').textContent = `${gameIcon} ${activeSession.gameType} (${activeSession.stakes})`;
  document.getElementById('activeBuyIn').textContent = `$${activeSession.buyIn.toFixed(2)}`;
  document.getElementById('activeStartTime').textContent = formatPacificTime(activeSession.startTime);
  document.getElementById('activeStartHand').textContent = activeSession.startHand.toLocaleString();

  // Request notification permission when an active session is loaded/started
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  if (timerInterval) clearInterval(timerInterval);
  
  const updateTimer = () => {
    const diffMs = new Date() - new Date(activeSession.startTime);
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    
    document.getElementById('activeTimer').textContent = 
      `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // TESTING THRESHOLD: 1 minute (60,000 ms). Change to 3600000 for 1 hour in production.
    const targetThresholdMs = 60 * 1000; 

    if (!notificationFired && diffMs >= targetThresholdMs) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Poker Break Reminder 🚨', {
          body: 'You have been playing continuously. Take a quick break to stretch and clear your mind!',
          icon: 'apple-touch-icon.png'
        });
        notificationFired = true;
      }
    }
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
    const userId = currentUser().uid;

    const sessionData = {
      userId: userId,
      gameType: document.getElementById('startGameType').value,
      stakes: document.getElementById('startStakes').value,
      buyIn: parseFloat(document.getElementById('startBuyIn').value),
      startHand: startHand,
      startTime: startTimeISO,
      status: 'active',
      breakNotified: false,
      createdAt: fb.serverTimestamp()
    };

    const activeSessionsRef = fb.collection(fb.db, 'users', userId, 'activeSessions');
    const activeSessionRef = fb.doc(fb.db, 'users', userId, 'activeSessions', 'current');

    try {
      const activeSessions = await fb.getDocs(activeSessionsRef);
      if (!activeSessions.empty) {
        alert('You already have an active session in progress.');
        return;
      }

      await fb.runTransaction(fb.db, async (transaction) => {
        const existingSession = await transaction.get(activeSessionRef);
        if (existingSession.exists()) {
          const error = new Error('An active session already exists.');
          error.code = 'active-session-exists';
          throw error;
        }
        transaction.set(activeSessionRef, sessionData);
      });

      document.getElementById('startModal').classList.add('hidden');
      document.getElementById('startSessionForm').reset();
    } catch (err) {
      if (err.code === 'active-session-exists') {
        alert('You already have an active session in progress.');
      } else {
        console.error('Error starting session:', err);
        alert('Failed to start session. Please try again.');
      }
    }
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
      const userId = currentUser().uid;

      // 1. Remove the active session from the user's dedicated subcollection
      const activeRef = fb.doc(fb.db, 'users', userId, 'activeSessions', activeSession.id);
      await fb.deleteDoc(activeRef);

      // 2. Add the finalized session into the top-level completed sessions collection
      const completedSessionData = {
        userId: userId,
        status: 'completed',
        gameType: gameType,
        stakes: stakes,
        buyIn: buyIn,
        cashOut: cashOut,
        netProfit: netProfit,
        startHand: startHand,
        endHand: endHand,
        startTime: activeSession.startTime,
        endTime: endTimeISO,
        notes: document.getElementById('endNotes').value || "",
        createdAt: fb.serverTimestamp()
      };

      await fb.addDoc(fb.collection(fb.db, 'sessions'), completedSessionData);

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
