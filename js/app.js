/**
 * js/app.js – Application Entry Point & Render Engine
 * Wires all modules. Exposes window.App (all onclick= handlers).
 * Nothing imports app.js – this is the dependency leaf.
 *
 * v3.1 Booking.com upgrades:
 *   - toggleShortlist, downloadBookingSlip, setRating added to App namespace
 *   - loading state cleared after data loads (skeleton → real cards)
 */
'use strict';

import { state, setState, registerRenderer } from './state.js';
import { loadData }   from './storage.js';
import { auditLog, sanitize, touchSession, isAuthenticated } from './security.js';
import { ALLOWED_VIEWS } from './data.js';
import { renderNav }  from './components/nav.js';
import { renderToast, showToast } from './components/toast.js';
import { renderHome } from './views/home.js';
import { renderHostels, renderHostelDetail, renderMyBookings, renderAdmin, renderSecurity } from './views/pages.js';
import { renderModal } from './modals/index.js';
import {
  doLogin, doLogout,
  doAddHostel, doEditHostel, doDelHostel,
  doAddRoom, doEditRoom, doDelRoom, releaseRoom, confirmRoomPayment,
  openBooking, bStep1, bStep2, confirmBooking, lookupBooking,
  handleImgUpload, handleDrop, clearImg, previewMap, liveVal,
  toggleShortlist, downloadBookingSlip, setRating,
} from './handlers/index.js';

/* Render engine */
function render() {
  const root = document.getElementById('root');
  if (!root) return;
  const views = {
    home: renderHome, hostels: renderHostels, hostelDetail: renderHostelDetail,
    admin: renderAdmin, myBookings: renderMyBookings, security: renderSecurity,
  };
  const viewFn = views[state.view] || renderHome;
  root.innerHTML = renderNav() +
    `<main class="max-w-6xl mx-auto px-4 py-6 fade">${viewFn()}</main>` +
    renderModal() + renderToast();
}

/* Session expiry via CustomEvent (avoids circular import) */
window.addEventListener('mmu:sessionExpired', () => {
  auditLog('SESSION_EXPIRED', 'Admin session expired – idle timeout');
  state.adminMode = false;
  setState({ view: 'home', modal: null });
  showToast('Admin session expired. Please log in again.', 'warn');
});

/* Single global App namespace */
window.App = Object.freeze({
  go(view, patch = {}) {
    if (!ALLOWED_VIEWS.includes(view)) { console.warn('[Security] Blocked nav:', view); return; }
    setState({ view, modal: null, ...patch });
  },
  setState(patch) { setState(patch); },
  openModal(name, data = {}) { setState({ modal: name, modalData: data }); },
  closeModal() { setState({ modal: null, pendingImg: null }); },
  handleOverlayClick(ev) {
    if (ev.target?.id === 'modal-overlay' && state.modal !== 'success')
      setState({ modal: null, pendingImg: null });
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

  /* ── Hostel CRUD ─────────────────────────────────────────────────────── */
  doAddHostel, doEditHostel, doDelHostel,

  /* ── Room CRUD ───────────────────────────────────────────────────────── */
  doAddRoom, doEditRoom, doDelRoom, releaseRoom, confirmRoomPayment,

  /* ── Booking flow ────────────────────────────────────────────────────── */
  openBooking, bStep1, bStep2, confirmBooking, lookupBooking,

  /* ── Image upload ────────────────────────────────────────────────────── */
  handleImgUpload, handleDrop, clearImg, previewMap, liveVal,

  /* ── Booking.com features ────────────────────────────────────────────── */
  toggleShortlist,       // ❤️ Wishlist / shortlist toggle
  downloadBookingSlip,   // 📄 Print booking receipt
  setRating,             // ⭐ Admin sets hostel star rating
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
