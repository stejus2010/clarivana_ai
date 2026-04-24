// app.js
document.addEventListener('DOMContentLoaded', () => {
  // DOM
  const screens = {
    home: document.getElementById('home-screen'),
    scanner: document.getElementById('scanner-screen'),
    allergies: document.getElementById('allergies-screen'),
    history: document.getElementById('history-screen'),
  };

  const navButtons = {
    home: document.getElementById('nav-home'),
    scanner: document.getElementById('nav-scanner'),
    allergies: document.getElementById('nav-allergies'),
    history: document.getElementById('nav-history'),
  };

  const openSettingsBtn = document.getElementById('open-settings');
  const logoutBtn = document.getElementById('logout');

  const goScanner = document.getElementById('go-scanner');
  const goAllergies = document.getElementById('go-allergies');

  const allergyInput = document.getElementById('allergy-input');
  const saveAllergiesBtn = document.getElementById('save-allergies');

  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history');

  function showScreen(name) {
    Object.keys(screens).forEach(k => screens[k].style.display = (k === name) ? 'block' : 'none');
    Object.keys(navButtons).forEach(k => navButtons[k].classList.toggle('active', k === name));
  }

  navButtons.home.addEventListener('click', () => showScreen('home'));
  navButtons.scanner.addEventListener('click', () => showScreen('scanner'));
  navButtons.allergies.addEventListener('click', () => showScreen('allergies'));
  navButtons.history.addEventListener('click', () => showScreen('history'));

  goScanner.addEventListener('click', () => showScreen('scanner'));
  goAllergies.addEventListener('click', () => showScreen('allergies'));

  // Auth state
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    const doc = await db.collection('users').doc(user.uid).get();
    const data = doc.exists ? doc.data() : {};
    allergyInput.value = (data.allergies || []).join(', ');
    loadHistory();
  });

  logoutBtn.addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = 'login.html';
  });

  openSettingsBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    const doc = await db.collection('users').doc(user.uid).get();
    const data = doc.exists ? doc.data() : {};

    Swal.fire({
      title: 'Edit Account',
      html:
        `<input id="sw-name" class="swal2-input" placeholder="Name" value="${data.name || ''}">` +
        `<input id="sw-age" type="number" class="swal2-input" placeholder="Age" value="${data.age || ''}">` +
        `<select id="sw-gender" class="swal2-input">
          <option value="">Select Gender</option>
          <option value="Male" ${data.gender==='Male' ? 'selected' : ''}>Male</option>
          <option value="Female" ${data.gender==='Female' ? 'selected' : ''}>Female</option>
          <option value="Other" ${data.gender==='Other' ? 'selected' : ''}>Other</option>
        </select>` +
        `<input id="sw-allergies" class="swal2-input" placeholder="Allergies (comma separated)" value="${(data.allergies||[]).join(', ')}">` +
        `<input id="sw-email" class="swal2-input" placeholder="Email" value="${data.email || user.email || ''}" readonly>`,
      showCancelButton: true,
      confirmButtonText: 'Save',
      preConfirm: () => {
        const name = document.getElementById('sw-name').value.trim();
        const age = parseInt(document.getElementById('sw-age').value);
        const gender = document.getElementById('sw-gender').value;
        const allergies = document.getElementById('sw-allergies').value.split(',').map(a => a.trim()).filter(a => a);
        if (!name || !age || !gender) {
          Swal.showValidationMessage('Please fill name, age and gender.');
          return false;
        }
        return { name, age, gender, allergies };
      }
    }).then(result => {
      if (result.isConfirmed && result.value) {
        db.collection('users').doc(user.uid).set(result.value, { merge: true })
          .then(() => Swal.fire('Saved', 'Account updated', 'success'))
          .catch(err => Swal.fire('Error', err.message, 'error'));
      }
    });
  });

  saveAllergiesBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    const arr = allergyInput.value.split(',').map(a => a.trim()).filter(a => a);
    await db.collection('users').doc(user.uid).set({ allergies: arr }, { merge: true });
    Swal.fire('Saved', 'Allergies updated', 'success');
  });

  async function loadHistory() {
    const user = auth.currentUser;
    historyList.innerHTML = '<div style="color:#9aaed0">Loading...</div>';
    if (!user) return;
    const snap = await db.collection('users').doc(user.uid).collection('history').orderBy('timestamp','desc').limit(50).get();
    if (snap.empty) {
      historyList.innerHTML = '<div style="color:#9aaed0">No scans yet</div>';
      return;
    }
    historyList.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const node = document.createElement('div');
      node.className = 'history-item';
      node.innerHTML = `<strong>${new Date(d.timestamp?.toMillis?.() || d.timestamp).toLocaleString()}</strong>
                        <div>${(d.ingredients||'').slice(0,250)}</div>
                        <div style="margin-top:6px;color:#a9cfe8">${(d.notes||'')}</div>`;
      historyList.appendChild(node);
    });
  }

  clearHistoryBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    const ok = await Swal.fire({
      title: 'Clear history?',
      text: 'This will remove all saved scans.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Clear'
    });
    if (!ok.isConfirmed) return;
    const snap = await db.collection('users').doc(user.uid).collection('history').get();
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    loadHistory();
    Swal.fire('Cleared', 'History cleared', 'success');
  });

  window.appLoadHistory = loadHistory;
  showScreen('home');
});

// ========== Demo Payment Modal ==========
// function openDemoPaymentModal() {
//   Swal.fire({
//     title: 'Upgrade to Premium (Demo)',
//     html:
//       '<input id="pay-name" class="swal2-input" placeholder="Cardholder name">' +
//       '<input id="pay-email" class="swal2-input" placeholder="Billing email">' +
//       '<input id="pay-card" class="swal2-input" maxlength="19" placeholder="Card number (demo)">' +
//       '<div style="display:flex; gap:8px;">' +
//       '<input id="pay-exp" class="swal2-input" placeholder="MM/YY">' +
//       '<input id="pay-cvv" class="swal2-input" maxlength="4" placeholder="CVV">' +
//       '</div>' +
//       '<small style="display:block;color:#99a8c7;margin-top:6px;">Demo only — no real payment.</small>',
//     focusConfirm: false,
//     showCancelButton: true,
//     confirmButtonText: 'Pay $2.99 (Demo)',
//     preConfirm: () => {
//       const name = document.getElementById('pay-name').value.trim();
//       const email = document.getElementById('pay-email').value.trim();
//       const card = document.getElementById('pay-card').value.trim();
//       if (!name || !email || card.length < 12) {
//         Swal.showValidationMessage('Fill in all fields properly');
//         return false;
//       }
//       return { name, email, card };
//     }
//   }).then(async res => {
//     if (!res.value) return;
//     Swal.fire({ title: 'Processing...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
//     await new Promise(r => setTimeout(r, 1200));
//     const user = auth.currentUser;
//     if (!user) {
//       Swal.fire('Please log in first.');
//       return;
//     }
//     await db.collection('users').doc(user.uid).set({
//       plan: 'premium',
//       premiumSince: new Date().toISOString(),
//       billing: { name: res.value.name, email: res.value.email, last4: res.value.card.slice(-4), demo: true }
//     }, { merge: true });
//     Swal.fire('Upgraded!', 'Your plan is now Premium (demo).', 'success');
//   });
// }
