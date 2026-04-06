/**
 * modals/index.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Booking.com upgrades:
 *   - Step 3 review: full price breakdown (semester fee + confirmation fee + balance)
 *   - Success modal: "Download Booking Slip" button
 *   - New modalBookingSlip() — printable receipt modal
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { state }        from '../state.js';
import { e, formatPrice, getHostel, mapEmbedUrl, mapLinkUrl, hostelCoverHtml, starRatingHtml } from '../utils.js';
import { getCsrfToken, isLoginLocked, getBruteForceState } from '../security.js';
import { ROOM_TYPES, FLOOR_OPTIONS, GENDER_OPTIONS, SEMESTERS, STUDY_YEARS } from '../data.js';

/* ─────────────────────────────────────────────────────────────────────────
   MODAL DISPATCHER
──────────────────────────────────────────────────────────────────────────── */
export function renderModal() {
  if (!state.modal) return '';
  const inner = modalContent();
  if (!inner) return '';
  return `
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-bg"
       id="modal-overlay" onclick="App.handleOverlayClick(event)">
    <div class="modal-box fade" onclick="event.stopPropagation()">
      ${inner}
    </div>
  </div>`;
}

function modalContent() {
  switch (state.modal) {
    case 'adminLogin':    return modalAdminLogin();
    case 'addHostel':     return modalHostelForm(false);
    case 'editHostel':    return modalHostelForm(true);
    case 'viewHostel':    return modalViewHostel();
    case 'delHostelConf': return modalDelHostel();
    case 'addRoom':       return modalRoomForm(false);
    case 'editRoom':      return modalRoomForm(true);
    case 'delRoomConf':   return modalDelRoom();
    case 'booking':       return modalBooking();
    case 'success':       return modalSuccess();
    case 'bookingSlip':   return modalBookingSlip();
    default:              return '';
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   SHARED HELPERS
──────────────────────────────────────────────────────────────────────────── */
function mHead(title, icon = '') {
  return `
  <div class="flex items-center justify-between p-5 border-b">
    <h3 class="text-g text-xl">${icon ? `<span class="mr-2">${icon}</span>` : ''}${e(title)}</h3>
    <button onclick="App.closeModal()" class="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN LOGIN
──────────────────────────────────────────────────────────────────────────── */
function modalAdminLogin() {
  const lk   = isLoginLocked();
  const bfSt = getBruteForceState();
  const left = Math.max(0, 5 - (bfSt.n || 0));
  const csrf = getCsrfToken();

  return `
  ${mHead('Admin Login', '🔐')}
  <div class="p-5">
    <div class="text-xs text-gray-400 mb-4">🛡 Protected by brute-force lockout &amp; CSRF token</div>
    ${lk.locked ? `
    <div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-center">
      <div class="text-red-600 font-bold text-sm">🔒 Account Temporarily Locked</div>
      <div class="text-red-500 text-xs mt-1">Try again in ${Math.ceil(lk.remaining / 1000)}s</div>
    </div>` : ''}
    <input type="hidden" id="lcsrf" value="${e(csrf)}"/>
    <div class="space-y-4">
      <div>
        <label class="lbl">Username</label>
        <input id="aU" type="text" maxlength="30" placeholder="admin" class="inp"
               ${lk.locked ? 'disabled' : ''} onkeydown="if(event.key==='Enter') App.doLogin()"/>
      </div>
      <div>
        <label class="lbl">Password</label>
        <input id="aP" type="password" maxlength="60" placeholder="••••••••" class="inp"
               ${lk.locked ? 'disabled' : ''} onkeydown="if(event.key==='Enter') App.doLogin()"/>
      </div>
      <div id="lErr" class="err-txt hidden bg-red-50 p-2 rounded"></div>
      ${!lk.locked && left < 5 ? `<div class="text-yellow-600 text-xs">⚠️ ${left} attempt(s) remaining</div>` : ''}
      <button id="lBtn" onclick="App.doLogin()" ${lk.locked ? 'disabled' : ''} class="btn-g w-full">Sign In</button>
      <p class="text-xs text-center text-gray-400">Demo · <b>admin</b> / <b>admin123</b></p>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   ADD / EDIT HOSTEL FORM
──────────────────────────────────────────────────────────────────────────── */
function modalHostelForm(isEdit) {
  const h    = isEdit ? getHostel(state.modalData.hostelId) : null;
  const csrf = getCsrfToken();
  const prev = state.pendingImg ?? (isEdit ? h?.image : null);

  return `
  ${mHead(isEdit ? `Edit Hostel — ${h?.name ?? ''}` : 'Add New Hostel', isEdit ? '✏️' : '🏢')}
  <div class="p-5 space-y-4">
    <input type="hidden" id="hcsrf" value="${e(csrf)}"/>
    ${isEdit ? `<input type="hidden" id="hEditId" value="${h?.id ?? ''}"/>` : ''}

    <!-- Photo upload -->
    <div>
      <label class="lbl">Hostel Photo</label>
      <div id="imgDrop" class="img-drop"
           onclick="document.getElementById('imgFile').click()"
           ondragover="event.preventDefault();this.classList.add('drag')"
           ondragleave="this.classList.remove('drag')"
           ondrop="App.handleDrop(event)">
        ${prev
          ? `<img id="imgPreview" src="${prev}" style="max-height:160px;border-radius:.5rem;margin:0 auto;display:block;" alt="Preview"/>
             <div class="text-xs text-gray-500 mt-2">Click to change photo</div>`
          : `<div class="text-4xl mb-2">📷</div>
             <div class="text-sm text-gray-600 font-semibold">Click or drag &amp; drop to upload</div>
             <div class="text-xs text-gray-400 mt-1">JPEG · PNG · WebP · Max 2 MB</div>`}
      </div>
      <input type="file" id="imgFile" accept="image/jpeg,image/png,image/gif,image/webp"
             class="hidden" onchange="App.handleImgUpload(this)"/>
      ${prev ? `<button onclick="App.clearImg()" class="text-xs text-red-500 hover:underline mt-1">✕ Remove photo</button>` : ''}
      <div id="imgErr" class="err-txt hidden mt-1"></div>
    </div>

    <!-- Basic info -->
    <div class="grid md:grid-cols-2 gap-4">
      <div>
        <label class="lbl">Hostel Name *</label>
        <input id="hN" type="text" maxlength="80" placeholder="e.g. Rwenzori Hall" class="inp"
               value="${e(h?.name ?? '')}"/>
      </div>
      <div>
        <label class="lbl">Gender *</label>
        <select id="hG" class="inp">
          ${GENDER_OPTIONS.map(g => `<option value="${g}"${(h?.gender ?? 'Mixed') === g ? ' selected' : ''}>${g}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      <div>
        <label class="lbl">Distance from Main Campus *</label>
        <input id="hD" type="text" maxlength="60" placeholder="e.g. 0.4 km from Main Gate" class="inp"
               value="${e(h?.distance ?? '')}"/>
      </div>
      <div>
        <label class="lbl">Star Rating (0–5)</label>
        <input id="hRating" type="number" min="0" max="5" step="0.1" class="inp"
               value="${h?.rating ?? ''}" placeholder="e.g. 4.2"/>
      </div>
    </div>
    <div>
      <label class="lbl">Description</label>
      <textarea id="hDesc" maxlength="250" rows="2" placeholder="Brief description of the hostel…"
                class="inp">${e(h?.description ?? '')}</textarea>
    </div>
    <div>
      <label class="lbl">Amenities (comma-separated)</label>
      <input id="hAm" type="text" maxlength="200" placeholder="Wi-Fi, Security, Water, Electricity"
             class="inp" value="${e((h?.amenities ?? []).join(', '))}"/>
    </div>

    <!-- Location -->
    <div class="bg-gray-50 rounded-xl p-4 space-y-3">
      <div class="font-semibold text-g text-sm">📍 Location Details</div>
      <div>
        <label class="lbl">Full Address *</label>
        <input id="hAddr" type="text" maxlength="120"
               placeholder="e.g. Along Kibundaire Road, Fort Portal City" class="inp"
               value="${e(h?.location?.address ?? '')}"/>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="lbl">Latitude *</label>
          <input id="hLat" type="text" maxlength="12" placeholder="0.6591" class="inp"
                 value="${e(h?.location?.lat ?? '')}" oninput="App.liveVal(this,'lat')"/>
        </div>
        <div>
          <label class="lbl">Longitude *</label>
          <input id="hLng" type="text" maxlength="12" placeholder="30.2752" class="inp"
                 value="${e(h?.location?.lng ?? '')}" oninput="App.liveVal(this,'lng')"/>
        </div>
      </div>
      <div class="text-xs text-gray-400">
        Fort Portal campus ≈ Lat: 0.659, Lng: 30.275 — adjust for exact hostel position.
      </div>
      <button type="button" onclick="App.previewMap()" class="btn-out btn-sm">🗺 Preview on Map</button>
      <div id="mapPrev" class="hidden mt-2"></div>
    </div>

    <div id="hErr" class="err-txt hidden bg-red-50 p-2 rounded"></div>
    <div class="flex gap-3 pt-2">
      <button onclick="App.closeModal()" class="btn-out flex-1">Cancel</button>
      <button onclick="${isEdit ? 'App.doEditHostel()' : 'App.doAddHostel()'}" class="btn-g flex-1">
        ${isEdit ? '💾 Save Changes' : '➕ Add Hostel'}
      </button>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   VIEW HOSTEL
──────────────────────────────────────────────────────────────────────────── */
function modalViewHostel() {
  const h = getHostel(state.modalData.hostelId);
  if (!h) return '<div class="p-6 text-center text-gray-400">Hostel not found.</div>';

  const s      = (() => { const t=h.rooms.length,b=h.rooms.filter(r=>r.status==='booked').length;return{t,b,a:t-b};})();
  const hasLoc = h.location?.lat && h.location?.lng;

  return `
  ${mHead(h.name, '👁')}
  <div class="p-5 space-y-4">
    ${hostelCoverHtml(h)}
    <div class="flex items-center gap-3 mt-2">
      ${h.rating ? starRatingHtml(h.rating) : ''}
    </div>
    <div class="grid md:grid-cols-3 gap-3">
      <div class="bg-green-50 rounded-xl p-3 text-center"><div class="text-2xl font-bold text-g">${s.a}</div><div class="text-xs text-gray-500">Available</div></div>
      <div class="bg-red-50   rounded-xl p-3 text-center"><div class="text-2xl font-bold text-red-600">${s.b}</div><div class="text-xs text-gray-500">Booked</div></div>
      <div class="bg-gray-50  rounded-xl p-3 text-center"><div class="text-2xl font-bold text-gray-600">${s.t}</div><div class="text-xs text-gray-500">Total</div></div>
    </div>
    <div class="space-y-2 text-sm">
      <div><span class="text-gray-500">Gender:</span> <b>${e(h.gender)}</b></div>
      <div><span class="text-gray-500">Distance:</span> <b>${e(h.distance)}</b></div>
      ${h.location?.address ? `<div><span class="text-gray-500">Address:</span> <b>${e(h.location.address)}</b></div>` : ''}
      ${hasLoc ? `<div><span class="text-gray-500">Coordinates:</span> <span class="font-mono text-xs">${e(h.location.lat)}, ${e(h.location.lng)}</span></div>` : ''}
      <div><span class="text-gray-500">Description:</span> ${e(h.description)}</div>
    </div>
    <div class="flex flex-wrap gap-2">${h.amenities.map(a => `<span class="chip">✓ ${e(a)}</span>`).join('')}</div>
    ${hasLoc ? `
    <iframe class="map-frame" loading="lazy"
            src="${e(mapEmbedUrl(h.location.lat, h.location.lng))}"
            title="Hostel location map"></iframe>
    <a href="${e(mapLinkUrl(h.location.lat, h.location.lng))}" target="_blank" rel="noopener noreferrer"
       class="text-sm text-g font-semibold hover:underline">🗺 Open Full Map ↗</a>` : ''}
    <div class="flex gap-3 pt-2">
      <button onclick="App.closeModal()" class="btn-out flex-1">Close</button>
      <button onclick="App.openModal('editHostel', { hostelId: ${h.id} })" class="btn-g flex-1">✏️ Edit This Hostel</button>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   DELETE HOSTEL CONFIRM
──────────────────────────────────────────────────────────────────────────── */
function modalDelHostel() {
  const h = getHostel(state.modalData.hostelId);
  if (!h) return '';
  const booked = h.rooms.filter(r => r.status === 'booked').length;
  return `
  ${mHead('Confirm Delete', '⚠️')}
  <div class="p-5 text-center space-y-4">
    <div class="w-16 h-16 rounded-full bg-red-100 text-4xl flex items-center justify-center mx-auto">🗑️</div>
    <h3 class="text-xl font-bold text-red-600">Delete "${e(h.name)}"?</h3>
    <p class="text-gray-600 text-sm">
      This will permanently remove this hostel and all <b>${h.rooms.length}</b> room(s).
      ${booked > 0 ? `<br/><span class="text-red-500 font-semibold">${booked} active booking(s) will also be removed.</span>` : ''}
    </p>
    <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">This action cannot be undone.</div>
    <div class="flex gap-3">
      <button onclick="App.closeModal()" class="btn-out flex-1">Cancel</button>
      <button onclick="App.doDelHostel()" class="btn-red flex-1">Yes, Delete Permanently</button>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   ADD / EDIT ROOM FORM
──────────────────────────────────────────────────────────────────────────── */
function modalRoomForm(isEdit) {
  const csrf = getCsrfToken();
  const h    = getHostel(state.modalData.hostelId);
  const r    = isEdit ? h?.rooms.find(x => x.id === state.modalData.roomId) : null;

  return `
  ${mHead(isEdit ? `Edit Room ${r?.number ?? ''}` : `Add Room — ${h?.name ?? ''}`, isEdit ? '✏️' : '🚪')}
  <div class="p-5 space-y-4">
    <input type="hidden" id="rcsrf" value="${e(csrf)}"/>
    <div class="grid md:grid-cols-2 gap-4">
      <div>
        <label class="lbl">Room Number *</label>
        <input id="rN" type="text" maxlength="10" placeholder="e.g. A101" class="inp"
               value="${e(r?.number ?? '')}" oninput="App.liveVal(this,'rnum')"/>
      </div>
      <div>
        <label class="lbl">Room Type *</label>
        <select id="rT" class="inp">
          ${ROOM_TYPES.map(t => `<option value="${t}"${(r?.type ?? 'Single') === t ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      <div>
        <label class="lbl">Floor *</label>
        <select id="rF" class="inp">
          ${FLOOR_OPTIONS.map(f => `<option value="${f}"${(r?.floor ?? '1st') === f ? ' selected' : ''}>${f}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="lbl">Price per Semester (UGX) *</label>
        <input id="rP" type="number" min="50000" max="2000000" class="inp"
               value="${r?.price ?? ''}" placeholder="e.g. 450000"/>
      </div>
      <div>
        <label class="lbl">Confirmation Fee (UGX) *</label>
        <input id="rCF" type="number" min="0" max="2000000" class="inp"
               value="${r?.confirmationFee ?? '50000'}" placeholder="e.g. 50000"/>
      </div>
    </div>
    ${isEdit ? `
    <div>
      <label class="lbl">Status</label>
      <select id="rS" class="inp">
        <option value="available"${r?.status === 'available' ? ' selected' : ''}>Available</option>
        <option value="pending"  ${r?.status === 'pending'   ? ' selected' : ''}>Pending</option>
        <option value="booked"   ${r?.status === 'booked'    ? ' selected' : ''}>Booked</option>
      </select>
    </div>` : ''}
    <div id="rErr" class="err-txt hidden bg-red-50 p-2 rounded"></div>
    <div class="flex gap-3 pt-2">
      <button onclick="App.closeModal()" class="btn-out flex-1">Cancel</button>
      <button onclick="${isEdit ? 'App.doEditRoom()' : 'App.doAddRoom()'}" class="btn-g flex-1">
        ${isEdit ? '💾 Save Changes' : '➕ Add Room'}
      </button>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   DELETE ROOM CONFIRM
──────────────────────────────────────────────────────────────────────────── */
function modalDelRoom() {
  const h = getHostel(state.modalData.hostelId);
  const r = h?.rooms.find(x => x.id === state.modalData.roomId);
  return `
  ${mHead('Confirm Remove Room', '⚠️')}
  <div class="p-5 text-center space-y-4">
    <div class="w-16 h-16 rounded-full bg-red-100 text-4xl flex items-center justify-center mx-auto">🚪</div>
    <h3 class="text-xl font-bold text-red-600">Remove Room ${e(r?.number ?? '')}?</h3>
    <p class="text-gray-600 text-sm">
      From <b>${e(h?.name ?? '')}</b>.
      ${r?.status === 'booked' ? '<br/><span class="text-red-500 font-semibold">This room is currently booked — the booking record will also be removed.</span>' : ''}
    </p>
    <div class="flex gap-3">
      <button onclick="App.closeModal()" class="btn-out flex-1">Cancel</button>
      <button onclick="App.doDelRoom()" class="btn-red flex-1">Remove Room</button>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   BOOKING FLOW
──────────────────────────────────────────────────────────────────────────── */
function modalBooking() {
  const h    = getHostel(state.selH);
  const room = h?.rooms.find(r => r.id === state.selR);
  if (!h || !room) return '<div class="p-6 text-center text-gray-400">Room not found.</div>';
  if (room.status === 'booked') return `
    <div class="p-6 text-center">
      <div class="text-4xl mb-3">😟</div>
      <p class="text-gray-600">This room was just booked. Please choose another.</p>
      <button onclick="App.closeModal()" class="btn-g mt-4">Close</button>
    </div>`;

  const csrf = getCsrfToken();
  const st   = state.bStep;
  const bd   = state.bData;

  const stepDot = (n) => {
    const cls = st > n ? 'done' : st === n ? 'active' : 'idle';
    return `<div class="step-dot ${cls}">${st > n ? '✓' : n}</div>`;
  };
  const stepLine = (n) => `<div class="step-line ${st > n ? 'done' : 'idle'}"></div>`;

  return `
  ${mHead(`Book Room ${room.number} — ${h.name}`, '🏨')}
  <div class="p-5">
    <div class="text-xs text-gray-500 mb-4">
      ${e(room.type)} · ${e(room.floor)} Floor · ${formatPrice(room.price)}/semester
    </div>
    <input type="hidden" id="bcsrf" value="${e(csrf)}"/>

    <!-- Step indicator -->
    <div class="flex items-center gap-2 mb-6">
      ${stepDot(1)} ${stepLine(1)}
      ${stepDot(2)} ${stepLine(2)}
      ${stepDot(3)}
      <div class="ml-2 text-xs text-gray-500">
        ${['Personal Info','Contact & Course','Review & Pay'][st - 1]}
      </div>
    </div>

    ${st === 1 ? `
    <div class="space-y-4">
      <div>
        <label class="lbl">Full Name *</label>
        <input id="fN" type="text" maxlength="80" class="inp" placeholder="John Doe"
               value="${e(bd.studentName ?? '')}" oninput="App.liveVal(this,'name')"/>
      </div>
      <div>
        <label class="lbl">Registration Number *</label>
        <input id="fR" type="text" maxlength="40" class="inp uppercase" placeholder="2026/U/MMU/CCS/0000001"
               value="${e(bd.regNo ?? '')}" oninput="App.liveVal(this,'regNo')"/>
        <div class="text-xs text-gray-400 mt-1">Format: YYYY/U/MMU/COURSE/NNNNNNN</div>
      </div>
      <div>
        <label class="lbl">Year of Study *</label>
        <select id="fY" class="inp">
          <option value="">Select year</option>
          ${STUDY_YEARS.map(y => `<option${bd.year === y ? ' selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>
      <div id="s1e" class="err-txt hidden bg-red-50 p-2 rounded"></div>
      <button onclick="App.bStep1()" class="btn-g w-full">Next →</button>
    </div>` : ''}

    ${st === 2 ? `
    <div class="space-y-4">
      <div>
        <label class="lbl">Phone Number *</label>
        <input id="fPh" type="tel" maxlength="15" class="inp" placeholder="+256 7XX XXX XXX"
               value="${e(bd.phone ?? '')}" oninput="App.liveVal(this,'phone')"/>
        <div class="text-xs text-gray-400 mt-1">Uganda format: +256XXXXXXXXX or 07XXXXXXXX</div>
      </div>
      <div>
        <label class="lbl">Email (optional)</label>
        <input id="fE" type="email" maxlength="100" class="inp" placeholder="student@mmu.ac.ug"
               value="${e(bd.email ?? '')}" oninput="App.liveVal(this,'email')"/>
      </div>
      <div>
        <label class="lbl">Programme / Course *</label>
        <input id="fC" type="text" maxlength="100" class="inp" placeholder="BSc Computer Science"
               value="${e(bd.course ?? '')}" oninput="App.liveVal(this,'course')"/>
      </div>
      <div>
        <label class="lbl">Academic Semester *</label>
        <select id="fSm" class="inp">
          <option value="">Select semester</option>
          ${SEMESTERS.map(s => `<option${bd.semester === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div id="s2e" class="err-txt hidden bg-red-50 p-2 rounded"></div>
      <div class="flex gap-3">
        <button onclick="App.setState({ bStep: 1 })" class="btn-out flex-1">← Back</button>
        <button onclick="App.bStep2()" class="btn-g flex-1">Next →</button>
      </div>
    </div>` : ''}

    ${st === 3 ? `
    <div>
      <!-- Student + room summary -->
      <div class="bg-green-50 rounded-xl p-4 mb-4 text-sm">
        <div class="font-bold text-g mb-3">📋 Booking Summary</div>
        <div class="grid grid-cols-2 gap-1 text-xs">
          <span class="text-gray-500">Student:</span>  <b>${e(bd.studentName)}</b>
          <span class="text-gray-500">Reg No:</span>   <b>${e(bd.regNo)}</b>
          <span class="text-gray-500">Course:</span>   <b>${e(bd.course)}</b>
          <span class="text-gray-500">Year:</span>     <b>${e(bd.year)}</b>
          <span class="text-gray-500">Phone:</span>    <b>${e(bd.phone)}</b>
          <span class="text-gray-500">Semester:</span> <b>${e(bd.semester)}</b>
        </div>
        <div class="border-t border-green-200 pt-2 mt-2 grid grid-cols-2 gap-1 text-xs">
          <span class="text-gray-500">Hostel:</span> <b>${e(h.name)}</b>
          <span class="text-gray-500">Room:</span>   <b>${e(room.number)} (${e(room.type)})</b>
          <span class="text-gray-500">Floor:</span>  <b>${e(room.floor)}</b>
        </div>
      </div>

      <!-- Price breakdown (Booking.com style) -->
      <div class="bg-white border border-gray-200 rounded-xl p-4 mb-4 text-sm">
        <div class="font-bold text-g mb-3">💰 Price Breakdown</div>
        <div class="space-y-2 text-xs">
          <div class="flex justify-between">
            <span class="text-gray-500">Full semester fee</span>
            <span class="font-semibold">${formatPrice(room.price)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Pay now (confirmation fee)</span>
            <span class="font-bold text-g">${formatPrice(room.confirmationFee || 0)}</span>
          </div>
          <div class="border-t pt-2 flex justify-between">
            <span class="text-gray-500">Balance due on arrival</span>
            <span class="font-semibold text-gold">${formatPrice(room.price - (room.confirmationFee || 0))}</span>
          </div>
        </div>
      </div>

      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 mb-4">
        ⚠️ A confirmation fee of <b>${formatPrice(room.confirmationFee || 0)}</b> will be charged via Flutterwave (mobile money or card). By confirming, you agree to MMU hostel T&amp;Cs.
      </div>
      <div id="s3e" class="err-txt hidden bg-red-50 p-2 rounded mb-3"></div>
      <div class="flex gap-3">
        <button onclick="App.setState({ bStep: 2 })" class="btn-out flex-1">← Back</button>
        <button onclick="App.confirmBooking()" id="cbtn" class="btn-gold flex-1">
          💳 Pay ${formatPrice(room.confirmationFee || room.price)} Now
        </button>
      </div>
    </div>` : ''}
  </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   SUCCESS
──────────────────────────────────────────────────────────────────────────── */
function modalSuccess() {
  // Extract booking ID from success message for the slip button
  const refMatch = state.successMsg?.match(/Ref: #([A-Z0-9]+)/);
  const bookingId = refMatch ? refMatch[1] : null;

  return `
  <div class="p-8 text-center">
    <div class="w-16 h-16 rounded-full bg-green-100 text-4xl flex items-center justify-center mx-auto mb-4">✅</div>
    <h3 class="text-g text-2xl mb-2">Booking Confirmed!</h3>
    <p class="text-gray-500 text-sm mb-4">${e(state.successMsg)}</p>
    <div class="bg-green-50 rounded-xl p-4 text-sm text-left mb-5 space-y-1">
      <div class="font-bold text-g mb-1">Next Steps:</div>
      <div>1. Your booking is 100% confirmed via digital payment.</div>
      <div>2. Present your booking reference and student ID upon arrival.</div>
      <div>3. Collect your room key from the Hostel Warden.</div>
    </div>
    <div class="flex gap-3 flex-wrap">
      <button onclick="App.go('myBookings'); App.closeModal();" class="btn-g flex-1">View My Booking</button>
      ${bookingId ? `<button onclick="App.openModal('bookingSlip', { bookingId: '${bookingId}' })" class="btn-out flex-1">📄 Download Slip</button>` : ''}
    </div>
    <button onclick="App.go('hostels'); App.closeModal();" class="text-sm text-gray-400 hover:underline mt-3 block mx-auto">Back to Hostels</button>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   BOOKING SLIP (printable receipt — Booking.com-style confirmation)
──────────────────────────────────────────────────────────────────────────── */
function modalBookingSlip() {
  const { bookingId } = state.modalData;
  const { bookings }  = (() => { const m = import.meta; return window.__mmuState__ ?? { bookings: [] }; })();

  // Access bookings via the globally accessible state populated by handlers
  const bArr    = window.__mmuBookings__ ?? [];
  const booking = bArr.find(b => b.id === bookingId);

  if (!booking) {
    // Fallback: render the slip from successMsg
    return `
    ${mHead('Booking Slip', '📄')}
    <div class="p-5 text-center">
      <p class="text-gray-400 text-sm">Slip data not available. Please use "View My Booking" to find your booking.</p>
      <button onclick="App.go('myBookings'); App.closeModal();" class="btn-g mt-4">My Bookings</button>
    </div>`;
  }

  const h    = getHostel(booking.hostelId);
  const room = h?.rooms.find(r => r.id === booking.roomId);

  return `
  ${mHead('Booking Slip', '📄')}
  <div class="p-5">
    <div class="slip-wrap">
      <div class="slip-header">
        <div style="font-size:2rem">🏠</div>
        <div>
          <div style="font-size:1rem;font-weight:800">MMU Hostel Booking</div>
          <div style="font-size:.7rem;opacity:.75">Mountains of the Moon University · Fort Portal</div>
        </div>
      </div>
      <div class="slip-body">
        <div class="slip-row"><span class="slip-key">Student Name</span><span class="slip-val">${e(booking.studentName)}</span></div>
        <div class="slip-row"><span class="slip-key">Reg Number</span><span class="slip-val">${e(booking.regNo)}</span></div>
        <div class="slip-row"><span class="slip-key">Course</span><span class="slip-val">${e(booking.course)}</span></div>
        <div class="slip-row"><span class="slip-key">Academic Year</span><span class="slip-val">${e(booking.year ?? '—')}</span></div>
        <div class="slip-row"><span class="slip-key">Semester</span><span class="slip-val">${e(booking.semester ?? '—')}</span></div>
        <div class="slip-row"><span class="slip-key">Phone</span><span class="slip-val">${e(booking.phone ?? '—')}</span></div>
        <div style="border-top:2px dashed #d1d5db;margin:.75rem 0"></div>
        <div class="slip-row"><span class="slip-key">Hostel</span><span class="slip-val">${e(h?.name ?? '—')}</span></div>
        <div class="slip-row"><span class="slip-key">Room</span><span class="slip-val">${e(room?.number ?? '—')} (${e(room?.type ?? '—')})</span></div>
        <div class="slip-row"><span class="slip-key">Floor</span><span class="slip-val">${e(room?.floor ?? '—')}</span></div>
        <div class="slip-row"><span class="slip-key">Semester Fee</span><span class="slip-val">${formatPrice(room?.price ?? 0)}</span></div>
        <div class="slip-row"><span class="slip-key">Confirmation Paid</span><span class="slip-val" style="color:var(--g)">${formatPrice(room?.confirmationFee ?? 0)}</span></div>
        <div class="slip-row"><span class="slip-key">Balance on Arrival</span><span class="slip-val" style="color:var(--gold)">${formatPrice((room?.price ?? 0) - (room?.confirmationFee ?? 0))}</span></div>
        <div class="slip-row"><span class="slip-key">Booking Date</span><span class="slip-val">${e(booking.date ?? '—')}</span></div>
        <div class="slip-ref">
          <div style="font-size:.65rem;color:#6b7280;margin-bottom:.25rem">BOOKING REFERENCE</div>
          <div class="slip-ref-num">#${e(booking.id)}</div>
          <div style="font-size:.65rem;color:#16a34a;margin-top:.25rem">✅ CONFIRMED · Paid via Flutterwave</div>
        </div>
      </div>
    </div>

    <div class="flex gap-3 mt-4 no-print">
      <button onclick="App.downloadBookingSlip('${e(bookingId)}')" class="btn-g flex-1">🖨 Print Slip</button>
      <button onclick="App.closeModal()" class="btn-out flex-1">Close</button>
    </div>
  </div>`;
}
