console.log("script.js loaded");

// Escape HTML helper
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"'`]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;', '`': '&#96;'
  }[c]));
}

// Ensure execution is within the correct page context
document.addEventListener("DOMContentLoaded", () => {
  const isUserPage = !!document.getElementById("itemForm");
  const isAdminPage = location.pathname.endsWith("admin.html");

  if (isUserPage) setupUserPage();
  if (isAdminPage) setupAdminPage();

  // *** OLD MODAL LISTENERS REMOVED FROM HERE ***
  // *** THEY ARE NOW INSIDE setupUserPage() ***
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

  // --- NEW: Claim Modal Declarations and Event Listeners (MOVED HERE) ---
  const claimModal = document.getElementById('claimModal');
  const closeClaimModalBtn = document.getElementById('closeClaimModal');
  const claimForm = document.getElementById('claimForm');
  const claimMessage = document.getElementById('claimMessage'); // Added for safety

  // Close modal buttons
  closeClaimModalBtn?.addEventListener('click', () => { // Added optional chaining
    claimModal?.classList.remove('flex');
    claimModal?.classList.add('hidden');
  });

  // Close modal when clicking outside
 window.addEventListener('click', (event) => {
    const modal = document.getElementById('claimModal');
    if (!modal) return; // SAFETY FIX

    if (event.target === modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
});


  // Handle Claim Form Submission
  claimForm?.addEventListener('submit', (event) => { // Added optional chaining
    event.preventDefault();

    const claimDetails = {
      reportId: document.getElementById('reportIdToClaim').value,
      finderUid: document.getElementById('finderUidToClaim').value,
      color: document.getElementById('verificationColor').value.trim(),
      marking: document.getElementById('verificationMarking').value.trim(),
      contents: document.getElementById('verificationContents').value.trim(),
    };

    submitClaimVerification(claimDetails);
  });
  // --- END MOVED BLOCK ---

  // ===========================
  // IMAGE UPLOAD + PREVIEW
  // ===========================
  let uploadedImageFile = null;
  const imageInput = document.getElementById("itemImage");
  const imagePreview = document.getElementById("imagePreview");

  // Make Upload Image button open file picker
  const imageBtn = document.getElementById("imageBtn");
  imageBtn?.addEventListener("click", () => {
    imageInput.click();
  });
  //added broken image preview handling

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
  // FORM SUBMIT
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
    // NEW: Store the reporter's UID (Correctly retained from your attempt)
    data.reporterUid = user.uid;
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
      
      if(imagePreview){
      imagePreview.classList.add("hidden");
      imagePreview.src = "";
      uploadedImageFile = null;
      }

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
    
    const f = filterEl?.value || "All";
    const q = (searchEl?.value || "").toLowerCase();
    
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

      // Determine button status and text based on 'claimed' or 'status'
      const isDisabled = r.claimed || r.status === 'Pending Verification';
      const buttonText = r.claimed 
          ? "Claimed" 
          : (r.status === 'Pending Verification' ? "Pending" : "Claim");
      const buttonColor = r.status === 'Pending Verification' ? 'bg-yellow-500' : 'bg-indigo-500';

      div.innerHTML = `
        <p class="text-xs text-gray-400">${escapeHtml(r.date)}</p>
        <p class="font-semibold">${escapeHtml(r.type)}: ${escapeHtml(r.name)}</p>
        <p>${escapeHtml(r.description)}</p>
        <p class="text-sm text-gray-500">📍 ${escapeHtml(r.place)}</p>
        ${r.imageURL ? `<img src="${r.imageURL}" class="w-32 mt-2 rounded border" />` : ""}
        
        <button 
          class="claimBtn ${buttonColor} text-white px-3 py-1 rounded-full mt-2 hover:bg-indigo-600 transition"
          onclick="window.openClaimModal('${r.id}', '${r.reporterUid}', '${r.type}')"

          ${isDisabled ? "disabled" : ""}>
          ${buttonText}
        </button>
      `;

      recentList.appendChild(div);
    });
    
    // *** REMOVED OBSOLETE document.querySelectorAll(".claimBtn") listener ***
  }

  // *** REMOVED OBSOLETE claimItem function ***

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

// --- NEW CLAIM VERIFICATION LOGIC (Kept outside for global access by onclick) ---

/**
 * Handles the click on the 'Claim' button in the recent list.
 * @param {string} reportId - The unique ID of the report.
 * @param {string} finderUid - The UID of the user who submitted the report (the finder/reporter).
 */
window.openClaimModal = (reportId, finderUid, itemType) => {

    const claimModal = document.getElementById('claimModal');
    const claimMessage = document.getElementById('claimMessage');
    const claimForm = document.getElementById('claimForm');

    // Check if the user is authenticated (required for claiming)
    if (!auth.currentUser) {
        alert("You must be signed in to submit a claim.");
        return;
    }
    
    // Check if the user is trying to claim their own reported item (prevent self-claiming)
    // Prevent only claiming your own FOUND item
if (auth.currentUser.uid === finderUid && itemType === "Found") {
    alert("You cannot claim an item you reported as FOUND.");
    return;
}


    // Set the necessary data into the hidden fields
    document.getElementById('reportIdToClaim').value = reportId;
    document.getElementById('finderUidToClaim').value = finderUid;

    // Reset and show the modal
    claimForm.reset();
    claimMessage.textContent = '';
    claimMessage.className = 'text-center mt-3 text-sm font-medium';
    claimModal.classList.remove('hidden');
    claimModal.classList.add('flex');
}

/**
 * Submits the verification details to Firebase.
 */
/**
 * Submits the verification details to Firebase.
 */
