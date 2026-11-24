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

  document.getElementById('editTxForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = window.FirebaseServices;
    const txId = document.getElementById('editTxId').value;
    if (!txId) return;

    const type = document.getElementById('editTxType').value;
    const amount = Math.abs(parseFloat(document.getElementById('editTxAmount').value));

    try {
      await fb.updateDoc(fb.doc(fb.db, 'transactions', txId), {
        type,
        amount: type === 'deposit' ? amount : -amount,
        timestamp: pacificInputToISO(document.getElementById('editTxTimestamp').value),
        note: document.getElementById('editTxNote').value || ""
      });

      document.getElementById('editTxModal').classList.add('hidden');
      document.getElementById('editTxForm').reset();
    } catch (err) {
      console.error('Error updating transaction:', err);
      alert('Failed to update transaction.');
    }
  });

  document.getElementById('closeEditTxModal').addEventListener('click', () => {
    document.getElementById('editTxModal').classList.add('hidden');
  });
}
