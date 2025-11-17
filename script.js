console.log("script.js loaded");

// ===========================================================
// UTIL
// ===========================================================
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"'`]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'
  }[c]));
}

// ===========================================================
// MAIN ON READY
// ===========================================================
document.addEventListener("DOMContentLoaded", () => {
  const isUserPage = !!document.getElementById("itemForm");
  const isAdminPage = location.pathname.endsWith("admin.html");

  if (isUserPage) setupUserPage();
  if (isAdminPage) setupAdminPage();
});

// ###########################################################
// ######################  USER PAGE  ########################
// ###########################################################
function setupUserPage() {

  // ---- DOM ----
  const itemForm = document.getElementById("itemForm");
  const previewModal = document.getElementById("previewModal");
  const previewContent = document.getElementById("previewContent");
  const closePreview = document.getElementById("closePreview");
  const confirmSubmit = document.getElementById("confirmSubmit");

  const filterEl = document.getElementById("filter");
  const searchEl = document.getElementById("search");
  const recentList = document.getElementById("recentList");

  const totalCountEl = document.getElementById("totalCount");
  const activeCountEl = document.getElementById("activeCount");
  const resolvedCountEl = document.getElementById("resolvedCount");

  const googleSignBtn = document.getElementById("googleSignBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userPreview = document.getElementById("userPreview");
  const avatar = document.getElementById("avatar");
  const userNameDisp = document.getElementById("userNameDisp");

  // ===========================================================
  // AUTH UI
  // ===========================================================
  googleSignBtn?.addEventListener("click", async () => {
    try {
      await window.signInWithPopup(window.auth, window.provider);
    } catch (err) {
      alert("Google Login Failed: " + err.message);
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    try {
      await window.signOut(window.auth);
    } catch (err) {
      alert("Logout failed: " + err.message);
    }
  });

  window.onAuthStateChanged(window.auth, user => {
    if (user) {
      googleSignBtn?.classList.add("hidden");
      userPreview?.classList.remove("hidden");
      avatar.textContent = (user.displayName || "U")[0].toUpperCase();
      userNameDisp.textContent = user.displayName || user.email || "User";
    } else {
      userPreview?.classList.add("hidden");
      googleSignBtn?.classList.remove("hidden");
    }

    renderRecent();
    loadMyReports();
  });

  // ===========================================================
  // PREVIEW + SUBMIT FLOW
  // ===========================================================
  itemForm?.addEventListener("submit", e => {
    e.preventDefault();
    const r = collectForm();
    if (!r) return alert("Fill all fields");

    previewContent.innerHTML = `
      <p><strong>Type:</strong> ${escapeHtml(r.type)}</p>
      <p><strong>Name:</strong> ${escapeHtml(r.name)}</p>
      <p><strong>Description:</strong> ${escapeHtml(r.description)}</p>
      <p><strong>Place:</strong> ${escapeHtml(r.place)}</p>
      <p><strong>Contact:</strong> ${escapeHtml(r.contact)}</p>
    `;

    previewModal.classList.remove("hidden");
  });

  closePreview?.addEventListener("click", () => {
    previewModal.classList.add("hidden");
  });

  confirmSubmit?.addEventListener("click", async () => {
    const r = collectForm();
    if (!r) return;

    const user = window.auth.currentUser;
    if (!user) {
      alert("You must sign in first.");
      return;
    }

    r.ownerEmail = user.email;
    r.ownerName = user.displayName || user.email;
    r.date = new Date().toISOString();
    r.claimed = false;
    r.resolved = false;

    try {
      await window.addDoc(window.collection(window.db, "reports"), r);
      itemForm.reset();
      previewModal.classList.add("hidden");
      await renderRecent();
      alert("Report submitted!");
    } catch (err) {
      alert("Submit failed: " + err.message);
    }
  });

  function collectForm() {
    const t = document.getElementById("type")?.value.trim();
    const n = document.getElementById("name")?.value.trim();
    const d = document.getElementById("description")?.value.trim();
    const p = document.getElementById("place")?.value.trim();
    const c = document.getElementById("contact")?.value.trim();
    if (!t || !n || !d || !p || !c) return null;
    return { type: t, name: n, description: d, place: p, contact: c };
  }

  // ===========================================================
  // LOAD ALL REPORTS
  // ===========================================================
  async function fetchReports() {
    const snap = await window.getDocs(window.collection(window.db, "reports"));
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return arr;
  }

  // ===========================================================
  // RENDER RECENT LIST
  // ===========================================================
  async function renderRecent() {
    const all = await fetchReports();

    totalCountEl.textContent = all.length;
    activeCountEl.textContent = all.filter(x => !x.claimed).length;
    resolvedCountEl.textContent = all.filter(x => x.claimed).length;

    let list = all;

    const f = filterEl?.value;
    const q = (searchEl?.value || "").toLowerCase();

    if (f && f !== "All") list = list.filter(x => x.type === f);
    if (q) list = list.filter(x =>
      x.name.toLowerCase().includes(q) ||
      x.place.toLowerCase().includes(q)
    );

    recentList.innerHTML = "";
    list.forEach(r => {
      const div = document.createElement("div");
      div.className = "p-3 bg-white rounded shadow";

      div.innerHTML = `
        <p class="text-xs text-gray-400">${escapeHtml(r.date)}</p>
        <p class="font-semibold">${escapeHtml(r.type)}: ${escapeHtml(r.name)}</p>
        <p>${escapeHtml(r.description)}</p>
        <p class="text-sm text-gray-500">📍 ${escapeHtml(r.place)}</p>

        <button class="claimBtn bg-blue-500 text-white px-2 py-1 rounded mt-2"
          data-id="${r.id}" ${r.claimed ? "disabled" : ""}>
          ${r.claimed ? "Claimed" : "Claim"}
        </button>
      `;

      recentList.appendChild(div);
    });

    document.querySelectorAll(".claimBtn").forEach(btn => {
      btn.addEventListener("click", () => claimItem(btn.dataset.id));
    });
  }

  // ===========================================================
  // CLAIM ITEM
  // ===========================================================
  async function claimItem(id) {
    const user = window.auth.currentUser;
    if (!user) return alert("You must sign in.");

    await window.updateDoc(
      window.doc(window.db, "reports", id),
      { claimed: true, claimedBy: user.email }
    );

    await renderRecent();
  }

  filterEl?.addEventListener("change", renderRecent);
  searchEl?.addEventListener("input", renderRecent);

  renderRecent();
  loadMyReports();

  // ===========================================================
  // MY REPORTS
  // ===========================================================
  async function loadMyReports() {
    const user = window.auth.currentUser;
    const list = document.getElementById("myReportsList");
    if (!list) return;

    if (!user) {
      list.innerHTML = "<p>Sign in to see your reports.</p>";
      return;
    }

    const q = window.query(
      window.collection(window.db, "reports"),
      window.where("ownerEmail", "==", user.email)
    );

    const snap = await window.getDocs(q);

    list.innerHTML = "";
    snap.forEach(d => {
      const r = d.data();
      const div = document.createElement("div");
      div.className = "p-3 border rounded mb-2";

      div.innerHTML = `
        <p class="text-xs text-gray-400">${escapeHtml(r.date)}</p>
        <p class="font-semibold">${escapeHtml(r.type)}: ${escapeHtml(r.name)}</p>
        <p>${escapeHtml(r.description)}</p>
        <p class="text-sm text-gray-500">📍 ${escapeHtml(r.place)}</p>
      `;

      list.appendChild(div);
    });
  }
}

// ###########################################################
// ######################  ADMIN PAGE ########################
// ###########################################################
function setupAdminPage() {

  if (!isAdminLoggedIn()) {
    const u = prompt("Admin username:");
    const p = prompt("Admin password:");
    if (u !== "admin" || p !== "4321") {
      alert("Invalid");
      location.href = "index.html";
      return;
    }
    setAdminLoggedIn();
  }

  const adminTable = document.getElementById("adminTable");
  const total = document.getElementById("a_totalCount");
  const pending = document.getElementById("a_pendingCount");
  const resolved = document.getElementById("a_resolvedCount");
  const adminSearch = document.getElementById("adminSearch");

  loadAdmin();

  adminSearch?.addEventListener("input", loadAdmin);

  async function loadAdmin() {
    const snap = await window.getDocs(window.collection(window.db, "reports"));
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));

    const q = (adminSearch.value || "").toLowerCase();
    const list = q ? arr.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.place.toLowerCase().includes(q)
    ) : arr;

    adminTable.innerHTML = "";

    arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    total.textContent = arr.length;
    pending.textContent = arr.filter(x => !x.claimed).length;
    resolved.textContent = arr.filter(x => x.claimed).length;

    list.forEach(r => {
      const div = document.createElement("div");
      div.className = "p-3 border rounded flex justify-between mb-2";

      div.innerHTML = `
        <div>
          <p class="text-xs">${escapeHtml(r.date)}</p>
          <p class="font-bold">${r.type}: ${r.name}</p>
          <p>${r.description}</p>
          <p class="text-sm text-gray-500">📍 ${r.place}</p>
        </div>

        <div class="flex flex-col gap-2 text-right">
          <button class="verify bg-blue-500 text-white px-2 py-1" data-id="${r.id}">
            Verify
          </button>

          <button class="resolve bg-green-500 text-white px-2 py-1" data-id="${r.id}">
            Resolve
          </button>

          <button class="delete bg-red-500 text-white px-2 py-1" data-id="${r.id}">
            Delete
          </button>
        </div>
      `;

      adminTable.appendChild(div);
    });

    document.querySelectorAll(".verify").forEach(btn => {
      btn.addEventListener("click", async () => {
        await window.updateDoc(window.doc(window.db, "reports", btn.dataset.id), {
          claimed: true
        });
        loadAdmin();
      });
    });

    document.querySelectorAll(".resolve").forEach(btn => {
      btn.addEventListener("click", async () => {
        await window.updateDoc(window.doc(window.db, "reports", btn.dataset.id), {
          claimed: true,
          resolved: true
        });
        loadAdmin();
      });
    });

    document.querySelectorAll(".delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete?")) return;
        await window.deleteDoc(window.doc(window.db, "reports", btn.dataset.id));
        loadAdmin();
      });
    });
  }

  function isAdminLoggedIn() {
    return localStorage.getItem("adminLoggedIn") === "true";
  }

  function setAdminLoggedIn() {
    localStorage.setItem("adminLoggedIn", "true");
  }
}

// END
