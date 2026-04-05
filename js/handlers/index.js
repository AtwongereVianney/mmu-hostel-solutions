/**
 * js/handlers/index.js  –  ALL Business Logic & Action Handlers
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns:
 *   • Auth (login / logout)
 *   • Hostel CRUD
 *   • Room CRUD + release
 *   • Booking flow (3-step + confirm)
 *   • Image upload / drop / clear / map preview
 *   • Booking lookup (student)
 *
 * No HTML rendering occurs here. Templates live in views/ and modals/.
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
import { getHostel, makeId, today, escapeHtml, bookingCardHtml } from '../utils.js';
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
    status: document.getElementById('rS')?.value  ?? 'available',
  };
}

function _validateRoomForm(f) {
  if (!verifyCsrfToken(f.csrf))            { _fieldErr('rErr','Invalid security token.'); return false; }
  if (!validate('rnum', f.num))            { _fieldErr('rErr','Invalid room number — alphanumeric only, max 10 chars.'); return false; }
  if (!ROOM_TYPES.includes(f.type))        { _fieldErr('rErr','Invalid room type.'); return false; }
  if (!FLOOR_OPTIONS.includes(f.floor))    { _fieldErr('rErr','Invalid floor.'); return false; }
  if (!f.price||f.price<50000||f.price>2000000) { _fieldErr('rErr','Price must be UGX 50,000 – 2,000,000.'); return false; }
  if (!['available','booked'].includes(f.status)) { _fieldErr('rErr','Invalid status.'); return false; }
  return true;
}

export async function doAddRoom() {
  const f = _readRoomForm();
  if (!_validateRoomForm(f)) return;
  const h = getHostel(state.modalData.hostelId);
  if (!h) { showToast('Hostel not found.', 'error'); return; }
  if (h.rooms.some(r => r.number === f.num)) { _fieldErr('rErr', `Room ${f.num} already exists in this hostel.`); return; }
  h.rooms.push({ id: makeId(), number: f.num, type: f.type, floor: f.floor, price: f.price, status: 'available' });
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
  Object.assign(h.rooms[rIdx], { number: f.num, type: f.type, floor: f.floor, price: f.price, status: f.status });
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
  if (!r || r.status === 'booked') { showToast('This room is no longer available.', 'warn'); setState({}); return; }
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
  if (!validate('regNo', reg))    { _fieldErr('s1e', 'Invalid format. Use: MMU/YYYY/NNN'); return; }
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
  if (h.rooms[rIdx].status === 'booked') {
    showToast('Room just booked by someone else. Please choose another.', 'warn');
    setState({ modal: null });
    return;
  }

  const btn = document.getElementById('cbtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }

  h.rooms[rIdx].status   = 'booked';
  h.rooms[rIdx].bookedBy = state.bData.studentName;
  h.rooms[rIdx].regNo    = state.bData.regNo;

  const room = h.rooms[rIdx];
  const randArr = new Uint32Array(1);
  crypto.getRandomValues(randArr);
  const booking = {
    id:       'B' + randArr[0].toString(36).toUpperCase(),
    hostelId: h.id,
    roomId:   room.id,
    ...state.bData,
    date:     today(),
  };
  bookings.push(booking);
  countBooking();

  await saveData();
  await auditLog('BOOKING_CREATED',
    `Room ${room.number} in ${h.name} booked by ${booking.studentName} (${booking.regNo})`,
    { ref: booking.id }
  );

  setState({
    modal:      'success',
    successMsg: `Room ${room.number} in ${h.name} booked for ${state.bData.studentName}. Ref: #${booking.id}`,
    bStep:      1,
    bData:      {},
  });
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
    resEl.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">⚠️ Invalid format. Use: MMU/YYYY/NNN</div>`;
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
