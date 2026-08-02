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
        <input id="syncEmail" type="email" placeholder="Email" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:8px;border-radius:8px;border:1px solid #333c52;background:#0f1219;color:#fff;">
        <input id="syncPassword" type="password" placeholder="Password (min 6 chars)" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:12px;border-radius:8px;border:1px solid #333c52;background:#0f1219;color:#fff;">
        <div id="syncError" style="color:#ff6b6b;font-size:12px;margin-bottom:10px;min-height:14px;"></div>
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

    function showErr(msg) {
      errEl.textContent = msg;
    }

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
        await auth.createUserWithEmailAndPassword(emailEl.value.trim(), passEl.value);
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

  function setStatus(text) {
    const el = document.getElementById("syncStatusBadge");
    if (el) el.textContent = text;
  }

  function addStatusBadge() {
    if (document.getElementById("syncStatusBadge")) return;
    const badge = document.createElement("div");
    badge.id = "syncStatusBadge";
    badge.style.cssText =
      "position:fixed;bottom:8px;right:8px;background:#181c27;color:#9aa1b5;font-size:11px;padding:5px 10px;border-radius:20px;z-index:9998;font-family:Inter,sans-serif;opacity:.85;";
    badge.textContent = "Synced ✓";
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
