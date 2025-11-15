/* script.js - Unified and fixed for index.html + admin.html
   - Requires: index.html ids: itemForm, type, name, description, place, contact,
                previewModal, previewContent, closePreview, confirmSubmit,
                recentList, totalCount, activeCount, resolvedCount,
                googleModal, mockName, mockEmail, googleSignBtn, googleCancel, googleConfirm, logoutBtn, userPreview, avatar, userNameDisp
   - admin.html ids: adminTable, a_totalCount, a_pendingCount, a_resolvedCount, adminSearch, exportBtn
*/

(() => {
  // Admin credentials (local demo)
  const ADMIN_USER = 'admin';
  const ADMIN_PASS = '4321';

  // Storage key
  const REPORTS_KEY = 'reports';
  const USER_KEY = 'lf_user';

  // Single DOMContentLoaded entry
  document.addEventListener('DOMContentLoaded', () => {
    // Ensure storage exists
    if (!localStorage.getItem(REPORTS_KEY)) localStorage.setItem(REPORTS_KEY, JSON.stringify([]));

    // Setup UI if on index (user) page
    if (document.getElementById('itemForm')) {
      setupUserPage();
    }

    // Setup admin page if loaded
    if (location.pathname.endsWith('admin.html') || document.title.toLowerCase().includes('admin')) {
      setupAdminPage();
    }
  });

  /* ---------------------- Shared helpers ---------------------- */
  function readReports() {
    try {
      return JSON.parse(localStorage.getItem(REPORTS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function writeReports(arr) {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(arr));
  }
  function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; }
  }
  function setCurrentUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }
  function clearCurrentUser() { localStorage.removeItem(USER_KEY); }

  /* ---------------------- USER PAGE ---------------------- */
  function setupUserPage() {
    // Elements (may be missing in some variants)
    const itemForm = document.getElementById('itemForm');
    const previewModal = document.getElementById('previewModal');
    const previewContent = document.getElementById('previewContent');
    const closePreview = document.getElementById('closePreview');
    const confirmSubmit = document.getElementById('confirmSubmit');
    const recentList = document.getElementById('recentList');
    const totalCountEl = document.getElementById('totalCount');
    const activeCountEl = document.getElementById('activeCount');
    const resolvedCountEl = document.getElementById('resolvedCount');

    // Google/mock sign-in elements
    const googleSignBtn = document.getElementById('googleSignBtn');
    const googleModal = document.getElementById('googleModal');
    const googleCancel = document.getElementById('googleCancel');
    const googleConfirm = document.getElementById('googleConfirm');
    const mockName = document.getElementById('mockName');
    const mockEmail = document.getElementById('mockEmail');
    const logoutBtn = document.getElementById('logoutBtn');
    const userPreview = document.getElementById('userPreview');
    const avatar = document.getElementById('avatar');
    const userNameDisp = document.getElementById('userNameDisp');

    // Wire sign-in UI
    if (googleSignBtn) googleSignBtn.addEventListener('click', ()=> googleModal && googleModal.classList.remove('hidden'));
    if (googleCancel) googleCancel.addEventListener('click', ()=> googleModal && googleModal.classList.add('hidden'));
    if (googleConfirm) {
      googleConfirm.addEventListener('click', () => {
        const name = (mockName && mockName.value || '').trim();
        const email = (mockEmail && mockEmail.value || '').trim();
        if (!name || !email) { alert('Please enter name and email'); return; }
        setCurrentUser({ name, email });
        updateUserUI();
        googleModal.classList.add('hidden');
        if (mockName) mockName.value=''; if (mockEmail) mockEmail.value='';
      });
    }
    if (logoutBtn) logoutBtn.addEventListener('click', () => { clearCurrentUser(); updateUserUI(); });

    // Update user UI from storage
    function updateUserUI() {
      const u = getCurrentUser();
      if (!userPreview) return;
      if (u) {
        userPreview.classList.remove('hidden');
        if (googleSignBtn) googleSignBtn.classList.add('hidden');
        if (avatar) avatar.textContent = (u.name && u.name[0]) ? u.name[0].toUpperCase() : 'U';
        if (userNameDisp) userNameDisp.textContent = u.name;
      } else {
        userPreview.classList.add('hidden');
        if (googleSignBtn) googleSignBtn.classList.remove('hidden');
      }
    }
    updateUserUI();

    // Form submit -> preview
    if (itemForm) {
      itemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const r = collectForm();
        if (!r) { alert('Please fill all fields'); return; }
        if (previewContent) {
          previewContent.innerHTML = `
            <p><strong>Type:</strong> ${escapeHtml(r.type)}</p>
            <p><strong>Name:</strong> ${escapeHtml(r.name)}</p>
            <p><strong>Description:</strong> ${escapeHtml(r.description)}</p>
            <p><strong>Place:</strong> ${escapeHtml(r.place)}</p>
            <p><strong>Contact:</strong> ${escapeHtml(r.contact)}</p>
          `;
        }
        previewModal && previewModal.classList.remove('hidden');
      });
    }

    if (closePreview) closePreview.addEventListener('click', ()=> previewModal && previewModal.classList.add('hidden'));

    if (confirmSubmit) {
      confirmSubmit.addEventListener('click', () => {
        const r = collectForm();
        if (!r) { alert('Form incomplete'); return; }
        const user = getCurrentUser();
        if (user && user.email) r.ownerEmail = user.email;
        r.id = Date.now();
        r.date = new Date().toLocaleString();
        r.claimed = false;
        const arr = readReports();
        arr.unshift(r);
        writeReports(arr);
        // reset form
        if (itemForm) itemForm.reset();
        previewModal && previewModal.classList.add('hidden');
        renderRecent();
      });
    }

    function collectForm() {
      const type = (document.getElementById('type') && document.getElementById('type').value) || '';
      const name = (document.getElementById('name') && document.getElementById('name').value) || '';
      const description = (document.getElementById('description') && document.getElementById('description').value) || '';
      const place = (document.getElementById('place') && document.getElementById('place').value) || '';
      const contact = (document.getElementById('contact') && document.getElementById('contact').value) || '';
      if (!type || !name || !description || !place || !contact) return null;
      return { type, name, description, place, contact };
    }

    // Render recent list with claim button
    function renderRecent(filter = 'All', query = '') {
      const arr = readReports();
      let list = arr;
      if (filter && filter !== 'All') list = list.filter(x => x.type === filter);
      if (query) list = list.filter(x => (x.name||'').toLowerCase().includes(query) || (x.place||'').toLowerCase().includes(query));
      if (!recentList) return;
      recentList.innerHTML = '';
      list.forEach(r => {
        const card = document.createElement('div');
        card.className = 'item-card bg-white rounded-lg p-3 shadow';
        card.innerHTML = `
          <div class="flex justify-between items-start gap-3">
            <div>
              <p class="text-xs text-gray-400">${escapeHtml(r.date)}</p>
              <h4 class="font-semibold">${escapeHtml(r.type)}: ${escapeHtml(r.name)}</h4>
              <p class="text-sm text-gray-700">${escapeHtml(r.description)}</p>
              <p class="text-xs text-gray-500">📍 ${escapeHtml(r.place)}</p>
              <p class="text-xs text-gray-500">📞 ${escapeHtml(r.contact)}</p>
              ${r.ownerEmail ? `<p class="text-xs text-gray-500">Owner: ${escapeHtml(r.ownerEmail)}</p>` : ''}
            </div>
            <div class="flex flex-col items-end gap-2">
              <div class="text-sm ${r.claimed ? 'text-green-600' : 'text-yellow-600'}">${r.claimed ? 'Resolved' : 'Unclaimed'}</div>
              <div class="flex gap-2">
                <button class="btn-claim text-xs px-2 py-1 rounded" data-id="${r.id}" ${r.claimed ? 'disabled' : ''}>Claim</button>
              </div>
            </div>
          </div>
        `;
        recentList.appendChild(card);
      });

      // Attach claim handlers
      document.querySelectorAll('.btn-claim').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.getAttribute('data-id'));
          handleClaim(id);
        });
      });

      // update counters
      const total = readReports().length;
      const active = readReports().filter(x=>!x.claimed).length;
      const resolved = total - active;
      if (totalCountEl) totalCountEl.textContent = total;
      if (activeCountEl) activeCountEl.textContent = active;
      if (resolvedCountEl) resolvedCountEl.textContent = resolved;
    }

    // initial render and filter hooks
    renderRecent();
    // filter and search bindings if present
    const filterEl = document.getElementById('filter');
    const searchEl = document.getElementById('search');
    if (filterEl) filterEl.addEventListener('change', ()=> renderRecent(filterEl.value, searchEl ? searchEl.value.trim().toLowerCase() : ''));
    if (searchEl) searchEl.addEventListener('input', ()=> renderRecent(filterEl ? filterEl.value : 'All', searchEl.value.trim().toLowerCase()));

    // Claim logic: user must be signed-in (mock)
    function handleClaim(id) {
      const user = getCurrentUser();
      if (!user) {
        if (confirm('You must sign in to claim. Open sign-in modal?')) {
          googleModal && googleModal.classList.remove('hidden');
        }
        return;
      }
      // mark claimed and record claimedBy
      const arr = readReports().map(r => {
        if (r.id === id) {
          return { ...r, claimed: true, claimedBy: user.email, claimedAt: new Date().toLocaleString() };
        }
        return r;
      });
      writeReports(arr);
      renderRecent();
    }
  } // setupUserPage end

  /* ---------------------- ADMIN PAGE ---------------------- */
  function setupAdminPage() {
    // Prompt for credentials (simple demo)
    const username = prompt('Admin username:', '');
    const password = prompt('Admin password:', '');
    if (username !== ADMIN_USER || password !== ADMIN_PASS) {
      alert('Invalid admin credentials. Redirecting to homepage.');
      window.location.href = 'index.html';
      return;
    }

    // Elements
    const adminTable = document.getElementById('adminTable');
    const a_totalCount = document.getElementById('a_totalCount');
    const a_pendingCount = document.getElementById('a_pendingCount');
    const a_resolvedCount = document.getElementById('a_resolvedCount');
    const adminSearch = document.getElementById('adminSearch');
    const exportBtn = document.getElementById('exportBtn');

    // render
    renderAdmin();

    // search handler
    if (adminSearch) adminSearch.addEventListener('input', () => renderAdmin(adminSearch.value.trim().toLowerCase()));

    if (exportBtn) exportBtn.addEventListener('click', () => {
      const reports = readReports();
      exportCSV(reports);
    });

    function renderAdmin(query = '') {
      const reports = readReports();
      updateAdminCounts(reports);
      const filtered = query ? reports.filter(r =>
        (r.name||'').toLowerCase().includes(query) ||
        (r.description||'').toLowerCase().includes(query) ||
        (r.place||'').toLowerCase().includes(query)
      ) : reports;

      if (!adminTable) return;
      adminTable.innerHTML = '';
      if (filtered.length === 0) {
        adminTable.innerHTML = '<p class="text-gray-500">No reports found.</p>';
        return;
      }

      filtered.forEach(r => {
        const card = document.createElement('div');
        card.className = 'border p-3 rounded-lg flex justify-between items-start gap-3';
        card.innerHTML = `
          <div>
            <p class="text-xs text-gray-400">${escapeHtml(r.date)}</p>
            <h4 class="font-semibold">${escapeHtml(r.type)}: ${escapeHtml(r.name)}</h4>
            <p class="text-sm">${escapeHtml(r.description)}</p>
            <p class="text-xs text-gray-500">📍 ${escapeHtml(r.place)}</p>
            <p class="text-xs text-gray-500">📞 ${escapeHtml(r.contact)}</p>
            ${r.ownerEmail ? `<p class="text-xs text-gray-500">Owner: ${escapeHtml(r.ownerEmail)}</p>` : ''}
          </div>
          <div class="text-right flex flex-col gap-2">
            <div class="${r.claimed ? 'text-green-600' : 'text-yellow-600'}">${r.claimed ? 'Resolved' : 'Pending'}</div>
            <div class="flex gap-2">
              <button class="admin-verify btn-sm bg-blue-500 text-white px-2 py-1 rounded" data-id="${r.id}" ${r.claimed ? 'disabled' : ''}>Verify</button>
              <button class="admin-resolve btn-sm bg-green-500 text-white px-2 py-1 rounded" data-id="${r.id}">Resolve</button>
              <button class="admin-delete btn-sm bg-red-500 text-white px-2 py-1 rounded" data-id="${r.id}">Delete</button>
            </div>
          </div>
        `;
        adminTable.appendChild(card);
      });

      // Wire admin buttons
      adminTable.querySelectorAll('.admin-verify').forEach(b => b.addEventListener('click', ()=> {
        const id = Number(b.dataset.id);
        markClaimedAdmin(id);
      }));
      adminTable.querySelectorAll('.admin-resolve').forEach(b => b.addEventListener('click', ()=> {
        const id = Number(b.dataset.id);
        markResolvedAdmin(id);
      }));
      adminTable.querySelectorAll('.admin-delete').forEach(b => b.addEventListener('click', ()=> {
        const id = Number(b.dataset.id);
        deleteReportAdmin(id);
      }));
    } // renderAdmin

    function updateAdminCounts(reports) {
      if (!a_totalCount || !a_pendingCount || !a_resolvedCount) return;
      a_totalCount.textContent = reports.length;
      a_pendingCount.textContent = reports.filter(r=>!r.claimed).length;
      a_resolvedCount.textContent = reports.filter(r=>r.claimed).length;
    }

    // admin actions
    function markClaimedAdmin(id) {
      const reports = readReports().map(r => r.id === id ? {...r, claimed: true } : r);
      writeReports(reports);
      renderAdmin();
      // also update index view if open (user might have it open)
    }
    function markResolvedAdmin(id) {
      const reports = readReports().map(r => r.id === id ? {...r, claimed: true } : r);
      writeReports(reports);
      renderAdmin();
    }
    function deleteReportAdmin(id) {
      if (!confirm('Delete this report?')) return;
      const reports = readReports().filter(r => r.id !== id);
      writeReports(reports);
      renderAdmin();
    }
  } // setupAdminPage end

  /* ---------------------- CSV Export ---------------------- */
  function exportCSV(reports) {
    const headers = ['id','type','name','description','place','contact','date','claimed','ownerEmail'];
    const rows = reports.map(r => headers.map(h => `"${String(r[h]===undefined?'': (r[h]===true?'Yes': r[h])).replace(/"/g,'""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reports_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------------------- Utilities ---------------------- */
  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/[&<>"'`]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;","`":"&#96;" }[c]));
  }

})();
