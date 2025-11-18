console.log("script.js loaded");

// Escape HTML helper
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"'`]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;', '`': '&#96;'
  }[c]));
}

document.addEventListener("DOMContentLoaded", () => {
  const isUserPage = !!document.getElementById("itemForm");
  const isAdminPage = location.pathname.endsWith("admin.html");

  if (isUserPage) setupUserPage();
  if (isAdminPage) setupAdminPage();
});

// ==================================================================
// ========================= USER PAGE ===============================
// ==================================================================
function setupUserPage() {
  console.log("User page running");

  const itemForm = document.getElementById("itemForm");
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
  const nameDisp = document.getElementById("userNameDisp");

 
// ===========================
// IMAGE UPLOAD + PREVIEW
// ===========================
let uploadedImageFile = null;
const imageInput = document.getElementById("itemImage");
const imagePreview = document.getElementById("imagePreview");

imageInput?.addEventListener("change", e => {
  uploadedImageFile = e.target.files[0] || null;

  // If no image → hide preview but DO NOT block submit
  if (!uploadedImageFile) {
    imagePreview.classList.add("hidden");
    return;
  }

  // Show preview instantly
  const reader = new FileReader();
  reader.onload = () => {
    imagePreview.src = reader.result;
    imagePreview.classList.remove("hidden");
  };
  reader.readAsDataURL(uploadedImageFile);
});


  // Login
  googleSignBtn?.addEventListener("click", async () => {
    try {
      await window.signInWithPopup(window.auth, window.provider);
    } catch (e) {
      alert("Login failed: " + e.message);
    }
  });

  logoutBtn?.addEventListener("click", () => {
    window.signOut(window.auth);
  });

  window.onAuthStateChanged(window.auth, user => {
    if (user) {
      googleSignBtn.classList.add("hidden");
      userPreview.classList.remove("hidden");
      avatar.textContent = (user.displayName || "U")[0];
      nameDisp.textContent = user.displayName || user.email;
    } else {
      googleSignBtn.classList.remove("hidden");
      userPreview.classList.add("hidden");
    }

    renderRecent();
    loadMyReports();
  });

  // -------------------------------------------
  // FORM SUBMIT (FINAL WORKING VERSION)
  // -------------------------------------------
  itemForm?.addEventListener("submit", async e => {
    e.preventDefault();

    const data = collectForm();
    if (!data) return alert("Fill all fields");

    const user = window.auth.currentUser;
    if (!user) return alert("Sign in to submit");

    data.ownerEmail = user.email;
    data.ownerName = user.displayName || user.email;
    data.date = new Date().toISOString();
    data.claimed = false;
    data.resolved = false;

    // Upload image if selected
    if (uploadedImageFile) {
      try {
        const storageRef = window.storageRef(window.storage, `images/${Date.now()}_${uploadedImageFile.name}`);
        const snap = await window.uploadBytes(storageRef, uploadedImageFile);
        data.imageURL = await window.getDownloadURL(snap.ref);
      } catch (err) {
        console.error(err);
        alert("Image upload failed");
        return;
      }
    } else {
      data.imageURL = null;
    }

    // Save to Firestore
    try {
      await window.addDoc(window.collection(window.db, "reports"), data);
      alert("Report submitted ✔");
      uploadedImageFile = null;
      itemForm.reset();
      //new
      imagePreview.classList.add("hidden");
      imagePreview.src = "";
      uploadedImageFile = null;
      //done adding

      renderRecent();
      loadMyReports();
    } catch (err) {
      alert("Submit failed: " + err.message);
    }
  });

  function collectForm() {
    const t = document.getElementById("type").value.trim();
    const n = document.getElementById("name").value.trim();
    const d = document.getElementById("description").value.trim();
    const p = document.getElementById("place").value.trim();
    const c = document.getElementById("contact").value.trim();
    if (!t || !n || !d || !p || !c) return null;
    return { type: t, name: n, description: d, place: p, contact: c };
  }

  // Fetch all reports
  async function fetchReports() {
    const snap = await window.getDocs(window.collection(window.db, "reports"));
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return arr;
  }

  // Render list
  async function renderRecent() {
    const all = await fetchReports();

    totalCountEl.textContent = all.length;
    activeCountEl.textContent = all.filter(x => !x.claimed).length;
    resolvedCountEl.textContent = all.filter(x => x.claimed).length;

    let list = [...all];
    //changed
   const f = filterEl?.value || "All";
   const q = (searchEl?.value || "").toLowerCase();
    //changed done

    if (f !== "All") list = list.filter(x => x.type === f);
    if (q) {
      list = list.filter(x =>
        x.name.toLowerCase().includes(q) ||
        x.place.toLowerCase().includes(q)
      );
    }

    recentList.innerHTML = "";

    list.forEach(r => {
      const div = document.createElement("div");
      div.className = "p-3 bg-white rounded shadow";

      div.innerHTML = `
        <p class="text-xs text-gray-400">${escapeHtml(r.date)}</p>
        <p class="font-semibold">${escapeHtml(r.type)}: ${escapeHtml(r.name)}</p>
        <p>${escapeHtml(r.description)}</p>
        <p class="text-sm text-gray-500">📍 ${escapeHtml(r.place)}</p>
        ${r.imageURL ? `<img src="${r.imageURL}" class="w-32 mt-2 rounded border" />` : ""}
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

  // Claim an item
  async function claimItem(id) {
    const user = window.auth.currentUser;
    if (!user) return alert("Sign in to claim");

    await window.updateDoc(window.doc(window.db, "reports", id), {
      claimed: true,
      claimedBy: user.email
    });

    renderRecent();
    loadMyReports();
  }

  filterEl.addEventListener("change", renderRecent);
  searchEl.addEventListener("input", renderRecent);

  renderRecent();
  loadMyReports();

  // My Reports
  async function loadMyReports() {
    const list = document.getElementById("myReportsList");
    const user = window.auth.currentUser;

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
      div.className = "p-3 border rounded";

      div.innerHTML = `
        <p class="text-xs text-gray-400">${escapeHtml(r.date)}</p>
        <p class="font-semibold">${escapeHtml(r.type)}: ${escapeHtml(r.name)}</p>
        <p>${escapeHtml(r.description)}</p>
        ${r.imageURL ? `<img src="${r.imageURL}" class="w-32 mt-2 rounded border" />` : ""}
        <p class="text-sm text-gray-500">📍 ${escapeHtml(r.place)}</p>
      `;

      list.appendChild(div);
    });
  }
}


// ==================================================================
// ======================= ADMIN PAGE ===============================
// ==================================================================
function setupAdminPage() {

  if (!isAdminLoggedIn()) {
    const u = prompt("Admin username:");
    const p = prompt("Admin password:");
    if (u !== "admin" || p !== "4321") {
      alert("Invalid credentials");
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

  adminSearch.addEventListener("input", loadAdmin);
  loadAdmin();

  async function loadAdmin() {
    const snap = await window.getDocs(window.collection(window.db, "reports"));

    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));

    arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const q = adminSearch.value.toLowerCase();
    const list = q
      ? arr.filter(r =>
          r.name.toLowerCase().includes(q) ||
          r.place.toLowerCase().includes(q)
        )
      : arr;

    adminTable.innerHTML = "";

    total.textContent = arr.length;
    pending.textContent = arr.filter(r => !r.claimed).length;
    resolved.textContent = arr.filter(r => r.claimed).length;

    list.forEach(r => {
      const div = document.createElement("div");
      div.className = "p-3 border rounded flex justify-between mb-2";

      div.innerHTML = `
        <div>
          <p class="text-xs">${escapeHtml(r.date)}</p>
          <p class="font-bold">${escapeHtml(r.type)}: ${escapeHtml(r.name)}</p>
          <p>${escapeHtml(r.description)}</p>
          ${r.imageURL ? `<img src="${r.imageURL}" class="w-24 mt-2 rounded border">` : ""}
          <p class="text-sm text-gray-500">📍 ${escapeHtml(r.place)}</p>
        </div>

        <div class="flex flex-col gap-2 text-right">
          <button class="verify bg-blue-500 text-white px-2 py-1" data-id="${r.id}">Verify</button>
          <button class="resolve bg-green-500 text-white px-2 py-1" data-id="${r.id}">Resolve</button>
          <button class="delete bg-red-500 text-white px-2 py-1" data-id="${r.id}">Delete</button>
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
        if (!confirm("Delete this report?")) return;
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
