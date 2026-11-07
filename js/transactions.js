import { pacificInputToISO, getCurrentPacificInputString } from './utils.js';

export function initTransactions(currentUser) {
  document.getElementById('toggleTxOverride').addEventListener('change', (e) => {
    const container = document.getElementById('txOverrideContainer');
    container.classList.toggle('hidden', !e.target.checked);
    if (e.target.checked && !document.getElementById('txTimeOverride').value) {
      document.getElementById('txTimeOverride').value = getCurrentPacificInputString();
    }
  });

  document.getElementById('txForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = window.FirebaseServices;
    const txType = document.getElementById('txType').value;
    const amount = parseFloat(document.getElementById('txAmount').value);
    const isOverride = document.getElementById('toggleTxOverride').checked;
    const overrideTime = document.getElementById('txTimeOverride').value;
    const timestampISO = (isOverride && overrideTime) ? pacificInputToISO(overrideTime) : new Date().toISOString();

    await fb.addDoc(fb.collection(fb.db, 'transactions'), {
      userId: currentUser().uid,
      type: txType,
      amount: txType === 'deposit' ? amount : -amount,
      note: document.getElementById('txNote').value || "",
      timestamp: timestampISO,
      createdAt: fb.serverTimestamp()
    });

    document.getElementById('txModal').classList.add('hidden');
    document.getElementById('txForm').reset();
  });
}
