/**
 * js/handlers/index.js  –  ALL Business Logic & Action Handlers
 * ═══════════════════════════════════════════════════════════════════════════
 * Booking.com upgrades added:
 *   • toggleShortlist(hostelId)  — save/remove from wishlist
 *   • downloadBookingSlip(id)    — open printable booking receipt
 *   • setRating(hostelId, rating) — admin sets star rating
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { state, setState, hostels, bookings, setBookings } from '../state.js';
import { saveData }  from '../storage.js';
import { showToast } from '../components/toast.js';
import {
  sanitize, validate, hashPassword,
  verifyCsrfToken,
  createSession, destroySession,
  recordFailedLogin, resetBruteForce, isLoginLocked, loginDelay, getBruteForceState,
  auditLog, canBook, countBooking,
  validateImageFile, safeImgSrc,
} from '../security.js';
import { ADMIN_PASS_HASH } from '../data.js';
import { getHostel, makeId, today, escapeHtml, bookingCardHtml, formatPrice } from '../utils.js';
import { GENDER_OPTIONS, ROOM_TYPES, FLOOR_OPTIONS } from '../data.js';

/* ── Private helper: show a field-level error ─────────────────────────── */
function _fieldErr(elId, msg) {
  const el = typeof elId === 'string' ? document.getElementById(elId) : elId;
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* ════════════════════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════════════════════ */
export async function doLogin() {
  const lk = isLoginLocked();
  if (lk.locked) { showToast('Account locked. Try again later.', 'error'); return; }

  const csrf = document.getElementById('lcsrf')?.value ?? '';
  if (!verifyCsrfToken(csrf)) { showToast('Invalid security token — please refresh.', 'error'); return; }

  const username = sanitize(document.getElementById('aU')?.value ?? '', 30);
  const password = document.getElementById('aP')?.value ?? '';

  if (!username || !password) { _fieldErr('lErr', 'Please enter username and password.'); return; }

  const bfSt = getBruteForceState();
  await new Promise(r => setTimeout(r, loginDelay(bfSt.n ?? 0)));

  const btn = document.getElementById('lBtn');
  if (btn) btn.disabled = true;

  const inputHash  = await hashPassword(password);
  const storedHash = await ADMIN_PASS_HASH;

  if (username === 'admin' && inputHash === storedHash) {
    resetBruteForce();
    createSession();
    await auditLog('ADMIN_LOGIN', 'Admin authenticated successfully');
    setState({ adminMode: true, modal: null, view: 'admin' });
    showToast('Welcome, Admin!');
  } else {
    const s    = recordFailedLogin();
    await auditLog('LOGIN_FAIL', `Failed login attempt for: ${username}`);
    const left = Math.max(0, 5 - (s.n ?? 0));
    const msg  = s.until
      ? '🔒 Too many failed attempts. Locked for 15 minutes.'
      : `Invalid credentials. ${left} attempt(s) remaining.`;
    _fieldErr('lErr', msg);
    if (btn) btn.disabled = false;
    setState({}); // re-render so attempt counter updates
  }
}

export async function doLogout() {
  destroySession();
  await auditLog('ADMIN_LOGOUT', 'Admin logged out');
  setState({ adminMode: false, view: 'home' });
  showToast('Logged out successfully.');
}

/* ════════════════════════════════════════════════════════════════════════════
   HOSTEL CRUD
════════════════════════════════════════════════════════════════════════════ */
function _readHostelForm() {
  return {
    csrf:   document.getElementById('hcsrf')?.value  ?? '',
    editId: document.getElementById('hEditId')?.value ?? '',
    name:   sanitize(document.getElementById('hN')?.value    ?? ''),
    gender: document.getElementById('hG')?.value    ?? '',
    dist:   sanitize(document.getElementById('hD')?.value    ?? ''),
    desc:   sanitize(document.getElementById('hDesc')?.value ?? '', 250),
    amen:   sanitize(document.getElementById('hAm')?.value   ?? '', 200),
    addr:   sanitize(document.getElementById('hAddr')?.value ?? '', 120),
    lat:    (document.getElementById('hLat')?.value ?? '').trim(),
    lng:    (document.getElementById('hLng')?.value ?? '').trim(),
    rating: parseFloat(document.getElementById('hRating')?.value ?? '0') || 0,
  };
}

function _validateHostelForm(f) {
  if (!verifyCsrfToken(f.csrf))            { _fieldErr('hErr','Invalid security token.'); return false; }
  if (!f.name || f.name.length < 2)        { _fieldErr('hErr','Hostel name is required (min 2 chars).'); return false; }
  if (!GENDER_OPTIONS.includes(f.gender))  { _fieldErr('hErr','Please select a valid gender.'); return false; }
  if (!f.dist)                             { _fieldErr('hErr','Distance from campus is required.'); return false; }
  if (!f.addr)                             { _fieldErr('hErr','Full address is required.'); return false; }
  if (!f.lat || !validate('lat', f.lat))   { _fieldErr('hErr','Valid latitude required (e.g. 0.6591).'); return false; }
  if (!f.lng || !validate('lng', f.lng))   { _fieldErr('hErr','Valid longitude required (e.g. 30.2752).'); return false; }
  if (f.rating < 0 || f.rating > 5)       { _fieldErr('hErr','Rating must be between 0 and 5.'); return false; }
  return true;
}

export async function doAddHostel() {
  const f = _readHostelForm();
  if (!_validateHostelForm(f)) return;

  const amenities = f.amen
    ? f.amen.split(',').map(a => sanitize(a.trim(), 30)).filter(Boolean)
    : ['Security', 'Water'];

  hostels.push({
    id: makeId(), name: f.name, gender: f.gender,
    distance: f.dist, description: f.desc || 'No description provided.',
    image: state.pendingImg ?? null, emoji: '🏠', color: '#1a5c38',
    rating: f.rating || null,
    location: { address: f.addr, lat: f.lat, lng: f.lng },
    amenities, rooms: [],
  });

  await saveData();
  await auditLog('HOSTEL_CREATED', `Admin added hostel: ${f.name}`);
  setState({ modal: null, pendingImg: null });
  showToast(`"${f.name}" added successfully!`);
}

export async function doEditHostel() {
  const f = _readHostelForm();
  if (!_validateHostelForm(f)) return;

  const h = getHostel(parseInt(f.editId, 10));
  if (!h) { showToast('Hostel not found.', 'error'); return; }

  Object.assign(h, {
    name: f.name, gender: f.gender, distance: f.dist,
    description: f.desc || h.description,
    image: state.pendingImg !== null ? state.pendingImg : h.image,
    rating: f.rating || h.rating,
    location: { address: f.addr, lat: f.lat, lng: f.lng },
    amenities: f.amen
      ? f.amen.split(',').map(a => sanitize(a.trim(), 30)).filter(Boolean)
      : h.amenities,
  });

  await saveData();
  await auditLog('HOSTEL_UPDATED', `Admin updated hostel: ${f.name}`);
  setState({ modal: null, pendingImg: null });
  showToast(`"${f.name}" updated!`);
}

export async function doDelHostel() {
  const id = state.modalData.hostelId;
  const h  = getHostel(id);
  if (!h) return;
  const idx = hostels.indexOf(h);
  if (idx !== -1) hostels.splice(idx, 1);
  setBookings(bookings.filter(b => b.hostelId !== id));
  await saveData();
  await auditLog('HOSTEL_DELETED', `Admin deleted hostel: ${h.name}`);
  setState({ modal: null });
  showToast(`"${h.name}" deleted.`, 'warn');
}

/* ════════════════════════════════════════════════════════════════════════════
   ROOM CRUD
════════════════════════════════════════════════════════════════════════════ */
function _readRoomForm() {
  return {
    csrf:   document.getElementById('rcsrf')?.value ?? '',
    num:    sanitize((document.getElementById('rN')?.value ?? '').toUpperCase()),
    type:   document.getElementById('rT')?.value  ?? '',
    floor:  document.getElementById('rF')?.value  ?? '',
    price:  parseInt(document.getElementById('rP')?.value ?? '0', 10),
    fee:    parseInt(document.getElementById('rCF')?.value ?? '0', 10),
    status: document.getElementById('rS')?.value  ?? 'available',
  };
}

function _validateRoomForm(f) {
  if (!verifyCsrfToken(f.csrf))            { _fieldErr('rErr','Invalid security token.'); return false; }
  if (!validate('rnum', f.num))            { _fieldErr('rErr','Invalid room number — alphanumeric only, max 10 chars.'); return false; }
  if (!ROOM_TYPES.includes(f.type))        { _fieldErr('rErr','Invalid room type.'); return false; }
  if (!FLOOR_OPTIONS.includes(f.floor))    { _fieldErr('rErr','Invalid floor.'); return false; }
  if (!f.price||f.price<50000||f.price>2000000) { _fieldErr('rErr','Price must be UGX 50,000 – 2,000,000.'); return false; }
  if (f.fee < 0 || f.fee > f.price) { _fieldErr('rErr','Confirmation fee must be between 0 and the room price.'); return false; }
  if (!['available','pending','booked'].includes(f.status)) { _fieldErr('rErr','Invalid status.'); return false; }
  return true;
}

export async function doAddRoom() {
  const f = _readRoomForm();
  if (!_validateRoomForm(f)) return;
  const h = getHostel(state.modalData.hostelId);
  if (!h) { showToast('Hostel not found.', 'error'); return; }
  if (h.rooms.some(r => r.number === f.num)) { _fieldErr('rErr', `Room ${f.num} already exists in this hostel.`); return; }
  h.rooms.push({ id: makeId(), number: f.num, type: f.type, floor: f.floor, price: f.price, confirmationFee: f.fee, status: 'available' });
  await saveData();
  await auditLog('ROOM_CREATED', `Admin added room ${f.num} to ${h.name}`);
  setState({ modal: null });
  showToast(`Room ${f.num} added to ${h.name}!`);
}

export async function doEditRoom() {
  const f    = _readRoomForm();
  if (!_validateRoomForm(f)) return;
  const h    = getHostel(state.modalData.hostelId);
  const rIdx = h?.rooms.findIndex(x => x.id === state.modalData.roomId) ?? -1;
  if (!h || rIdx === -1) { showToast('Room not found.', 'error'); return; }
  if (h.rooms.some((r, i) => r.number === f.num && i !== rIdx)) { _fieldErr('rErr', `Room ${f.num} already exists.`); return; }
  Object.assign(h.rooms[rIdx], { number: f.num, type: f.type, floor: f.floor, price: f.price, confirmationFee: f.fee, status: f.status });
  if (f.status === 'available') { delete h.rooms[rIdx].bookedBy; delete h.rooms[rIdx].regNo; }
  await saveData();
  await auditLog('ROOM_UPDATED', `Admin updated room ${f.num} in ${h.name}`);
  setState({ modal: null });
  showToast(`Room ${f.num} updated!`);
}

export async function doDelRoom() {
  const h = getHostel(state.modalData.hostelId);
  const r = h?.rooms.find(x => x.id === state.modalData.roomId);
  if (!h || !r) return;
  h.rooms = h.rooms.filter(x => x.id !== r.id);
  setBookings(bookings.filter(b => !(b.hostelId === h.id && b.roomId === r.id)));
  await saveData();
  await auditLog('ROOM_DELETED', `Admin removed room ${r.number} from ${h.name}`);
  setState({ modal: null });
  showToast(`Room ${r.number} removed.`, 'warn');
}

export async function releaseRoom(hostelId, roomId) {
  const h = getHostel(hostelId);
  const r = h?.rooms.find(x => x.id === roomId);
  if (!h || !r) return;
  const prev = r.bookedBy;
  r.status = 'available';
  delete r.bookedBy;
  delete r.regNo;
  setBookings(bookings.filter(b => !(b.hostelId === hostelId && b.roomId === roomId)));
  await saveData();
  await auditLog('BOOKING_RELEASED', `Room ${r.number} in ${h.name} released (was: ${prev})`);
  setState({});
  showToast(`Room ${r.number} is now available.`);
}

/* ════════════════════════════════════════════════════════════════════════════
   BOOKING FLOW
════════════════════════════════════════════════════════════════════════════ */
export function openBooking(hostelId, roomId) {
  const h = getHostel(hostelId);
  const r = h?.rooms.find(x => x.id === roomId);
  if (!r || r.status !== 'available') { showToast('This room is no longer available.', 'warn'); setState({}); return; }
  if (!canBook()) { showToast('Booking limit reached for this session.', 'error'); return; }
  setState({ modal: 'booking', selH: hostelId, selR: roomId, bStep: 1, bData: {} });
}

export function bStep1() {
  const name  = sanitize(document.getElementById('fN')?.value ?? '');
  const reg   = sanitize((document.getElementById('fR')?.value ?? '').toUpperCase());
  const year  = document.getElementById('fY')?.value ?? '';

  if (!name)                      { _fieldErr('s1e', 'Full name is required.'); return; }
  if (!validate('name', name))    { _fieldErr('s1e', 'Name: letters and spaces only (2–80 chars).'); return; }
  if (!reg)                       { _fieldErr('s1e', 'Registration number is required.'); return; }
  if (!validate('regNo', reg))    { _fieldErr('s1e', 'Invalid format. Use: YYYY/U/MMU/COURSE/NNNNNNN'); return; }
  if (!year)                      { _fieldErr('s1e', 'Please select your year of study.'); return; }

  const dup = bookings.find(b => b.regNo.toUpperCase() === reg && b.hostelId === state.selH);
  if (dup) { _fieldErr('s1e', `Reg ${reg} already has a booking here (Ref #${dup.id}).`); return; }

  document.getElementById('s1e')?.classList.add('hidden');
  Object.assign(state.bData, { studentName: name, regNo: reg, year });
  setState({ bStep: 2 });
}

export function bStep2() {
  const phone  = sanitize(document.getElementById('fPh')?.value ?? '');
  const email  = sanitize(document.getElementById('fE')?.value  ?? '');
  const course = sanitize(document.getElementById('fC')?.value  ?? '');
  const sem    = document.getElementById('fSm')?.value ?? '';

  if (!phone)                             { _fieldErr('s2e','Phone number is required.'); return; }
  if (!validate('phone', phone))          { _fieldErr('s2e','Invalid phone. Use +256XXXXXXXXX or 07XXXXXXXX.'); return; }
  if (email && !validate('email', email)) { _fieldErr('s2e','Invalid email format.'); return; }
  if (!course)                            { _fieldErr('s2e','Programme / course is required.'); return; }
  if (!validate('course', course))        { _fieldErr('s2e','Course contains invalid characters.'); return; }
  if (!sem)                               { _fieldErr('s2e','Please select your semester.'); return; }

  document.getElementById('s2e')?.classList.add('hidden');
  Object.assign(state.bData, { phone, email, course, semester: sem });
  setState({ bStep: 3 });
}

export async function confirmBooking() {
  const csrf = document.getElementById('bcsrf')?.value ?? '';
  if (!verifyCsrfToken(csrf)) {
    showToast('Security token invalid — refresh the page.', 'error');
    await auditLog('CSRF_REJECT', 'Booking rejected: invalid CSRF token');
    return;
  }
  if (!canBook()) { showToast('Booking rate limit reached.', 'error'); return; }

  const h    = getHostel(state.selH);
  const rIdx = h?.rooms.findIndex(r => r.id === state.selR) ?? -1;
  if (!h || rIdx === -1) { showToast('Room not found.', 'error'); return; }

  // Atomic double-booking check
  if (h.rooms[rIdx].status !== 'available') {
    showToast('Room just booked by someone else. Please choose another.', 'warn');
    setState({ modal: null });
    return;
  }

  const btn = document.getElementById('cbtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }

  // Temporarily mark as pending to prevent double-booking while paying
  h.rooms[rIdx].status   = 'pending';
  h.rooms[rIdx].bookedBy = state.bData.studentName;
  h.rooms[rIdx].regNo    = state.bData.regNo;

  const room = h.rooms[rIdx];
  const randArr = new Uint32Array(1);
  crypto.getRandomValues(randArr);
  const bookingId = 'B' + randArr[0].toString(36).toUpperCase();

  const booking = {
    id:       bookingId,
    hostelId: h.id,
    roomId:   room.id,
    ...state.bData,
    date:     today(),
    status:   'pending',
  };
  bookings.push(booking);

  // Expose bookings globally so slip modal can access them
  window.__mmuBookings__ = bookings;

  // Persist the lock
  await saveData();

  const amountToCharge = room.confirmationFee || room.price;

  // Initialize live Flutterwave checkout
  window.FlutterwaveCheckout({
    public_key: 'FLWPUBK_TEST-SANDBOXDEMOKEY-X', // Swap with real key
    tx_ref: bookingId,
    amount: amountToCharge,
    currency: 'UGX',
    payment_options: 'mobilemoneyuganda, card',
    customer: {
      email: state.bData.email || 'student@mmu.ac.ug',
      phone_number: state.bData.phone,
      name: state.bData.studentName,
    },
    customizations: {
      title: 'MMU Hostel Booking',
      description: `Confirmation fee for Room ${room.number} — ${h.name}`,
      logo: 'https://mmu.ac.ug/wp-content/uploads/2021/04/mmu-logo.png',
    },
    callback: async function(paymentData) {
      if (paymentData.status === 'successful') {
        countBooking();
        h.rooms[rIdx].status = 'booked';
        const b = bookings.find(x => x.id === bookingId);
        if (b) b.status = 'confirmed';

        window.__mmuBookings__ = bookings;
        await saveData();
        await auditLog('BOOKING_CREATED',
          `Room ${room.number} in ${h.name} booked by ${booking.studentName} (${booking.regNo}) via Flutterwave`,
          { ref: bookingId, txRef: paymentData.transaction_id }
        );

        setState({
          modal:      'success',
          successMsg: `Payment successful! Room ${room.number} in ${h.name} is confirmed for ${state.bData.studentName}. Ref: #${bookingId}`,
          bStep:      1,
          bData:      {},
        });
      }
    },
    onclose: async function(incomplete) {
      // If modal is closed without success, release the pending lock
      if (h.rooms[rIdx].status === 'pending') {
        h.rooms[rIdx].status = 'available';
        delete h.rooms[rIdx].bookedBy;
        delete h.rooms[rIdx].regNo;
        const bIdx = bookings.findIndex(x => x.id === bookingId);
        if (bIdx !== -1) bookings.splice(bIdx, 1);
        window.__mmuBookings__ = bookings;
        await saveData();
      }
      const reBtn = document.getElementById('cbtn');
      if (reBtn) { reBtn.disabled = false; reBtn.textContent = `💳 Pay ${formatPrice(amountToCharge)} Now`; }
      if (incomplete) showToast('Payment window closed. Room reservation cancelled.', 'warn');
    },
  });
}

export async function confirmRoomPayment(hostelId, roomId) {
  const h = getHostel(hostelId);
  const r = h?.rooms.find(x => x.id === roomId);
  if (!h || !r) return;

  r.status = 'booked';

  // Find associated pending booking
  const b = bookings.find(x => x.hostelId === hostelId && x.roomId === roomId && x.status === 'pending');
  if (b) b.status = 'confirmed';

  window.__mmuBookings__ = bookings;
  await saveData();
  await auditLog('PAYMENT_CONFIRMED', `Admin confirmed payment for room ${r.number} in ${h.name}`);
  setState({});
  showToast(`Payment confirmed for Room ${r.number}.`);
}

/* Student booking lookup */
export function lookupBooking() {
  const raw   = document.getElementById('regIn')?.value?.trim() ?? '';
  const resEl = document.getElementById('bkResult');
  if (!resEl) return;

  if (!raw) {
    resEl.innerHTML = '<p class="text-red-500 text-sm">Please enter your registration number.</p>';
    return;
  }
  if (!validate('regNo', raw)) {
    resEl.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">⚠️ Invalid format. Use: YYYY/U/MMU/COURSE/NNNNNNN</div>`;
    return;
  }

  const found = bookings.filter(b => b.regNo.toLowerCase() === raw.toLowerCase());
  if (found.length) {
    resEl.innerHTML = `<div class="space-y-3">${found.map(bookingCardHtml).join('')}</div>`;
  } else {
    resEl.innerHTML = `<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-700 text-sm">No booking found for <b>${escapeHtml(raw)}</b>.</div>`;
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   SHORTLIST / WISHLIST (Booking.com heart button)
════════════════════════════════════════════════════════════════════════════ */
export function toggleShortlist(hostelId) {
  const current = state.shortlist ?? [];
  const idx     = current.indexOf(hostelId);
  let next;
  if (idx === -1) {
    next = [...current, hostelId];
    showToast('Added to your shortlist! ❤️');
  } else {
    next = current.filter(id => id !== hostelId);
    showToast('Removed from shortlist.', 'warn');
  }
  setState({ shortlist: next });
}

/* ════════════════════════════════════════════════════════════════════════════
   DOWNLOAD BOOKING SLIP
════════════════════════════════════════════════════════════════════════════ */
export function downloadBookingSlip(bookingId) {
  // Open slip in a print-ready window
  const booking = (window.__mmuBookings__ ?? bookings).find(b => b.id === bookingId);
  if (!booking) { showToast('Booking not found.', 'error'); return; }

  const h    = getHostel(booking.hostelId);
  const room = h?.rooms.find(r => r.id === booking.roomId);

  const formatP = n => 'UGX ' + Number(n).toLocaleString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Booking Slip – #${booking.id}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #fff; margin: 0; padding: 2rem; color: #1f2937; }
    .slip { max-width: 480px; margin: 0 auto; border: 2px solid #1a5c38; border-radius: 12px; overflow: hidden; }
    .slip-header { background: linear-gradient(135deg, #0f3520, #1a5c38); color: #fff; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem; }
    .slip-body { padding: 1.25rem 1.5rem; }
    .row { display: flex; justify-content: space-between; padding: .4rem 0; border-bottom: 1px solid #f3f4f6; font-size: .875rem; }
    .row:last-child { border-bottom: none; }
    .key { color: #6b7280; }
    .val { font-weight: 700; text-align: right; }
    .divider { border-top: 2px dashed #d1d5db; margin: .75rem 0; }
    .ref { background: #f0fdf4; border-radius: .5rem; padding: .75rem; text-align: center; margin-top: 1rem; }
    .ref-num { font-size: 1.5rem; font-weight: 800; color: #1a5c38; font-family: monospace; letter-spacing: .1em; }
    .confirmed { color: #16a34a; font-size: .75rem; margin-top: .25rem; }
    @media print { body { padding: 0; } button { display: none; } }
  </style>
</head>
<body>
  <div class="slip">
    <div class="slip-header">
      <div style="font-size:2rem">🏠</div>
      <div>
        <div style="font-size:1.1rem;font-weight:800">MMU Hostel Booking</div>
        <div style="font-size:.7rem;opacity:.75">Mountains of the Moon University · Fort Portal</div>
      </div>
    </div>
    <div class="slip-body">
      <div class="row"><span class="key">Student Name</span><span class="val">${escapeHtml(booking.studentName)}</span></div>
      <div class="row"><span class="key">Reg Number</span><span class="val">${escapeHtml(booking.regNo)}</span></div>
      <div class="row"><span class="key">Course</span><span class="val">${escapeHtml(booking.course)}</span></div>
      <div class="row"><span class="key">Academic Year</span><span class="val">${escapeHtml(booking.year ?? '—')}</span></div>
      <div class="row"><span class="key">Semester</span><span class="val">${escapeHtml(booking.semester ?? '—')}</span></div>
      <div class="row"><span class="key">Phone</span><span class="val">${escapeHtml(booking.phone ?? '—')}</span></div>
      <div class="divider"></div>
      <div class="row"><span class="key">Hostel</span><span class="val">${escapeHtml(h?.name ?? '—')}</span></div>
      <div class="row"><span class="key">Room</span><span class="val">${escapeHtml(room?.number ?? '—')} (${escapeHtml(room?.type ?? '—')})</span></div>
      <div class="row"><span class="key">Floor</span><span class="val">${escapeHtml(room?.floor ?? '—')}</span></div>
      <div class="row"><span class="key">Semester Fee</span><span class="val">${formatP(room?.price ?? 0)}</span></div>
      <div class="row"><span class="key">Confirmation Paid</span><span class="val" style="color:#1a5c38">${formatP(room?.confirmationFee ?? 0)}</span></div>
      <div class="row"><span class="key">Balance on Arrival</span><span class="val" style="color:#c9961a">${formatP((room?.price ?? 0) - (room?.confirmationFee ?? 0))}</span></div>
      <div class="row"><span class="key">Booking Date</span><span class="val">${escapeHtml(booking.date ?? '—')}</span></div>
      <div class="ref">
        <div style="font-size:.65rem;color:#6b7280;margin-bottom:.25rem">BOOKING REFERENCE</div>
        <div class="ref-num">#${escapeHtml(booking.id)}</div>
        <div class="confirmed">✅ CONFIRMED · Paid via Flutterwave</div>
      </div>
    </div>
  </div>
  <p style="text-align:center;margin-top:1.5rem;font-size:.8rem;color:#6b7280">
    Present this slip and your student ID on arrival to collect your room key.
  </p>
  <script>window.print();<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=600,height=750');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    showToast('Please allow popups to download your booking slip.', 'warn');
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   ADMIN: SET HOSTEL STAR RATING
════════════════════════════════════════════════════════════════════════════ */
export async function setRating(hostelId, rating) {
  const h = getHostel(hostelId);
  if (!h) { showToast('Hostel not found.', 'error'); return; }
  if (rating < 0 || rating > 5) { showToast('Rating must be between 0 and 5.', 'error'); return; }
  h.rating = Math.round(rating * 10) / 10; // round to 1 decimal
  await saveData();
  await auditLog('RATING_SET', `Admin set rating ${h.rating} for ${h.name}`);
  setState({});
  showToast(`Rating updated to ${h.rating} ⭐ for ${h.name}.`);
}

/* ════════════════════════════════════════════════════════════════════════════
   IMAGE HANDLERS
════════════════════════════════════════════════════════════════════════════ */
export function handleImgUpload(input) {
  const file   = input?.files?.[0];
  const errEl  = document.getElementById('imgErr');
  const err    = validateImageFile(file);
  if (err) { if (errEl) { errEl.textContent = err; errEl.classList.remove('hidden'); } return; }
  if (errEl) errEl.classList.add('hidden');

  const reader = new FileReader();
  reader.onload = ev => {
    const b64 = ev.target.result;
    if (!safeImgSrc(b64)) {
      if (errEl) { errEl.textContent = 'Invalid image data.'; errEl.classList.remove('hidden'); }
      return;
    }
    state.pendingImg = b64;
    const drop = document.getElementById('imgDrop');
    if (drop) {
      drop.innerHTML = `<img src="${b64}" style="max-height:160px;border-radius:.5rem;margin:0 auto;display:block;" alt="Preview"/>
        <div class="text-xs text-gray-500 mt-2">Click to change photo</div>`;
    }
  };
  reader.readAsDataURL(file);
}

export function handleDrop(ev) {
  ev.preventDefault();
  document.getElementById('imgDrop')?.classList.remove('drag');
  const file = ev.dataTransfer?.files?.[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    const fi = document.getElementById('imgFile');
    if (fi) { fi.files = dt.files; handleImgUpload(fi); }
  }
}

export function clearImg() {
  state.pendingImg = null;
  setState({});
}

export function previewMap() {
  const lat = (document.getElementById('hLat')?.value ?? '').trim();
  const lng = (document.getElementById('hLng')?.value ?? '').trim();
  const el  = document.getElementById('mapPrev');
  if (!el) return;
  if (!lat || !lng || !validate('lat', lat) || !validate('lng', lng)) {
    el.innerHTML = '<p class="text-red-500 text-xs">Please enter valid latitude and longitude first.</p>';
    el.classList.remove('hidden');
    return;
  }
  const b   = 0.008;
  const emb = `https://www.openstreetmap.org/export/embed.html?bbox=${+lng-b},${+lat-b},${+lng+b},${+lat+b}&layer=mapnik&marker=${lat},${lng}`;
  const lnk = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`;
  el.innerHTML = `
    <iframe class="map-frame" loading="lazy" src="${emb}" title="Location preview"></iframe>
    <a href="${lnk}" target="_blank" rel="noopener noreferrer" class="text-xs text-g hover:underline">Open full map ↗</a>`;
  el.classList.remove('hidden');
}

/* Live validation feedback for input fields */
export function liveVal(el, type) {
  const v = el.value.trim();
  el.classList.remove('ok', 'bad');
  if (!v) return;
  const ok = type === 'email' ? (v === '' || validate('email', v)) : validate(type, v);
  el.classList.add(ok ? 'ok' : 'bad');
}
