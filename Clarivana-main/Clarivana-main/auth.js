// auth.js
window.addEventListener("load", function () {
  console.log("Auth + Sidebar loaded ✅");

  // ---------------- DOM Elements ----------------
  const authChoiceScreen = document.getElementById("auth-choice-screen");
  const signupScreen = document.getElementById("signup-screen");
  const loginScreen = document.getElementById("login-screen");

  const chooseLoginBtn = document.getElementById("choose-login");
  const chooseSignupBtn = document.getElementById("choose-signup");
  const backToChoiceBtn = document.getElementById("back-to-choice");
  const backToChoiceLoginBtn = document.getElementById("back-to-choice-login");

  const signupBtn = document.getElementById("signup-button");
  const loginBtn = document.getElementById("login-button");

  const authError = document.getElementById("auth-error");
  const authErrorLogin = document.getElementById("auth-error-login");

  const sidebar = document.getElementById("sidebar"); // optional (not used heavily)
  const menuToggle = document.getElementById("menu-toggle");
  const closeSidebar = document.getElementById("close-sidebar");
  const accountSettingsBtn = document.getElementById("account-settings-btn");
  const displayNameInput = document.getElementById("display-name");
  const displayEmailInput = document.getElementById("display-email");
  const saveAccountBtn = document.getElementById("save-account-btn");
  const logoutBtn = document.getElementById("logout-btn");

  const appHeader = document.getElementById("app-header");
  const homeScreen = document.getElementById("home-screen");
  const loginScreenElem = document.getElementById("login-screen");
  const signupScreenElem = document.getElementById("signup-screen");
  const authChoiceElem = document.getElementById("auth-choice-screen");

  if (typeof window.auth === "undefined") {
    console.error("Firebase Auth not initialized. Check firebase.js");
    return;
  }
  const auth = window.auth;
  const db = window.db;

  // NAV buttons bindings (simple SPA nav)
  document.getElementById("nav-home").addEventListener("click", () => {
    showScreen("home");
  });
  document.getElementById("nav-scanner").addEventListener("click", () => {
    showScreen("scanner");
  });
  document.getElementById("nav-allergies").addEventListener("click", () => {
    showScreen("allergies");
  });
  document.getElementById("nav-history").addEventListener("click", () => {
    showScreen("history");
  });
  document.getElementById("bb-home")?.addEventListener("click", () => showScreen("home"));
  document.getElementById("bb-scanner")?.addEventListener("click", () => showScreen("scanner"));
  document.getElementById("bb-account")?.addEventListener("click", () => showAccountModal());

  // Account settings click -> SweetAlert modal to edit (except email)
  accountSettingsBtn?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const doc = await db.collection("users").doc(user.uid).get();
      const data = doc.exists ? doc.data() : {};
      Swal.fire({
        title: "Edit account",
        html:
          `<input id="swal-name" class="swal2-input" placeholder="Name" value="${data.name || ''}">` +
          `<input id="swal-age" type="number" class="swal2-input" placeholder="Age" value="${data.age || ''}">` +
          `<select id="swal-gender" class="swal2-input">
              <option value="" ${!data.gender ? 'selected' : ''}>Select Gender</option>
              <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
              <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
              <option value="other" ${data.gender === 'other' ? 'selected' : ''}>Other</option>
          </select>` +
          `<input id="swal-allergies" class="swal2-input" placeholder="Allergies (comma separated)" value="${(data.allergies||[]).join(', ')}">` +
          `<input id="swal-email" class="swal2-input" placeholder="Email" value="${data.email || user.email || ''}" readonly>`,
        showCancelButton: true,
        confirmButtonText: "Save",
        preConfirm: () => {
          const name = document.getElementById("swal-name").value.trim();
          const ageV = document.getElementById("swal-age").value.trim();
          const age = ageV ? parseInt(ageV) : null;
          const gender = document.getElementById("swal-gender").value;
          const allergiesStr = document.getElementById("swal-allergies").value || "";
          const allergies = allergiesStr.split(",").map(a => a.trim()).filter(a => a);
          if (!name || !age || !gender) {
            Swal.showValidationMessage("Please complete name, age and gender.");
            return false;
          }
          return { name, age, gender, allergies };
        }
      }).then(result => {
        if (result.isConfirmed && result.value) {
          const { name, age, gender, allergies } = result.value;
          db.collection("users").doc(user.uid).set({ name, age, gender, allergies }, { merge: true })
            .then(() => Swal.fire("Saved", "Account details updated.", "success"))
            .catch(err => Swal.fire("Error", err.message, "error"));
        }
      });

    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Could not fetch account data.", "error");
    }
  });

  saveAccountBtn?.addEventListener("click", () => {
    const name = displayNameInput.value.trim();
    const user = auth.currentUser;
    if (!user) return;
    db.collection("users").doc(user.uid).set({ name, email: user.email }, { merge: true })
      .then(() => Swal.fire("Updated!", "Your account info has been saved.", "success"))
      .catch(err => Swal.fire("Error", err.message, "error"));
  });

  logoutBtn?.addEventListener("click", () => {
    auth.signOut().then(() => {
      // show auth choice again
      appHeader.classList.add("hidden");
      hideAllScreens();
      authChoiceElem.classList.remove("hidden");
      homeScreen.classList.add("hidden");
      signupScreenElem.classList.add("hidden");
      loginScreenElem.classList.add("hidden");
    });
  });

  // ---------------- Auth Choice buttons
  chooseSignupBtn.addEventListener("click", () => {
    authChoiceElem.classList.add("hidden");
    signupScreenElem.classList.remove("hidden");
  });
  chooseLoginBtn.addEventListener("click", () => {
    authChoiceElem.classList.add("hidden");
    loginScreenElem.classList.remove("hidden");
  });
  backToChoiceBtn.addEventListener("click", () => {
    signupScreenElem.classList.add("hidden");
    authChoiceElem.classList.remove("hidden");
  });
  backToChoiceLoginBtn.addEventListener("click", () => {
    loginScreenElem.classList.add("hidden");
    authChoiceElem.classList.remove("hidden");
  });

  // ---------------- Signup logic (collects name, age, gender, allergies)
  signupBtn.addEventListener("click", () => {
    const name = document.getElementById("user-name").value.trim();
    const age = document.getElementById("user-age").value.trim();
    const gender = document.getElementById("user-gender").value;
    const email = document.getElementById("user-email").value.trim();
    const password = document.getElementById("user-password").value.trim();
    const allergies = document.getElementById("user-allergies").value.trim();

    if (!name || !age || !gender || !email || !password) {
      authError && (authError.textContent = "Please fill in all fields.");
      return;
    }
    auth.createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        return db.collection("users").doc(user.uid).set({
          name,
          age: parseInt(age),
          gender,
          email,
          allergies: allergies ? allergies.split(",").map(a => a.trim()).filter(a => a) : []
        });
      })
      .then(() => {
        authError && (authError.textContent = "");
        Swal.fire("Welcome!", "Account created.", "success");
        // show app
        displayEmailInput && (displayEmailInput.value = email);
        authChoiceElem.classList.add("hidden");
        signupScreenElem.classList.add("hidden");
        appHeader.classList.remove("hidden");
        showScreen("home");
      })
      .catch(err => {
        console.error(err);
        authError && (authError.textContent = err.message);
      });
  });

  // ---------------- Login logic
  loginBtn.addEventListener("click", () => {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    if (!email || !password) {
      authErrorLogin && (authErrorLogin.textContent = "Please enter email and password.");
      return;
    }
    auth.signInWithEmailAndPassword(email, password)
      .then(userCredential => {
        const user = userCredential.user;
        // fetch user doc and populate allergies UI area
        db.collection("users").doc(user.uid).get()
          .then(doc => {
            if (doc.exists) {
              const data = doc.data();
              const userAllergies = data.allergies || [];
              document.getElementById("profile-allergies").textContent = userAllergies.length ? userAllergies.join(", ") : "No allergies set.";
            }
          });
        // show app
        authErrorLogin && (authErrorLogin.textContent = "");
        authChoiceElem.classList.add("hidden");
        loginScreenElem.classList.add("hidden");
        appHeader.classList.remove("hidden");
        showScreen("home");
      })
      .catch(err => {
        // show swal invite to sign up if user not found
        if (err.code === "auth/user-not-found") {
          Swal.fire({
            icon: "info",
            title: "Account not found",
            text: "Do you want to sign up?",
            showCancelButton: true,
            confirmButtonText: "Sign Up"
          }).then(result => {
            if (result.isConfirmed) {
              loginScreenElem.classList.add("hidden");
              signupScreenElem.classList.remove("hidden");
            }
          });
        } else {
          authErrorLogin && (authErrorLogin.textContent = err.message);
        }
      });
  });

  // ---------------- Persist login
  auth.onAuthStateChanged(user => {
    if (user) {
      // show app UI
      authChoiceElem.classList.add("hidden");
      signupScreenElem.classList.add("hidden");
      loginScreenElem.classList.add("hidden");
      appHeader.classList.remove("hidden");
      showScreen("home");

      // populate account inputs if exists
      db.collection("users").doc(user.uid).get().then(doc => {
        if (doc.exists) {
          const data = doc.data();
          displayNameInput && (displayNameInput.value = data.name || "");
          displayEmailInput && (displayEmailInput.value = data.email || user.email);
          // also populate allergies swipe
          document.getElementById("profile-allergies").textContent = (data.allergies || []).join(", ") || "No allergies set.";
        } else {
          displayEmailInput && (displayEmailInput.value = user.email || "");
        }
      });
    } else {
      // show choice
      appHeader.classList.add("hidden");
      hideAllScreens();
      authChoiceElem.classList.remove("hidden");
    }
  });

  // helper: show screens
  function hideAllScreens() {
    ["home","scanner","allergies","history","info"].forEach(s => {
      document.getElementById(`${s}-screen`)?.classList.add("hidden");
    });
  }
  function showScreen(name) {
    hideAllScreens();
    const el = document.getElementById(`${name}-screen`);
    if (el) el.classList.remove("hidden");
    // show bottom bar and header states
    document.getElementById("bottom-bar")?.classList.remove("hidden");
  }

  // Simple account modal open
  function showAccountModal(){
    accountSettingsBtn && accountSettingsBtn.click();
  }

}); // load
