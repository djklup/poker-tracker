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

const APP_VERSION = "v0.43"; 
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
    document.getElementById('startModal').classList.remove('hidden');
  });

  document.getElementById('closeStartModal').addEventListener('click', () => document.getElementById('startModal').classList.add('hidden'));
  document.getElementById('depositWithdrawBtn').addEventListener('click', () => document.getElementById('txModal').classList.remove('hidden'));
  document.getElementById('closeTxModal').addEventListener('click', () => document.getElementById('txModal').classList.add('hidden'));
  document.getElementById('endSessionBtn').addEventListener('click', () => document.getElementById('endModal').classList.remove('hidden'));
  document.getElementById('closeEndModal').addEventListener('click', () => document.getElementById('endModal').classList.add('hidden'));
  document.getElementById('dismissSummaryBtn').addEventListener('click', () => document.getElementById('endModal').classList.add('hidden'));
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