async function submitClaimVerification(claimDetails) {
    // Safely get element
    const claimMessage = document.getElementById('claimMessage'); 
    const reportId = claimDetails.reportId;
    
    // Using global variables exposed in index.html module script
    const reportRef = window.doc(window.db, "reports", reportId); 
    const auth = window.auth;

    claimMessage.textContent = 'Submitting verification...';
    claimMessage.style.color = '#4f46e5'; // Indigo

    try {
        // Update the Firebase document (SUCCESSFUL STEP)
        await window.updateDoc(reportRef, {
            status: "Pending Verification",
            claimerUid: auth.currentUser.uid,
            claimerName: auth.currentUser.displayName,
            claimerEmail: auth.currentUser.email,
            verificationAnswers: {
                color: claimDetails.color,
                marking: claimDetails.marking,
                contents: claimDetails.contents,
            },
            claimTimestamp: new Date(),
        });

        claimMessage.textContent = '✅ Claim details submitted! The finder has been notified.';
        claimMessage.style.color = '#10b981'; // Green

        // Optionally, close the modal after a delay
        setTimeout(() => {
            // ⭐ CRITICAL FIX APPLIED HERE: Use optional chaining on the modal element.
            const modal = document.getElementById('claimModal');
            modal?.classList.remove('flex');
            modal?.classList.add('hidden');
            
            // Note: Since renderRecent is scoped, you'd need a more complex solution to trigger a re-render
            // from this global function, but for now, the primary crash is fixed.
        }, 3000);

    } catch (error) {
        console.error("Error submitting claim verification:", error);
        claimMessage.textContent = `❌ Submission failed: ${error.message}`;
        claimMessage.style.color = '#ef4444'; // Red
    }
}
// --- END NEW CLAIM VERIFICATION LOGIC ---

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

    // Calculate counts based on the whole dataset (arr), not the filtered list
    total.textContent = arr.length;
    // Check for both 'claimed' and the new 'status' field for active count
    pending.textContent = arr.filter(r => !r.claimed && r.status !== 'Pending Verification').length; 
    resolved.textContent = arr.filter(r => r.claimed).length;

    list.forEach(r => {
      const div = document.createElement("div");
      div.className = "p-3 border rounded flex justify-between mb-2";

      // Display claim/verification status clearly in admin panel
      let statusInfo = '';
     if (r.status === 'Pending Verification' && r.claimerName) {
    statusInfo = `
        <p class="text-xs text-yellow-600 font-semibold mt-1">🟡 PENDING CLAIM by ${escapeHtml(r.claimerName)}</p>
        
        <p class="text-xs italic text-gray-500">Color: ${escapeHtml(r.verificationAnswers?.color || 'N/A')}</p>
        <p class="text-xs italic text-gray-500">Marking: ${escapeHtml(r.verificationAnswers?.marking || 'N/A')}</p>
        <p class="text-xs italic text-gray-500">Contents: ${escapeHtml(r.verificationAnswers?.contents || 'N/A')}</p>
    `;
}
else if (r.status === "Verified" && !r.resolved) {
    statusInfo = `
        <p class="text-xs text-blue-600 font-semibold mt-1">🔵 VERIFIED (Awaiting Handover)</p>

        <p class="text-xs italic text-gray-500">Color: ${escapeHtml(r.verificationAnswers?.color || 'N/A')}</p>
        <p class="text-xs italic text-gray-500">Marking: ${escapeHtml(r.verificationAnswers?.marking || 'N/A')}</p>
        <p class="text-xs italic text-gray-500">Contents: ${escapeHtml(r.verificationAnswers?.contents || 'N/A')}</p>
    `;
}
else if (r.resolved) {
    statusInfo = `
        <p class="text-xs text-green-600 font-semibold mt-1">🟢 RESOLVED / RETURNED</p>

        <p class="text-xs italic text-gray-500">Color: ${escapeHtml(r.verificationAnswers?.color || 'N/A')}</p>
        <p class="text-xs italic text-gray-500">Marking: ${escapeHtml(r.verificationAnswers?.marking || 'N/A')}</p>
        <p class="text-xs italic text-gray-500">Contents: ${escapeHtml(r.verificationAnswers?.contents || 'N/A')}</p>
    `;
}
else {
    statusInfo = `
        <p class="text-xs text-red-600 font-semibold mt-1">🔴 UNCLAIMED</p>
    `;
}


      div.innerHTML = `
  <div>
    <p class="text-xs">${escapeHtml(r.date)}</p>
    <p class="font-bold">${escapeHtml(r.type)}: ${escapeHtml(r.name)}</p>
    <p>${escapeHtml(r.description)}</p>

    <p class="text-xs text-gray-500">👤 Reported by: ${escapeHtml(r.ownerEmail || "Unknown")}</p>

    ${r.imageURL ? `<img src="${r.imageURL}" class="w-24 mt-2 rounded border">` : ""}

    <p class="text-sm text-gray-500">📍 ${escapeHtml(r.place)}</p>

    ${statusInfo}

    ${r.claimerEmail ? `<p class="text-xs text-indigo-600 mt-1">📩 Claimed by: ${escapeHtml(r.claimerEmail)}</p>` : ""}
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
      claimed: true,
      resolved: false,
      status: "Verified"
    });

    alert("Claim verified ✔ Now waiting for actual handover.");
    loadAdmin();
  });
});


    document.querySelectorAll(".resolve").forEach(btn => {
      btn.addEventListener("click", async () => {
        await window.updateDoc(window.doc(window.db, "reports", btn.dataset.id), {
          claimed: true,
          resolved: true,
          status: "Resolved/Returned"
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
