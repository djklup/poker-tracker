import "./../firebase-config.js";
import { initAuth } from './auth.js';
import { renderActiveSessionBar, initSessionModals } from './sessions.js';
import { initTransactions } from './transactions.js';
import { renderDashboardData, exportToCSV } from './dashboard.js';
import { populateDropdowns, isoToPacificLocalInput, pacificInputToISO } from './utils.js';

let currentUser = null;
let activeSession = null;
let loggedSessions = [];
let bankrollTransactions = [];

const APP_VERSION = "v0.71"; 
document.getElementById('appVersionDisplay').textContent = APP_VERSION;

document.addEventListener('DOMContentLoaded', () => {
  initAuth((user) => {
    currentUser = user;
    if (user) {
      document.getElementById('loggedOutNotice').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      document.getElementById('userInfo').classList.remove('hidden');
      document.getElementById('loginBtn').classList.add('hidden');
      document.getElementById('userName').textContent = user.displayName || user.email;
      attachFirestoreListeners();
    } else {
      document.getElementById('loggedOutNotice').classList.remove('hidden');
      document.getElementById('dashboard').classList.add('hidden');
      document.getElementById('userInfo').classList.add('hidden');
      document.getElementById('loginBtn').classList.remove('hidden');
      currentUser = null;
      loggedSessions = [];
      bankrollTransactions = [];
    }
  });

  populateDropdowns(loggedSessions);
  initSessionModals(() => currentUser, loggedSessions, () => activeSession);
  initTransactions(() => currentUser);

  // Filters & graph metric listeners
  document.getElementById('filterGame').addEventListener('change', () => renderDashboardData(loggedSessions, bankrollTransactions));
  document.getElementById('filterStakes').addEventListener('change', () => renderDashboardData(loggedSessions, bankrollTransactions));
  document.getElementById('filterTimeframe').addEventListener('change', () => renderDashboardData(loggedSessions, bankrollTransactions));
  document.getElementById('graphMetricSelect').addEventListener('change', () => renderDashboardData(loggedSessions, bankrollTransactions));
  
  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    document.getElementById('filterGame').value = 'all';
    document.getElementById('filterStakes').value = 'all';
    document.getElementById('filterTimeframe').value = 'all';
    renderDashboardData(loggedSessions, bankrollTransactions);
  });

  document.getElementById('exportCsvBtn').addEventListener('click', () => exportToCSV(loggedSessions));

  //Edit Active button
  document.getElementById('editActiveSessionBtn').addEventListener('click', () => {
    if (!activeSession) {
      alert("No active session found to edit.");
      return;
    }
    // Populate the active edit form fields
    document.getElementById('editActiveGameType').value = activeSession.gameType;
    document.getElementById('editActiveStakes').value = activeSession.stakes;
    document.getElementById('editActiveBuyIn').value = activeSession.buyIn;
    document.getElementById('editActiveStartHand').value = activeSession.startHand;
    
    // Show the modal
    document.getElementById('editActiveModal').classList.remove('hidden');
  });

  document.getElementById('closeEditActiveModal').addEventListener('click', () => {
    document.getElementById('editActiveModal').classList.add('hidden');
  });

  // Global actions for modals
  document.getElementById('startSessionBtn').addEventListener('click', () => {
    if (activeSession) {
      alert("You already have an active session in progress!");
      return;
    }
    document.getElementById('toggleStartOverride').checked = false;
    document.getElementById('startOverrideContainer').classList.add('hidden');
    document.getElementById('startTimeOverride').value = '';
    populateDropdowns(loggedSessions);

    // Extract the exact value displayed in the Current Wallet dashboard card
    const statBankrollElem = document.getElementById('statBankroll');
    if (statBankrollElem) {
      const bankrollText = statBankrollElem.textContent.replace('$', '').trim();
      const parsedBankroll = parseFloat(bankrollText);
      if (!isNaN(parsedBankroll)) {
        document.getElementById('startBuyIn').value = parsedBankroll.toFixed(2);
      }
    }

    if (loggedSessions.length > 0) {
      const lastSession = loggedSessions[0];
      if (lastSession.endHand) {
        document.getElementById('startHandNum').value = lastSession.endHand;
        const handNote = document.getElementById('handPreviousNote');
        if (handNote) {
          handNote.textContent = `✓ Auto-filled from last session's end hand (#${lastSession.endHand.toLocaleString()}). Please verify.`;
          handNote.classList.remove('hidden');
        }
      }
    }
    document.getElementById('startModal').classList.remove('hidden');
  });

  document.getElementById('closeStartModal').addEventListener('click', () => document.getElementById('startModal').classList.add('hidden'));
  document.getElementById('depositWithdrawBtn').addEventListener('click', () => document.getElementById('txModal').classList.remove('hidden'));
  document.getElementById('closeTxModal').addEventListener('click', () => document.getElementById('txModal').classList.add('hidden'));
  document.getElementById('endSessionBtn').addEventListener('click', () => document.getElementById('endModal').classList.remove('hidden'));
  document.getElementById('closeEndModal').addEventListener('click', () => document.getElementById('endModal').classList.add('hidden'));
  document.getElementById('dismissSummaryBtn').addEventListener('click', () => document.getElementById('endModal').classList.add('hidden'));
  document.getElementById('closeEditModal').addEventListener('click', () => document.getElementById('editModal').classList.add('hidden'));
});

