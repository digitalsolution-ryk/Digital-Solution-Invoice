// Cloud Sync for Digital Solutions Invoicing
// Keeps localStorage as the source of truth for the app (nothing else changes),
// but mirrors these keys to Firestore so every device with the same login sees the same data.
(function () {
  const SYNC_KEYS = [
    "ds_invoices",
    "ds_invoice_counter",
    "ds_customers",
    "ds_services",
    "ds_settings",
    "ds_vouchers"
  ];
  const LS_LAST_LOGIN_EMAIL = "ds_sync_email";

  const auth = firebase.auth();
  const db = firebase.firestore();

  const origSetItem = localStorage.setItem.bind(localStorage);
  let pushTimer = null;
  let suppressPush = false; // true while we are writing pulled cloud data back into localStorage

  localStorage.setItem = function (key, value) {
    origSetItem(key, value);
    if (!suppressPush && SYNC_KEYS.includes(key) && auth.currentUser) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(pushToCloud, 1200);
    }
  };

  async function pushToCloud() {
    const user = auth.currentUser;
    if (!user) return;
    const data = { updatedAt: Date.now() };
    SYNC_KEYS.forEach((k) => (data[k] = localStorage.getItem(k) || null));
    try {
      await db.collection("users").doc(user.uid).set(data, { merge: true });
      setStatus("Synced ✓");
    } catch (e) {
      console.error("Sync push failed", e);
      setStatus("Sync failed");
    }
  }

  async function pullFromCloud() {
    const user = auth.currentUser;
    if (!user) return false;
    try {
      const doc = await db.collection("users").doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        suppressPush = true;
        SYNC_KEYS.forEach((k) => {
          if (data[k] !== undefined && data[k] !== null) origSetItem(k, data[k]);
        });
        suppressPush = false;
        return true;
      }
    } catch (e) {
      console.error("Sync pull failed", e);
    }
    return false;
  }

  // ---------- Minimal login UI ----------
  function buildLoginOverlay() {
    const wrap = document.createElement("div");
    wrap.id = "syncLoginOverlay";
    wrap.style.cssText =
      "position:fixed;inset:0;background:rgba(10,12,20,.92);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;padding:16px;";
    wrap.innerHTML = `
      <div style="background:#181c27;border-radius:14px;padding:24px;max-width:340px;width:100%;color:#e8eaf0;box-shadow:0 10px 40px rgba(0,0,0,.5);">
        <h2 style="margin:0 0 4px;font-size:19px;">Cloud Sync</h2>
        <p style="margin:0 0 16px;font-size:13px;color:#9aa1b5;">Sign in to sync your invoices across devices.</p>
        <input id="syncName" type="text" placeholder="Your name (only needed for new account)" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:8px;border-radius:8px;border:1px solid #333c52;background:#0f1219;color:#fff;">
        <input id="syncEmail" type="email" placeholder="Email" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:8px;border-radius:8px;border:1px solid #333c52;background:#0f1219;color:#fff;">
        <input id="syncPassword" type="password" placeholder="Password (min 6 chars)" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:6px;border-radius:8px;border:1px solid #333c52;background:#0f1219;color:#fff;">
        <div style="text-align:right;margin-bottom:10px;">
          <a href="#" id="syncForgotLink" style="color:#4c7dff;font-size:12px;text-decoration:none;">Forgot password?</a>
        </div>
        <div id="syncError" style="color:#ff6b6b;font-size:12px;margin-bottom:10px;min-height:14px;"></div>
        <div id="syncInfo" style="color:#6cd97e;font-size:12px;margin-bottom:10px;min-height:14px;"></div>
        <button id="syncLoginBtn" style="width:100%;padding:11px;border:none;border-radius:8px;background:#4c7dff;color:#fff;font-weight:600;margin-bottom:8px;">Sign In</button>
        <button id="syncSignupBtn" style="width:100%;padding:11px;border:none;border-radius:8px;background:transparent;color:#4c7dff;font-weight:600;border:1px solid #4c7dff;margin-bottom:8px;">Create Account</button>
        <button id="syncSkipBtn" style="width:100%;padding:9px;border:none;background:transparent;color:#6c7488;font-size:12px;">Continue without sync</button>
      </div>`;
    document.body.appendChild(wrap);

    const emailEl = wrap.querySelector("#syncEmail");
    const passEl = wrap.querySelector("#syncPassword");
    const errEl = wrap.querySelector("#syncError");
    const savedEmail = localStorage.getItem(LS_LAST_LOGIN_EMAIL);
    if (savedEmail) emailEl.value = savedEmail;

    const infoEl = wrap.querySelector("#syncInfo");
    function showErr(msg) {
      errEl.textContent = msg;
      infoEl.textContent = "";
    }
    function showInfo(msg) {
      infoEl.textContent = msg;
      errEl.textContent = "";
    }

    wrap.querySelector("#syncForgotLink").onclick = async (e) => {
      e.preventDefault();
      const email = emailEl.value.trim();
      if (!email) {
        showErr("Pehle apna email box mein likhein, phir 'Forgot password' dabayein.");
        return;
      }
      try {
        await auth.sendPasswordResetEmail(email);
        showInfo("Password reset link is email par bhej di gayi hai: " + email);
      } catch (e) {
        showErr(e.message);
      }
    };

    wrap.querySelector("#syncLoginBtn").onclick = async () => {
      showErr("");
      try {
        await auth.signInWithEmailAndPassword(emailEl.value.trim(), passEl.value);
        origSetItem(LS_LAST_LOGIN_EMAIL, emailEl.value.trim());
        await afterLogin(wrap);
      } catch (e) {
        showErr(e.message);
      }
    };

    wrap.querySelector("#syncSignupBtn").onclick = async () => {
      showErr("");
      try {
        const nameEl = wrap.querySelector("#syncName");
        const cred = await auth.createUserWithEmailAndPassword(emailEl.value.trim(), passEl.value);
        if (nameEl && nameEl.value.trim()) {
          await cred.user.updateProfile({ displayName: nameEl.value.trim() });
        }
        origSetItem(LS_LAST_LOGIN_EMAIL, emailEl.value.trim());
        await afterLogin(wrap);
      } catch (e) {
        showErr(e.message);
      }
    };

    wrap.querySelector("#syncSkipBtn").onclick = () => {
      wrap.remove();
    };
  }

  async function afterLogin(overlayEl) {
    const hadCloudData = await pullFromCloud();
    overlayEl.remove();
    if (hadCloudData) {
      // Data pulled from cloud — reload so the app reads the fresh data.
      location.reload();
    } else {
      // First time this account syncs — push current local data up.
      pushToCloud();
    }
    addStatusBadge();
  }

  let lastStatusText = "Synced ✓";
  function setStatus(text) {
    lastStatusText = text;
    const el = document.getElementById("syncStatusBadge");
    if (el && !el.dataset.expanded) el.textContent = text;
  }

  function addStatusBadge() {
    let badge = document.getElementById("syncStatusBadge");
    if (badge) return;
    badge = document.createElement("div");
    badge.id = "syncStatusBadge";
    badge.style.cssText =
      "position:fixed;bottom:8px;right:8px;background:#181c27;color:#9aa1b5;font-size:11px;padding:6px 12px;border-radius:20px;z-index:9998;font-family:Inter,sans-serif;opacity:.9;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);";
    badge.textContent = lastStatusText;
    badge.title = "Tap to see account / sign out";
    badge.onclick = () => {
      const user = auth.currentUser;
      if (!user) return;
      if (badge.dataset.expanded) {
        badge.dataset.expanded = "";
        badge.textContent = lastStatusText;
        badge.style.cssText = badge.style.cssText.replace("flex-direction:column;", "");
        return;
      }
      badge.dataset.expanded = "1";
      badge.innerHTML = "";
      const emailLine = document.createElement("div");
      emailLine.textContent = (user.displayName ? user.displayName + " — " : "Signed in: ") + user.email;
      emailLine.style.marginBottom = "6px";
      const signOutBtn = document.createElement("div");
      signOutBtn.textContent = "Sign out";
      signOutBtn.style.cssText = "color:#ff6b6b;font-weight:600;text-align:center;padding-top:4px;border-top:1px solid #333c52;";
      signOutBtn.onclick = (ev) => {
        ev.stopPropagation();
        auth.signOut().then(() => location.reload());
      };
      badge.appendChild(emailLine);
      badge.appendChild(signOutBtn);
      badge.style.cssText += "display:flex;flex-direction:column;padding:10px 14px;";
    };
    document.body.appendChild(badge);
  }

  // ---------- Boot ----------
  auth.onAuthStateChanged((user) => {
    if (user) {
      addStatusBadge();
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    // Show login only if not already signed in.
    if (!auth.currentUser) {
      // Give Firebase a moment to restore any existing session.
      setTimeout(() => {
        if (!auth.currentUser) buildLoginOverlay();
        else addStatusBadge();
      }, 400);
    }
  });
})();
