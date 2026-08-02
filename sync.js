// Cloud Sync for Digital Solutions Invoicing
// Keeps localStorage as the source of truth for the app (nothing else changes),
// but mirrors these keys to Firestore so every device with the same login sees the same data.
// Supports an "admin" role (set manually in Firestore) that can view/edit any user's data.
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
  const SS_ADMIN_TARGET_UID = "ds_admin_target_uid";
  const SS_ADMIN_TARGET_EMAIL = "ds_admin_target_email";

  const auth = firebase.auth();
  const db = firebase.firestore();

  const origSetItem = localStorage.setItem.bind(localStorage);
  let pushTimer = null;
  let suppressPush = false; // true while we are writing pulled cloud data back into localStorage
  let myRole = "user";

  function targetUid() {
    return sessionStorage.getItem(SS_ADMIN_TARGET_UID) || (auth.currentUser && auth.currentUser.uid);
  }
  function isImpersonating() {
    const t = sessionStorage.getItem(SS_ADMIN_TARGET_UID);
    return !!t && auth.currentUser && t !== auth.currentUser.uid;
  }

  localStorage.setItem = function (key, value) {
    origSetItem(key, value);
    if (!suppressPush && SYNC_KEYS.includes(key) && auth.currentUser) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(pushToCloud, 1200);
    }
  };

  async function pushToCloud() {
    const uid = targetUid();
    if (!uid || !auth.currentUser) return;
    const data = { updatedAt: Date.now() };
    if (!isImpersonating()) {
      data.email = auth.currentUser.email;
      data.name = auth.currentUser.displayName || "";
    }
    SYNC_KEYS.forEach((k) => (data[k] = localStorage.getItem(k) || null));
    try {
      await db.collection("users").doc(uid).set(data, { merge: true });
      setStatus("Synced ✓");
    } catch (e) {
      console.error("Sync push failed", e);
      setStatus("Sync failed");
    }
  }

  async function pullFromCloud(uid) {
    uid = uid || targetUid();
    if (!uid) return false;
    try {
      const doc = await db.collection("users").doc(uid).get();
      if (doc.exists) {
        const data = doc.data();
        suppressPush = true;
        SYNC_KEYS.forEach((k) => {
          origSetItem(k, data[k] !== undefined && data[k] !== null ? data[k] : (k === "ds_invoice_counter" ? "0" : "[]"));
        });
        suppressPush = false;
        myRole = data.role || "user";
        return true;
      }
    } catch (e) {
      console.error("Sync pull failed", e);
    }
    return false;
  }

  const fieldStyle =
    "width:100%;box-sizing:border-box;padding:10px;margin-bottom:8px;border-radius:8px;border:1px solid #333c52;background:#0f1219;color:#fff;";
  const primaryBtn =
    "width:100%;padding:11px;border:none;border-radius:8px;background:#4c7dff;color:#fff;font-weight:600;margin-bottom:8px;";
  const secondaryBtn =
    "width:100%;padding:11px;border:none;border-radius:8px;background:transparent;color:#4c7dff;font-weight:600;border:1px solid #4c7dff;margin-bottom:8px;";
  const cardStyle =
    "background:#181c27;border-radius:14px;padding:24px;max-width:340px;width:100%;color:#e8eaf0;box-shadow:0 10px 40px rgba(0,0,0,.5);";

  let overlayEl = null;
  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement("div");
    overlayEl.id = "syncLoginOverlay";
    overlayEl.style.cssText =
      "position:fixed;inset:0;background:rgba(10,12,20,.92);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;padding:16px;";
    document.body.appendChild(overlayEl);
    return overlayEl;
  }
  function closeOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
  }

  // ---------- Screen 1: Sign In ----------
  function showSignInScreen(prefill, infoMsg) {
    const wrap = ensureOverlay();
    wrap.innerHTML = `
      <div style="${cardStyle}">
        <h2 style="margin:0 0 4px;font-size:19px;">Cloud Sync — Sign In</h2>
        <p style="margin:0 0 16px;font-size:13px;color:#9aa1b5;">Sign in to sync your invoices across devices.</p>
        <input id="syncEmail" type="email" placeholder="Email" style="${fieldStyle}">
        <input id="syncPassword" type="password" placeholder="Password" style="${fieldStyle}margin-bottom:6px;">
        <div style="text-align:right;margin-bottom:10px;">
          <a href="#" id="syncForgotLink" style="color:#4c7dff;font-size:12px;text-decoration:none;">Forgot password?</a>
        </div>
        <div id="syncError" style="color:#ff6b6b;font-size:12px;margin-bottom:8px;min-height:14px;"></div>
        <div id="syncInfo" style="color:#6cd97e;font-size:12px;margin-bottom:8px;min-height:14px;"></div>
        <button id="syncLoginBtn" style="${primaryBtn}">Sign In</button>
        <button id="syncGoSignupBtn" style="${secondaryBtn}">Create New Account</button>
        <button id="syncSkipBtn" style="width:100%;padding:9px;border:none;background:transparent;color:#6c7488;font-size:12px;">Continue without sync</button>
      </div>`;

    const emailEl = wrap.querySelector("#syncEmail");
    const passEl = wrap.querySelector("#syncPassword");
    const errEl = wrap.querySelector("#syncError");
    const infoEl = wrap.querySelector("#syncInfo");

    const savedEmail = prefill || localStorage.getItem(LS_LAST_LOGIN_EMAIL);
    if (savedEmail) emailEl.value = savedEmail;
    if (infoMsg) infoEl.textContent = infoMsg;

    function showErr(msg) {
      errEl.textContent = msg || "";
      infoEl.textContent = "";
    }

    wrap.querySelector("#syncForgotLink").onclick = async (ev) => {
      ev.preventDefault();
      const email = emailEl.value.trim();
      if (!email) return showErr("Pehle apna email box mein likhein, phir 'Forgot password' dabayein.");
      try {
        await auth.sendPasswordResetEmail(email);
        showErr("");
        infoEl.textContent = "Password reset link is email par bhej di gayi hai: " + email;
      } catch (e) {
        showErr(e.message);
      }
    };

    wrap.querySelector("#syncLoginBtn").onclick = async () => {
      showErr("");
      try {
        await auth.signInWithEmailAndPassword(emailEl.value.trim(), passEl.value);
        origSetItem(LS_LAST_LOGIN_EMAIL, emailEl.value.trim());
        sessionStorage.removeItem(SS_ADMIN_TARGET_UID);
        sessionStorage.removeItem(SS_ADMIN_TARGET_EMAIL);
        await afterLogin();
      } catch (e) {
        showErr(e.message);
      }
    };

    wrap.querySelector("#syncGoSignupBtn").onclick = () => showSignUpScreen();
    wrap.querySelector("#syncSkipBtn").onclick = () => closeOverlay();
  }

  // ---------- Screen 2: Create Account (separate box) ----------
  function showSignUpScreen() {
    const wrap = ensureOverlay();
    wrap.innerHTML = `
      <div style="${cardStyle}">
        <h2 style="margin:0 0 4px;font-size:19px;">Create Account</h2>
        <p style="margin:0 0 16px;font-size:13px;color:#9aa1b5;">Fill in your details to create a new sync account.</p>
        <input id="suName" type="text" placeholder="Your name" style="${fieldStyle}">
        <input id="suEmail" type="email" placeholder="Email" style="${fieldStyle}">
        <input id="suPassword" type="password" placeholder="Password (min 6 chars)" style="${fieldStyle}">
        <input id="suConfirm" type="password" placeholder="Confirm password" style="${fieldStyle}">
        <div id="suError" style="color:#ff6b6b;font-size:12px;margin-bottom:10px;min-height:14px;"></div>
        <button id="suSubmitBtn" style="${primaryBtn}">Submit</button>
        <button id="suBackBtn" style="width:100%;padding:9px;border:none;background:transparent;color:#6c7488;font-size:12px;">Back to Sign In</button>
      </div>`;

    const nameEl = wrap.querySelector("#suName");
    const emailEl = wrap.querySelector("#suEmail");
    const passEl = wrap.querySelector("#suPassword");
    const confirmEl = wrap.querySelector("#suConfirm");
    const errEl = wrap.querySelector("#suError");
    function showErr(msg) { errEl.textContent = msg || ""; }

    wrap.querySelector("#suBackBtn").onclick = () => showSignInScreen();

    wrap.querySelector("#suSubmitBtn").onclick = async () => {
      showErr("");
      const name = nameEl.value.trim();
      const email = emailEl.value.trim();
      const pass = passEl.value;
      const confirm = confirmEl.value;
      if (!name) return showErr("Apna naam likhein.");
      if (!email) return showErr("Email likhein.");
      if (pass.length < 6) return showErr("Password kam se kam 6 characters ka hona chahiye.");
      if (pass !== confirm) return showErr("Password aur Confirm password match nahi kar rahe.");

      try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await cred.user.updateProfile({ displayName: name });
        await db.collection("users").doc(cred.user.uid).set(
          { email, name, role: "user", createdAt: Date.now() },
          { merge: true }
        );
        origSetItem(LS_LAST_LOGIN_EMAIL, email);
        await auth.signOut();
        showSignInScreen(email, "Account create ho gaya — ab neeche sign in karein.");
      } catch (e) {
        showErr(e.message);
      }
    };
  }

  async function afterLogin() {
    const hadCloudData = await pullFromCloud();
    closeOverlay();
    if (hadCloudData) {
      location.reload();
    } else {
      pushToCloud();
    }
    addStatusBadge();
  }

  // ---------- Inject styles for the in-header status line ----------
  (function injectSyncStyles() {
    if (document.getElementById("syncPositionStyles")) return;
    const style = document.createElement("style");
    style.id = "syncPositionStyles";
    style.textContent = `
      #syncStatusLine{
        font-family:Inter,sans-serif; font-size:11px; color:#c7cbd6;
        background:rgba(255,255,255,.06); border-radius:8px;
        padding:6px 9px; margin-top:10px; line-height:1.5;
      }
      #syncStatusLine .syncAction{ color:#f5a623; font-weight:700; cursor:pointer; margin-right:10px; white-space:nowrap; }
      #syncStatusLine .syncAction:last-child{ margin-right:0; }
      @media (max-width:760px){ #syncStatusLine{ margin-top:8px; } }
    `;
    document.head.appendChild(style);
  })();

  // ---------- Status line — lives inside the app's own header/sidebar (no overlap with bottom nav) ----------
  let lastStatusText = "Synced ✓";
  function setStatus(text) {
    lastStatusText = text;
    renderStatusLine();
  }

  function renderStatusLine() {
    const line = document.getElementById("syncStatusLine");
    if (!line) return;
    const u = auth.currentUser;
    line.innerHTML = "";
    if (!u) return;

    const info = document.createElement("div");
    if (isImpersonating()) {
      const targetEmail = sessionStorage.getItem(SS_ADMIN_TARGET_EMAIL) || "user";
      info.textContent = "🔧 Viewing: " + targetEmail + " — " + lastStatusText;
    } else {
      info.textContent = u.email + (myRole === "admin" ? " (admin)" : "") + " — " + lastStatusText;
    }
    info.style.marginBottom = "4px";
    info.style.wordBreak = "break-all";
    line.appendChild(info);

    const actionsRow = document.createElement("div");

    if (isImpersonating()) {
      const backBtn = document.createElement("span");
      backBtn.className = "syncAction";
      backBtn.textContent = "↩ Return to my account";
      backBtn.onclick = () => returnToOwnAccount();
      actionsRow.appendChild(backBtn);
    }

    if (myRole === "admin" && !isImpersonating()) {
      const adminBtn = document.createElement("span");
      adminBtn.className = "syncAction";
      adminBtn.textContent = "🛠 Admin Panel";
      adminBtn.onclick = () => showAdminPanel();
      actionsRow.appendChild(adminBtn);
    }

    const logoutBtn = document.createElement("span");
    logoutBtn.className = "syncAction";
    logoutBtn.style.color = "#ff6b6b";
    logoutBtn.textContent = "Logout";
    logoutBtn.onclick = () => {
      sessionStorage.removeItem(SS_ADMIN_TARGET_UID);
      sessionStorage.removeItem(SS_ADMIN_TARGET_EMAIL);
      auth.signOut().then(() => location.reload());
    };
    actionsRow.appendChild(logoutBtn);

    line.appendChild(actionsRow);
  }

  function addStatusBadge() {
    let line = document.getElementById("syncStatusLine");
    if (!line) {
      line = document.createElement("div");
      line.id = "syncStatusLine";
      const rail = document.querySelector(".rail");
      if (rail) rail.appendChild(line);
      else document.body.appendChild(line);
    }
    renderStatusLine();
  }

  function returnToOwnAccount() {
    sessionStorage.removeItem(SS_ADMIN_TARGET_UID);
    sessionStorage.removeItem(SS_ADMIN_TARGET_EMAIL);
    pullFromCloud(auth.currentUser.uid).then(() => location.reload());
  }

  // ---------- Admin panel ----------
  async function showAdminPanel() {
    const wrap = ensureOverlay();
    wrap.innerHTML = `
      <div style="${cardStyle}max-width:420px;max-height:80vh;overflow-y:auto;">
        <h2 style="margin:0 0 4px;font-size:19px;">Admin Panel — Users</h2>
        <p style="margin:0 0 14px;font-size:12px;color:#9aa1b5;">Kisi bhi user ka data dekhne/edit karne ke liye "View/Edit" dabayein.</p>
        <div id="adminUserList" style="margin-bottom:14px;">Loading...</div>
        <button id="adminCloseBtn" style="width:100%;padding:9px;border:none;background:transparent;color:#6c7488;font-size:12px;">Close</button>
      </div>`;
    wrap.querySelector("#adminCloseBtn").onclick = () => closeOverlay();

    const listEl = wrap.querySelector("#adminUserList");
    try {
      const snap = await db.collection("users").get();
      listEl.innerHTML = "";
      snap.forEach((doc) => {
        const d = doc.data();
        const row = document.createElement("div");
        row.style.cssText =
          "display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #262b3a;";
        const isMe = doc.id === auth.currentUser.uid;
        const info = document.createElement("div");
        info.style.fontSize = "13px";
        info.innerHTML = `<div>${d.name || "(no name)"} ${d.role === "admin" ? "⭐" : ""}</div><div style="color:#9aa1b5;font-size:11px;">${d.email || doc.id}</div>`;
        row.appendChild(info);
        if (!isMe) {
          const viewBtn = document.createElement("button");
          viewBtn.textContent = "View/Edit";
          viewBtn.style.cssText =
            "padding:6px 10px;border:none;border-radius:6px;background:#4c7dff;color:#fff;font-size:12px;font-weight:600;";
          viewBtn.onclick = () => switchToUser(doc.id, d.email || doc.id);
          row.appendChild(viewBtn);
        } else {
          const meTag = document.createElement("span");
          meTag.textContent = "(you)";
          meTag.style.cssText = "font-size:11px;color:#6c7488;";
          row.appendChild(meTag);
        }
        listEl.appendChild(row);
      });
      if (snap.empty) listEl.textContent = "Koi user nahi mila.";
    } catch (e) {
      listEl.textContent = "Error loading users: " + e.message;
    }
  }

  async function switchToUser(uid, email) {
    // Make sure the admin's own latest edits are saved first.
    if (!isImpersonating()) await pushToCloud();
    sessionStorage.setItem(SS_ADMIN_TARGET_UID, uid);
    sessionStorage.setItem(SS_ADMIN_TARGET_EMAIL, email);
    await pullFromCloud(uid);
    location.reload();
  }

  // ---------- Boot: wait for Firebase to resolve the real session before deciding ----------
  let resolved = false;
  auth.onAuthStateChanged(async (user) => {
    resolved = true;
    if (user) {
      // Refresh role from own profile doc (not the impersonated one).
      try {
        const ownDoc = await db.collection("users").doc(user.uid).get();
        myRole = ownDoc.exists ? ownDoc.data().role || "user" : "user";
      } catch (e) {
        myRole = "user";
      }
      addStatusBadge();
      closeOverlay();
      renderAccountSettingsPanel();
    } else if (document.readyState !== "loading") {
      showSignInScreen();
      renderAccountSettingsPanel();
    }
  });

  function renderAccountSettingsPanel() {
    const statusEl = document.getElementById("accountSyncStatus");
    const bodyEl = document.getElementById("accountSyncBody");
    if (!statusEl || !bodyEl) return;
    const user = auth.currentUser;

    if (!user) {
      statusEl.textContent = "Not signed in — data is only stored on this device.";
      bodyEl.innerHTML = "";
      return;
    }

    statusEl.textContent = (isImpersonating()
      ? "🔧 Admin mode — viewing " + (sessionStorage.getItem(SS_ADMIN_TARGET_EMAIL) || "another user")
      : "Signed in as " + user.email + (myRole === "admin" ? " (admin)" : ""));

    bodyEl.innerHTML = `
      <div style="margin-bottom:10px;">
        <label class="opt" style="display:block;margin-bottom:4px;">New password</label>
        <input id="accNewPass" type="password" placeholder="Min 6 characters" style="width:100%;box-sizing:border-box;padding:9px;border-radius:8px;border:1px solid #ccc;margin-bottom:8px;">
        <button id="accChangePassBtn" class="btn btn-primary" type="button" style="padding:8px 14px;">Update Password</button>
        <span id="accPassMsg" style="font-size:12px;margin-left:8px;"></span>
      </div>
      ${myRole === "admin" ? '<button id="accAdminPanelBtn" class="btn" type="button" style="padding:8px 14px;margin-top:6px;">🛠 Open Admin Panel</button>' : ""}
    `;

    document.getElementById("accChangePassBtn").onclick = async () => {
      const pass = document.getElementById("accNewPass").value;
      const msg = document.getElementById("accPassMsg");
      if (!pass || pass.length < 6) {
        msg.textContent = "Password kam se kam 6 characters ka hona chahiye.";
        msg.style.color = "#ff6b6b";
        return;
      }
      try {
        await auth.currentUser.updatePassword(pass);
        msg.textContent = "Password update ho gaya ✓";
        msg.style.color = "#2a9d5c";
        document.getElementById("accNewPass").value = "";
      } catch (e) {
        msg.textContent = e.code === "auth/requires-recent-login"
          ? "Security ke liye pehle sign out karke dobara login karein, phir password change karein."
          : e.message;
        msg.style.color = "#ff6b6b";
      }
    };

    const adminBtn = document.getElementById("accAdminPanelBtn");
    if (adminBtn) adminBtn.onclick = showAdminPanel;
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (!resolved && !auth.currentUser) showSignInScreen();
    }, 2500);
  });
})();
