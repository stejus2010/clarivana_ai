// firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyAMpv1EQCg-W7Fr_MXyfmLlO5zAGLAWXMo",
  authDomain: "stai-437917.firebaseapp.com",
  projectId: "stai-437917",
  storageBucket: "stai-437917.firebasestorage.app",
  messagingSenderId: "481645199693",
  appId: "1:481645199693:web:8f522c13003be9c4843704",
  measurementId: "G-RL21GL8Y0L"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- Billing / Usage logic ---
async function updateDailyUsage(type) {
  const user = auth.currentUser;
  if (!user) {
    Swal.fire('Please log in first!');
    return false;
  }

  const docRef = db.collection('users').doc(user.uid);
  const docSnap = await docRef.get();
  let data = docSnap.data();

  if (!data) {
    await docRef.set({
      plan: 'free',
      scansToday: 0,
      aiAnalysisToday: 0,
      lastScanDate: new Date().toISOString().split('T')[0]
    });
    data = (await docRef.get()).data();
  }

  const today = new Date().toISOString().split('T')[0];
  if (data.lastScanDate !== today) {
    await docRef.update({ scansToday: 0, aiAnalysisToday: 0, lastScanDate: today });
    data.scansToday = 0;
    data.aiAnalysisToday = 0;
  }

  if (type === 'scan' && data.plan === 'free' && data.scansToday >= 8) {
    Swal.fire('Limit reached', 'Upgrade to Premium for unlimited scans.', 'info');
    return false;
  }
  if (type === 'analysis' && data.plan === 'free' && data.aiAnalysisToday >= 5) {
    Swal.fire('Limit reached', 'Upgrade to Premium for unlimited analyses.', 'info');
    return false;
  }

  await docRef.update({
    scansToday: type === 'scan' ? (data.scansToday + 1) : data.scansToday,
    aiAnalysisToday: type === 'analysis' ? (data.aiAnalysisToday + 1) : data.aiAnalysisToday
  });

  return true;
}

// --- Premium upgrade button (basic) ---
document.getElementById('upgrade-btn')?.addEventListener('click', () => {
  openDemoPaymentModal();
});
