/**
 * js/app.js – Application Entry Point & Render Engine
 * Wires all modules. Exposes window.App (all onclick= handlers).
 * Nothing imports app.js – this is the dependency leaf.
 * ═══════════════════════════════════════════════════════════════════════════
 */
'use strict';

import { state, setState, registerRenderer } from './state.js';
import { loadData }   from './storage.js';
import { auditLog, sanitize, touchSession, isAuthenticated } from './security.js';
import { ALLOWED_VIEWS } from './data.js';
import { renderNav }  from './components/nav.js';
import { renderToast, showToast } from './components/toast.js';
import { renderHome } from './views/home.js';
import { renderHostels, renderHostelDetail, renderMyBookings, renderStudentDashboard, renderAdmin, renderSecurity, renderProfile, renderHelp } from './views/pages.js';
import { renderModal } from './modals/index.js';
import {
  doLogin, doLogout,
  doAddManager, doUpdateUserStatus, doDeleteManager, doEditManager,


  ensureManagersLoaded, ensureRolesLoaded, ensurePermissionsLoaded, ensureUsersLoaded,
  doAddRole, doAddPermission, doSeedPermissions, doAssignUserAccess, doAssignHostelManager,
  doAddHostel, doEditHostel, doDelHostel,
  doAddRoom, doEditRoom, doDelRoom, releaseRoom, confirmRoomPayment, resendStudentCredentials,
  onRoomImagePick, clearRoomImagePick,
  openBooking, bStep1, bStep2, confirmBooking, lookupBooking,
  saveProfile,
  handleImgUpload, handleDrop, clearImg, previewMap, liveVal,
  toggleShortlist, downloadBookingSlip, setRating,
  openCamera, capturePhoto, doApplyCapture, stopCamera,
  toggleHostelExpand, doSearchHostels,
  doUpdateDeveloperContact,
  doSendSupportTicketImpl,
} from './handlers/index.js';

/* Render engine */
function render() {
  const root = document.getElementById('root');
  if (!root) return;
  const views = {
    home: renderHome, hostels: renderHostels, hostelDetail: renderHostelDetail,
    admin: renderAdmin, myBookings: renderMyBookings, studentDashboard: renderStudentDashboard, security: renderSecurity, profile: renderProfile,
    help: renderHelp,
  };
  const viewFn = views[state.view] || renderHome;
  root.innerHTML = renderNav() +
    `<main class="w-full px-4 md:px-8 py-6 fade">${viewFn()}</main>` +
    renderModal() + renderToast();
}

/* Session expiry via CustomEvent (avoids circular import) */
window.addEventListener('mmu:sessionExpired', () => {
  auditLog('SESSION_EXPIRED', 'Admin session expired – idle timeout');
  state.adminMode = false;
  setState({ view: 'home', modal: null, adminUser: '', userId: null, userEmail: '', userRole: '', userPermissions: {}, assignedHostelIds: [] });
  showToast('Admin session expired. Please log in again.', 'warn');
});

/* Single global App namespace */
window.App = Object.freeze({
  go(view, patch = {}) {
    if (!ALLOWED_VIEWS.includes(view)) { console.warn('[Security] Blocked nav:', view); return; }
    if (view === 'security' && state.userRole !== 'admin') {
      showToast('Only admin can access Security.', 'error');
      setState({ view: 'admin', modal: null });
      return;
    }
    setState({ view, modal: null, ...patch });
  },
  setState(patch) { setState(patch); },
  openModal(name, data = {}) {
    const patch = { modal: name, modalData: data, isImageRemoved: false };
    if (name === 'addRoom' || name === 'editRoom') patch.pendingRoomImage = null;
    setState(patch);
  },
  closeModal() { setState({ modal: null, pendingImg: null, pendingRoomImage: null, isImageRemoved: false, camReturnModal: null, camReturnData: {} }); },
  handleOverlayClick(ev) {
    if (ev.target?.id === 'modal-overlay' && state.modal !== 'success')
      setState({ modal: null, pendingImg: null, pendingRoomImage: null, isImageRemoved: false, camReturnModal: null, camReturnData: {} });
  },
  requireAdmin() {
    if (!state.adminMode || !isAuthenticated()) {
      state.adminMode = false;
      setState({ modal: 'adminLogin' });
      auditLog('AUTH_REJECT', 'Unauthorized admin action');
      return false;
    }
    touchSession(); return true;
  },

  /* ── Auth ────────────────────────────────────────────────────────────── */
  doLogin, logout: doLogout,
  doAddManager, doUpdateUserStatus, doDeleteManager, doEditManager, saveProfile,


  ensureManagersLoaded, ensureRolesLoaded, ensurePermissionsLoaded, ensureUsersLoaded,
  doAddRole, doAddPermission, doSeedPermissions, doAssignUserAccess, doAssignHostelManager,

  /* ── Hostel CRUD ─────────────────────────────────────────────────────── */
  doAddHostel, doEditHostel, doDelHostel,

  /* ── Room CRUD ───────────────────────────────────────────────────────── */
  doAddRoom, doEditRoom, doDelRoom, releaseRoom, confirmRoomPayment, resendStudentCredentials,
  onRoomImagePick, clearRoomImagePick,

  /* ── Booking flow ────────────────────────────────────────────────────── */
  openBooking, bStep1, bStep2, confirmBooking, lookupBooking,

  /* ── Image upload ────────────────────────────────────────────────────── */
  handleImgUpload, handleDrop, clearImg, previewMap, liveVal,

  /* ── Core Features ─────────────────────────────────────────────────── */
  toggleShortlist,       // ❤️ Wishlist / shortlist toggle
  downloadBookingSlip,   // 📄 Print booking receipt
  setRating,             // ⭐ Admin sets hostel star rating
  openCamera,            // 📸 Open camera modal
  capturePhoto,          // 🖼 Snap photo
  doApplyCapture,        // ✅ Confirm captured photo
  stopCamera,            // ✕ Stop camera & close
  toggleHostelExpand,    // ↕ Expand/collapse hostel card
  searchHostels: doSearchHostels, // 🔍 Hostel search
  doUpdateDeveloperContact,
  doSendSupportTicket: (ev) => { if(ev) ev.preventDefault(); doSendSupportTicketImpl(ev); },
});

window.Sec = Object.freeze({ sanitize });

/* Init */
(async function () {
  registerRenderer(render);

  // Show skeleton loader immediately
  setState({ loading: true });

  await loadData();
  await auditLog('APP_START', 'MMU Hostel Booking System v3.1 started');

  document.addEventListener('click',    () => touchSession(), { passive: true });
  document.addEventListener('keypress', () => touchSession(), { passive: true });

  // Mark loading complete — skeleton cards replaced by real hostel cards
  setState({ loading: false });
})();
