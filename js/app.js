import "./../firebase-config.js";
import { initAuth } from './auth.js';
import { renderActiveSessionBar, initSessionModals } from './sessions.js';
import { initTransactions } from './transactions.js';
import { renderDashboardData, exportToCSV } from './dashboard.js';
import { populateDropdowns, isoToPacificLocalInput, pacificInputToISO } from './utils.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let activeSession = null;
let loggedSessions = [];
let bankrollTransactions = [];

const APP_VERSION = "v0.92"; 
document.getElementById('appVersionDisplay').textContent = APP_VERSION;

// Helper to convert your Base64 VAPID public key for the browser
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeUserToPush(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array('BCwEg_e7sfaT0oEGIkJwS2MRG3RbLwYGdHKTNI3bdpan5ZoR8G2UFm_C1Iy0JpWtdjKGywcKknQMYtDjPaS2Hks')
      });
    }

    // Store the subscription object in Firestore so the Cloud Function can read it
    await setDoc(doc(db, 'users', userId), {
      pushSubscription: JSON.parse(JSON.stringify(subscription))
    }, { merge: true });

  } catch (err) {
    console.error('Push subscription failed:', err);
  }
}

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

  // Register the service worker safely upon startup
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service worker registration successful with scope: ', registration.scope);
      })
      .catch((error) => {
        console.error('Service worker registration failed: ', error);
      });
  }

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
    
    subscribeUserToPush();

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

  // Listen to completed/logged sessions from the top-level sessions collection
  const qSessions = fb.query(
    fb.collection(fb.db, 'sessions'),
    fb.where('userId', '==', currentUser.uid),
    fb.orderBy('startTime', 'desc')
  );
  fb.onSnapshot(qSessions, (snapshot) => {
    loggedSessions = [];
    snapshot.docs.forEach(docSnap => {
      const data = { id: docSnap.id, ...docSnap.data() };
      if (data.userId === currentUser.uid && data.status !== 'active') {
        loggedSessions.push(data);
      }
    });
    renderDashboardData(loggedSessions, bankrollTransactions);
  });

  // Listen to active sessions from the user's dedicated subcollection
  const qActive = fb.query(fb.collection(fb.db, 'users', currentUser.uid, 'activeSessions'));
  fb.onSnapshot(qActive, (snapshot) => {
    activeSession = null;
    snapshot.docs.forEach(docSnap => {
      const data = { id: docSnap.id, ...docSnap.data() };
      activeSession = data;
    });
    renderActiveSessionBar(activeSession);
  });

  // Listen to bankroll transactions
  const qTx = fb.query(
    fb.collection(fb.db, 'transactions'),
    fb.where('userId', '==', currentUser.uid),
    fb.orderBy('timestamp', 'desc')
  );
  fb.onSnapshot(qTx, (snapshot) => {
    bankrollTransactions = [];
    snapshot.docs.forEach(docSnap => {
      const data = { id: docSnap.id, ...docSnap.data() };
      if (data.userId === currentUser.uid) bankrollTransactions.push(data);
    });
    renderDashboardData(loggedSessions, bankrollTransactions);
  });
}

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