function attachFirestoreListeners() {
  const fb = window.FirebaseServices;
  const qSessions = fb.query(fb.collection(fb.db, 'sessions'), fb.orderBy('startTime', 'desc'));
  fb.onSnapshot(qSessions, (snapshot) => {
    loggedSessions = [];
    activeSession = null;
    snapshot.docs.forEach(docSnap => {
      const data = { id: docSnap.id, ...docSnap.data() };
      if (data.userId === currentUser.uid) {
        if (data.status === 'active') activeSession = data;
        else loggedSessions.push(data);
      }
    });
    renderActiveSessionBar(activeSession);
    renderDashboardData(loggedSessions, bankrollTransactions);
  });

  const qTx = fb.query(fb.collection(fb.db, 'transactions'), fb.orderBy('timestamp', 'desc'));
  fb.onSnapshot(qTx, (snapshot) => {
    bankrollTransactions = [];
    snapshot.docs.forEach(docSnap => {
      const data = { id: docSnap.id, ...docSnap.data() };
      if (data.userId === currentUser.uid) bankrollTransactions.push(data);
    });
    renderDashboardData(loggedSessions, bankrollTransactions);
  });
}

// Global window assignments for table edit/delete triggers
window.editSession = (id) => {
  const s = loggedSessions.find(item => item.id === id);
  if (!s) return;
  document.getElementById('editSessionId').value = s.id;
  document.getElementById('editGameType').value = s.gameType;
  document.getElementById('editStakes').value = s.stakes;
  document.getElementById('editBuyIn').value = s.buyIn;
  document.getElementById('editCashOut').value = s.cashOut || 0;
  document.getElementById('editStartHand').value = s.startHand;
  document.getElementById('editEndHand').value = s.endHand || s.startHand;
  document.getElementById('editStartTime').value = isoToPacificLocalInput(s.startTime);
  document.getElementById('editEndTime').value = isoToPacificLocalInput(s.endTime);
  document.getElementById('editNotes').value = s.notes || "";
  document.getElementById('editModal').classList.remove('hidden');
};

document.getElementById('editSessionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const sessionId = document.getElementById('editSessionId').value;
  if (!sessionId) return;

  const startHand = parseInt(document.getElementById('editStartHand').value, 10);
  const endHand = parseInt(document.getElementById('editEndHand').value, 10);
  const startTimeISO = pacificInputToISO(document.getElementById('editStartTime').value);
  const endTimeISO = pacificInputToISO(document.getElementById('editEndTime').value);

  const buyIn = parseFloat(document.getElementById('editBuyIn').value);
  const cashOut = parseFloat(document.getElementById('editCashOut').value);
  const netProfit = cashOut - buyIn;

  const startDt = new Date(startTimeISO);
  const endDt = new Date(endTimeISO);
  const durationHrs = Math.max(0.1, (endDt - startDt) / 3600000);
  const totalHandsPlayed = endHand - startHand;
  const hourlyRate = netProfit / durationHrs;
  const per100Rate = totalHandsPlayed > 0 ? (netProfit / totalHandsPlayed) * 100 : 0;

  try {
    const fb = window.FirebaseServices;
    const sessionRef = fb.doc(fb.db, 'sessions', sessionId);
    await fb.updateDoc(sessionRef, {
      gameType: document.getElementById('editGameType').value,
      stakes: document.getElementById('editStakes').value,
      buyIn: buyIn,
      cashOut: cashOut,
      netProfit: netProfit,
      startHand: startHand,
      endHand: endHand,
      startTime: startTimeISO,
      endTime: endTimeISO,
      notes: document.getElementById('editNotes').value || ""
    });

    document.getElementById('editModal').classList.add('hidden');
  } catch (err) {
    console.error("Error updating logged session: ", err);
    alert("Failed to update session.");
  }
});

document.getElementById('editActiveForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeSession) return;

  const fb = window.FirebaseServices;
  const updatedData = {
    gameType: document.getElementById('editActiveGameType').value,
    stakes: document.getElementById('editActiveStakes').value,
    buyIn: parseFloat(document.getElementById('editActiveBuyIn').value),
    startHand: parseInt(document.getElementById('editActiveStartHand').value, 10)
  };

  try {
    await fb.updateDoc(fb.doc(fb.db, 'sessions', activeSession.id), updatedData);
    document.getElementById('editActiveModal').classList.add('hidden');
  } catch (err) {
    console.error("Error updating active session: ", err);
    alert("Failed to update active session.");
  }
});

window.editTransaction = (id) => {
  const t = bankrollTransactions.find(item => item.id === id);
  if (!t) return;
  document.getElementById('editTxId').value = t.id;
  document.getElementById('editTxType').value = t.type;
  document.getElementById('editTxAmount').value = Math.abs(t.amount);
  document.getElementById('editTxTimestamp').value = isoToPacificLocalInput(t.timestamp);
  document.getElementById('editTxNote').value = t.note || "";
  document.getElementById('editTxModal').classList.remove('hidden');
};

window.deleteSession = async (id) => {
  if (confirm("Are you sure you want to delete this session entry permanently?")) {
    const fb = window.FirebaseServices;
    await fb.deleteDoc(fb.doc(fb.db, 'sessions', id));
  }
};

window.deleteTransaction = async (id) => {
  if (confirm("Are you sure you want to delete this bankroll deposit/withdrawal record?")) {
    const fb = window.FirebaseServices;
    await fb.deleteDoc(fb.doc(fb.db, 'transactions', id));
  }
};
