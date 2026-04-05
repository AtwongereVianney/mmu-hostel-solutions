/**
 * views/hostels.js  – Hostel list page
 * views/hostelDetail.js – Single hostel detail page
 * views/myBookings.js   – Student booking lookup page
 * views/admin.js        – Admin panel
 * views/securityDash.js – Security dashboard (admin only)
 *
 * All bundled in one file for brevity; each export is a pure render function.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { state }                      from '../state.js';
import { hostels, bookings }          from '../state.js';
import { e, formatPrice, roomStats, allStats, getHostel, mapEmbedUrl, mapLinkUrl, hostelCoverHtml, hostelThumbnailHtml, bookingCardHtml } from '../utils.js';
import { renderHostelCard }           from '../components/hostelCard.js';
import { isAuthenticated, getAuditLog, isLoginLocked, getBruteForceState } from '../security.js';

/* ══════════════════════════════════════════════════════════════════════════
   HOSTELS LIST
══════════════════════════════════════════════════════════════════════════ */
export function renderHostels() {
  const { fGender, fSearch } = state;
  const filtered = hostels.filter(h => {
    const gOk = fGender === 'All' || h.gender === fGender || h.gender === 'Mixed';
    const qOk = !fSearch || h.name.toLowerCase().includes(fSearch.toLowerCase());
    return gOk && qOk;
  });

  return `
  <div class="flex items-center gap-3 mb-5 flex-wrap">
    <button onclick="App.go('home')" class="text-g text-sm hover:underline">← Back</button>
    <h2 class="text-g text-2xl">All Hostels</h2>
    <span class="badge-ok text-xs px-2 py-0.5 rounded-full font-semibold">${filtered.length} found</span>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-xl shadow-card p-4 mb-6 flex flex-wrap gap-3 items-end">
    <div>
      <label class="lbl">Search</label>
      <input class="inp" style="width:200px" maxlength="80" placeholder="Hostel name…"
             value="${e(fSearch)}"
             oninput="App.setState({ fSearch: Sec.sanitize(this.value, 80) })"/>
    </div>
    <div>
      <label class="lbl">Gender</label>
      <select class="inp" onchange="App.setState({ fGender: this.value })">
        ${['All','Male','Female','Mixed'].map(g => `<option value="${g}"${fGender===g?' selected':''}>${g}</option>`).join('')}
      </select>
    </div>
    <button onclick="App.setState({ fGender:'All', fSearch:'' })" class="text-sm text-g hover:underline">Reset</button>
  </div>

  <div class="grid md:grid-cols-3 gap-5">
    ${filtered.length
      ? filtered.map(renderHostelCard).join('')
      : '<div class="col-span-3 text-center py-12 text-gray-400">No hostels match your search.</div>'}
  </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   HOSTEL DETAIL
══════════════════════════════════════════════════════════════════════════ */
export function renderHostelDetail() {
  const h = getHostel(state.selH);
  if (!h) return '<div class="text-center py-12 text-gray-400">Hostel not found.</div>';

  const s      = roomStats(h);
  const pct    = s.t > 0 ? Math.round((s.b / s.t) * 100) : 0;
  const rooms  = h.rooms.filter(r => state.fType === 'All' || r.type === state.fType);
  const hasLoc = h.location?.lat && h.location?.lng;

  return `
  <button onclick="App.go('hostels')" class="text-g text-sm hover:underline mb-4 block">← Back to Hostels</button>

  <!-- Hostel Header Card -->
  <div class="bg-white rounded-2xl shadow-card overflow-hidden mb-6">
    ${hostelCoverHtml(h)}
    <div class="p-6 md:flex md:items-start md:justify-between gap-6">
      <div class="flex-1">
        <h1 class="text-g text-2xl mb-1">${e(h.name)}</h1>
        <div class="text-gray-500 text-sm mb-1">📍 ${e(h.distance)} &nbsp;|&nbsp; 👫 ${e(h.gender)}</div>
        ${h.location?.address ? `<div class="text-gray-400 text-xs mb-2">🗺 ${e(h.location.address)}</div>` : ''}
        <p class="text-gray-600 text-sm mb-4 max-w-lg">${e(h.description)}</p>
        <div class="flex flex-wrap gap-2 mb-4">
          ${h.amenities.map(a => `<span class="chip">✓ ${e(a)}</span>`).join('')}
        </div>
        ${hasLoc ? `<a href="${e(mapLinkUrl(h.location.lat, h.location.lng))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-sm text-g font-semibold hover:underline">🗺 View on OpenStreetMap ↗</a>` : ''}
      </div>
      <!-- Stats + Map -->
      <div class="mt-4 md:mt-0 min-w-[190px]">
        <div class="bg-gray-50 rounded-xl p-4 text-center mb-3">
          <div class="text-3xl font-bold text-g">${s.a}</div>
          <div class="text-sm text-gray-500">Available Rooms</div>
          <div class="text-xs text-gray-400">${s.b} booked / ${s.t} total</div>
          <div class="mt-2 bg-gray-200 rounded-full h-2">
            <div class="prog h-2 rounded-full" style="width:${pct}%"></div>
          </div>
          ${h.rooms.length ? `<div class="text-xs font-bold text-gold mt-2">From ${formatPrice(Math.min(...h.rooms.map(r => r.price)))}/sem</div>` : ''}
        </div>
        ${hasLoc ? `<iframe class="map-frame" loading="lazy"
          src="${e(mapEmbedUrl(h.location.lat, h.location.lng))}"
          title="Hostel location map"></iframe>` : ''}
      </div>
    </div>
  </div>

  <!-- Room Filter Tabs -->
  <div class="flex items-center gap-3 mb-4 flex-wrap">
    <h2 class="text-g text-xl flex-1">Rooms</h2>
    ${['All','Single','Double','Triple'].map(t => `
      <button onclick="App.setState({ fType:'${t}' })"
              class="text-sm px-3 py-1 rounded-full border font-semibold transition-colors ${state.fType===t ? 'bg-g text-white border-transparent' : 'bg-white text-gray-600 border-gray-300 hover:border-green-600'}">
        ${t}
      </button>`).join('')}
  </div>

  <!-- Rooms Grid -->
  <div class="grid md:grid-cols-3 gap-4">
    ${rooms.map(r => `
    <div class="bg-white rounded-xl shadow-card p-4 ${r.status==='available'?'shadow-hover cursor-pointer':''}"
         ${r.status==='available' ? `onclick="App.openBooking(${h.id},${r.id})"` : ''}>
      <div class="flex items-start justify-between mb-2">
        <div>
          <div class="font-bold text-g">Room ${e(r.number)}</div>
          <div class="text-xs text-gray-500">${e(r.type)} · ${e(r.floor)} Floor</div>
        </div>
        <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${r.status==='available'?'badge-ok':'badge-err'}">
          ${r.status === 'available' ? 'Available' : 'Booked'}
        </span>
      </div>
      <div class="text-gold font-bold text-sm mb-3">
        ${formatPrice(r.price)}<span class="text-gray-400 font-normal text-xs">/semester</span>
      </div>
      <div class="text-xs text-gray-400 mb-3">
        ${r.type==='Single'?'🛏 1 Bed':r.type==='Double'?'🛏🛏 2 Beds':'🛏🛏🛏 3 Beds'} · Per person
      </div>
      ${r.status === 'available'
        ? `<button onclick="App.openBooking(${h.id},${r.id})" class="btn-g w-full text-center">Book This Room</button>`
        : `<div class="w-full bg-gray-100 text-gray-400 py-2 rounded-lg text-sm text-center">Not Available</div>`}
    </div>`).join('')}
  </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   MY BOOKINGS
══════════════════════════════════════════════════════════════════════════ */
export function renderMyBookings() {
  return `
  <h2 class="text-g text-2xl mb-2">My Bookings</h2>
  <p class="text-gray-500 text-sm mb-5">Enter your registration number to view your booking status.</p>

  <div class="bg-white rounded-xl shadow-card p-5 mb-5 max-w-md">
    <label class="lbl">Student Registration Number</label>
    <div class="flex gap-2">
      <input id="regIn" type="text" maxlength="20" placeholder="MMU/2023/001" class="inp flex-1"
             onkeydown="if(event.key==='Enter') App.lookupBooking()"/>
      <button onclick="App.lookupBooking()" class="btn-g">Search</button>
    </div>
    <div class="text-xs text-gray-400 mt-1">Format: MMU/YYYY/NNN</div>
  </div>

  <div id="bkResult"></div>

  ${bookings.length ? `
  <h3 class="text-g text-lg mb-3 mt-6">All Bookings (${bookings.length})</h3>
  <div class="space-y-3">${bookings.map(bookingCardHtml).join('')}</div>` : ''}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   ADMIN PANEL
══════════════════════════════════════════════════════════════════════════ */
export function renderAdmin() {
  if (!state.adminMode || !isAuthenticated()) {
    state.adminMode = false;
    setTimeout(() => App.openModal('adminLogin'), 0);
    return '<div class="text-center py-12 text-gray-400">Redirecting to login…</div>';
  }

  const s = allStats();

  return `
  <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
    <div>
      <h2 class="text-g text-2xl">Admin Panel</h2>
      <div class="text-xs text-gray-500">Session active · Auto-logout after 30 min idle</div>
    </div>
    <button onclick="App.requireAdmin() && App.openModal('addHostel', {})" class="btn-g">+ Add Hostel</button>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    ${[['Hostels',hostels.length,'🏢'],['Total Rooms',s.t,'🚪'],['Available',s.a,'✅'],['Booked',s.b,'🔴']].map(([l,v,ic])=>
      `<div class="bg-white rounded-xl shadow-card p-4 text-center" style="border-top:3px solid var(--gold)">
        <div class="text-2xl mb-1">${ic}</div>
        <div class="text-2xl font-bold text-g">${v}</div>
        <div class="text-xs text-gray-500">${l}</div>
      </div>`).join('')}
  </div>

  <!-- Hostels Table -->
  <div class="space-y-4 mb-6">
    ${hostels.map(h => {
      const hs = roomStats(h);
      return `
      <div class="bg-white rounded-xl shadow-card overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b flex-wrap gap-3" style="background:${e(h.color)}10">
          <div class="flex items-center gap-3">
            ${hostelThumbnailHtml(h)}
            <div>
              <div class="font-bold text-g">${e(h.name)}</div>
              <div class="text-xs text-gray-500">${e(h.distance)} · ${e(h.gender)}</div>
              ${h.location?.address ? `<div class="text-xs text-gray-400">📍 ${e(h.location.address.slice(0,45))}</div>` : ''}
            </div>
          </div>
          <div class="action-row">
            <span class="badge-ok  text-xs px-2 py-0.5 rounded-full font-semibold">${hs.a} avail</span>
            <span class="badge-err text-xs px-2 py-0.5 rounded-full font-semibold">${hs.b} booked</span>
            <button onclick="App.requireAdmin() && App.openModal('viewHostel',  { hostelId:${h.id} })" class="btn-out btn-sm">👁 View</button>
            <button onclick="App.requireAdmin() && App.openModal('editHostel',  { hostelId:${h.id} })" class="btn-out btn-sm" style="border-color:var(--g);color:var(--g)">✏️ Edit</button>
            <button onclick="App.requireAdmin() && App.openModal('addRoom',     { hostelId:${h.id} })" class="btn-out btn-sm" style="border-color:#2563eb;color:#2563eb">+ Room</button>
            <button onclick="App.requireAdmin() && App.openModal('delHostelConf',{ hostelId:${h.id} })" class="btn-red btn-sm">🗑 Delete</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="tbl-hd"><tr>
              <th>Room</th><th>Type</th><th>Floor</th><th>Price/Sem</th>
              <th>Status</th><th>Booked By</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${h.rooms.map(r => `
              <tr class="tbl-row">
                <td class="font-semibold">${e(r.number)}</td>
                <td>${e(r.type)}</td>
                <td>${e(r.floor)}</td>
                <td class="font-semibold text-gold">${formatPrice(r.price)}</td>
                <td><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${r.status==='available'?'badge-ok':'badge-err'}">${r.status}</span></td>
                <td class="text-xs text-gray-500">${e(r.bookedBy||'—')}</td>
                <td>
                  <div class="action-row">
                    <button onclick="App.requireAdmin() && App.openModal('editRoom', { hostelId:${h.id}, roomId:${r.id} })" class="text-xs text-g font-semibold hover:underline">✏️ Edit</button>
                    ${r.status === 'booked'
                      ? `<button onclick="App.requireAdmin() && App.releaseRoom(${h.id},${r.id})" class="text-xs text-blue-600 font-semibold hover:underline">↩ Release</button>`
                      : `<button onclick="App.requireAdmin() && App.openModal('delRoomConf', { hostelId:${h.id}, roomId:${r.id} })" class="text-xs text-red-500 font-semibold hover:underline">🗑 Del</button>`}
                  </div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    }).join('')}
  </div>

  <!-- Bookings log -->
  <div class="bg-white rounded-xl shadow-card p-5">
    <h3 class="text-g text-lg mb-3">All Bookings (${bookings.length})</h3>
    ${bookings.length ? `
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="tbl-hd"><tr>
          <th>Ref</th><th>Student</th><th>Reg No</th><th>Course</th>
          <th>Hostel / Room</th><th>Amount</th><th>Date</th>
        </tr></thead>
        <tbody>
          ${bookings.map(b => {
            const bh = getHostel(b.hostelId);
            const br = bh?.rooms.find(r => r.id === b.roomId);
            return `<tr class="tbl-row">
              <td class="font-mono text-xs text-gray-400">#${e(b.id)}</td>
              <td class="font-semibold">${e(b.studentName)}</td>
              <td class="text-gray-500">${e(b.regNo)}</td>
              <td class="text-xs text-gray-500">${e(b.course)}</td>
              <td class="text-xs">${e(bh?.name??'?')} / ${e(br?.number??'?')}</td>
              <td class="font-semibold text-gold text-xs">${br ? formatPrice(br.price) : '?'}</td>
              <td class="text-xs text-gray-400">${e(b.date)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '<p class="text-gray-400 text-sm text-center py-4">No bookings yet.</p>'}
  </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   SECURITY DASHBOARD
══════════════════════════════════════════════════════════════════════════ */
export function renderSecurity() {
  if (!state.adminMode || !isAuthenticated()) {
    setTimeout(() => App.openModal('adminLogin'), 0);
    return '<div></div>';
  }

  const log    = getAuditLog().slice().reverse();
  const lk     = isLoginLocked();
  const bfSt   = getBruteForceState();

  const mechs = [
    ['XSS Prevention',         true, 'escapeHtml() on all dynamic content in utils.js'],
    ['Content Security Policy',true, 'Meta CSP in index.html restricts scripts, frames, objects'],
    ['Clickjacking Defense',   true, 'X-Frame-Options: DENY + JS frame-buster in index.html'],
    ['Brute-Force Protection', true, '5 attempts → 15-min lockout + exponential backoff (security.js)'],
    ['Cryptographic Sessions', true, '256-bit CSPRNG token, 30-min idle expiry, sessionStorage only'],
    ['CSRF Tokens',            true, '192-bit per-session token, constant-time comparison (security.js)'],
    ['Input Validation',       true, 'Strict regex: regNo, phone, email, name, lat/lng (security.js)'],
    ['Input Sanitization',     true, 'Strip HTML tags, control chars, JS URIs (security.js)'],
    ['Password Hashing',       true, 'SHA-256 + SALT via Web Crypto API (security.js)'],
    ['Image Validation',       true, 'MIME whitelist, 2MB max, base64 sandbox (handlers/images.js)'],
    ['AES-GCM Encryption',     true, 'localStorage AES-256-GCM, random IV per write (storage.js)'],
    ['Authorization Guards',   true, 'App.requireAdmin() checks live session before every admin action'],
    ['Rate Limiting',          true, 'Max 10 bookings/session; double-submit prevention'],
    ['Audit Logging',          true, 'SHA-256 chain-hashed tamper-evident log (security.js)'],
    ['Prototype Pollution',    true, 'Object.freeze(Object.prototype) (security.js)'],
    ['Secure Error Handler',   true, 'Global catch – no stack traces to UI (security.js)'],
    ['Double-Booking Guard',   true, 'Atomic check-then-set before confirming (handlers/bookings.js)'],
    ['Open-Redirect Guard',    true, 'Navigation allowlist in data.js → enforced in app.js'],
  ];

  return `
  <div class="flex items-center gap-3 mb-5 flex-wrap">
    <button onclick="App.go('admin')" class="text-g text-sm hover:underline">← Back to Admin</button>
    <h2 class="text-g text-2xl">🔐 Security Dashboard</h2>
  </div>

  <!-- Status cards -->
  <div class="grid md:grid-cols-3 gap-4 mb-6">
    <div class="bg-white rounded-xl shadow-card p-4" style="border-top:3px solid #16a34a">
      <div class="text-2xl mb-1">🛡️</div>
      <div class="text-2xl font-bold text-green-700">${mechs.filter(m=>m[1]).length}/${mechs.length}</div>
      <div class="text-xs text-gray-500">Controls Active</div>
    </div>
    <div class="bg-white rounded-xl shadow-card p-4" style="border-top:3px solid ${lk.locked?'#dc2626':'#16a34a'}">
      <div class="text-2xl mb-1">${lk.locked ? '🔒' : '✅'}</div>
      <div class="font-bold text-lg ${lk.locked?'text-red-600':'text-green-700'}">${lk.locked?'LOCKED':'Normal'}</div>
      <div class="text-xs text-gray-500">${bfSt.n||0} failed attempt(s)</div>
      ${lk.locked ? `<div class="text-xs text-red-500 mt-1">Unlocks in ${Math.ceil(lk.remaining/60000)}m</div>` : ''}
    </div>
    <div class="bg-white rounded-xl shadow-card p-4" style="border-top:3px solid var(--gold)">
      <div class="text-2xl mb-1">📋</div>
      <div class="text-2xl font-bold text-gold">${log.length}</div>
      <div class="text-xs text-gray-500">Audit Log Entries</div>
    </div>
  </div>

  <!-- Controls grid -->
  <div class="bg-white rounded-xl shadow-card p-5 mb-6">
    <h3 class="text-g text-lg mb-3">Security Controls</h3>
    <div class="grid md:grid-cols-2 gap-2">
      ${mechs.map(([n,a,d]) => `
      <div class="flex items-start gap-2 p-2 rounded-lg ${a?'bg-green-50':'bg-red-50'}">
        <div class="text-base mt-0.5">${a?'✅':'❌'}</div>
        <div>
          <div class="font-semibold text-xs ${a?'text-green-800':'text-red-700'}">${e(n)}</div>
          <div class="text-xs text-gray-500">${e(d)}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>

  <!-- Audit log table -->
  <div class="bg-white rounded-xl shadow-card p-5">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-g text-lg">Audit Log</h3>
      <span class="text-xs text-gray-400 font-mono">SHA-256 chain-hashed</span>
    </div>
    ${log.length ? `
    <div class="overflow-x-auto">
      <table class="w-full text-xs font-mono">
        <thead class="tbl-hd"><tr>
          <th>Timestamp</th><th>Action</th><th>Message</th><th>Hash</th>
        </tr></thead>
        <tbody>
          ${log.slice(0, 60).map(en => `
          <tr class="tbl-row">
            <td class="text-gray-400 whitespace-nowrap">${e(en.ts?.replace('T',' ').split('.')[0])}</td>
            <td><span class="px-1.5 py-0.5 rounded text-xs font-bold ${
              en.action?.includes('FAIL')||en.action?.includes('LOCK')||en.action?.includes('REJECT') ? 'badge-err' :
              en.action?.includes('LOGIN')||en.action?.includes('LOGOUT') ? 'badge-info' : 'badge-ok'
            }">${e(en.action)}</span></td>
            <td class="text-gray-600 max-w-xs">${e(en.msg||'')}</td>
            <td class="text-gray-300">${e(en.hash?.slice(0,12)||'—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '<p class="text-gray-400 text-sm text-center py-4">No audit entries yet.</p>'}
  </div>`;
}
