/**
 * views/pages.js  – All page views
 * Booking.com upgrades:
 *   - Price range + semester filters on hostel list
 *   - Richer room cards with bed icons, urgency badges, confirmation fee
 *   - My Bookings: tabs (Search | Shortlist)
 *   - Admin: star rating management per hostel
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { state }                      from '../state.js';
import { hostels, bookings }          from '../state.js';
import {
  e, formatPrice, roomStats, getHostel,
  mapEmbedUrl, mapLinkUrl, hostelCoverHtml, hostelThumbnailHtml, roomPreviewHtml,
  bookingCardHtml, starRatingHtml, availabilityBadgeHtml, skeletonCardHtml,
} from '../utils.js';
import { renderHostelCard }           from '../components/hostelCard.js';
import { isAuthenticated, getAuditLog, isLoginLocked, getBruteForceState } from '../security.js';
import { SEMESTERS }     from '../data.js';

/* ══════════════════════════════════════════════════════════════════════════
   HOSTELS LIST
══════════════════════════════════════════════════════════════════════════ */
export function renderHostels() {
  const { fGender, fSearch, fSemester } = state;

  const filtered = hostels.filter(h => {
    const query = (fSearch || '').trim().toLowerCase();
    const gOk = fGender === 'All' || h.gender === fGender || h.gender === 'Mixed';
    // Substring match — only applied when the user has typed something and submitted
    const qOk = !query || h.name.toLowerCase().includes(query);
    return gOk && qOk;
  });

  return `
  <div class="flex items-center gap-3 mb-5 flex-wrap">
    <button onclick="App.go('home')" class="text-g text-sm hover:underline">← Back</button>
    <h2 class="text-g text-2xl">All Hostels</h2>
    <span class="badge-ok text-xs px-2 py-0.5 rounded-full font-semibold">${filtered.length} found</span>
  </div>

  <!-- Filters (Booking.com style panel) -->
  <div class="bg-white rounded-2xl shadow-card p-5 mb-6">
    <div class="font-bold text-g text-sm mb-3">🎚 Filter Hostels</div>
    <div class="grid md:grid-cols-3 gap-4 items-end mb-4">
      <div>
        <label class="lbl">Search</label>
        <input id="hostelSearchInput" class="inp" maxlength="80" placeholder="Hostel name… (press Enter or click Search)"
               value="${e(fSearch)}"
               onkeydown="if(event.key==='Enter'){ App.setState({ fSearch: Sec.sanitize(this.value, 80) }); App.searchHostels(); }"/>
      </div>
      <div>
        <label class="lbl">Gender</label>
        <select class="inp" onchange="App.setState({ fGender: this.value })">
          ${['All','Male','Female','Mixed'].map(g => `<option value="${g}"${fGender===g?' selected':''}>${g}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:.5rem;">
        <button onclick="App.setState({ fSearch: Sec.sanitize(document.getElementById('hostelSearchInput')?.value || '', 80) }); App.searchHostels();"
                class="btn-g" style="flex:1">🔍 Search</button>
        <button onclick="(function(){ var el=document.getElementById('hostelSearchInput'); if(el) el.value=''; App.setState({ fGender:'All', fSearch:'', fSemester:'All' }); })()"
                class="btn-out">↺ Reset</button>
      </div>
    </div>
  </div>

  <div class="grid md:grid-cols-3 gap-5">
    ${filtered.length
      ? filtered.map(renderHostelCard).join('')
      : '<div class="col-span-3 text-center py-12 text-gray-400">No hostels match your search. <button onclick="App.setState({ fGender:\'All\', fSearch:\'\', fSemester:\'All\' })" class="text-g underline ml-1">Reset filters</button></div>'}
  </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   HOSTEL DETAIL
══════════════════════════════════════════════════════════════════════════ */
export function renderHostelDetail() {
  const h = getHostel(state.selH);
  if (!h) return '<div class="text-center py-12 text-gray-400">Hostel not found.</div>';

  const s      = roomStats(h);
  const pct    = s.t > 0 ? Math.round(((s.b + s.p) / s.t) * 100) : 0;
  const rooms  = h.rooms.filter(r => state.fType === 'All' || r.type === state.fType);
  const hasLoc = h.location?.lat && h.location?.lng;
  const isSaved = state.shortlist.includes(h.id);

  /** Per-room icon helper */
  const bedIcon = t => t === 'Single' ? '🛏 1 Bed' : t === 'Double' ? '🛏🛏 2 Beds' : '🛏🛏🛏 3 Beds';

  return `
  <button onclick="App.go('hostels')" class="text-g text-sm hover:underline mb-4 block">← Back to Hostels</button>

  <!-- Hostel Header Card -->
  <div class="bg-white rounded-2xl shadow-card overflow-hidden mb-6">
    <div style="position:relative">
      ${hostelCoverHtml(h)}
      <!-- Shortlist button -->
      <button class="btn-heart${isSaved ? ' saved' : ''}"
              style="position:absolute;top:.75rem;right:.75rem;background:rgba(255,255,255,.9);width:2.5rem;height:2.5rem;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:1.3rem;"
              onclick="App.toggleShortlist(${h.id})"
              title="${isSaved ? 'Remove from shortlist' : 'Save to shortlist'}">
        ${isSaved ? '❤️' : '🤍'}
      </button>
    </div>

    <div class="p-6 md:flex md:items-start md:justify-between gap-6">
      <div class="flex-1">
        <div class="flex items-center gap-3 flex-wrap mb-1">
          <h1 class="text-g text-2xl">${e(h.name)}</h1>
          ${h.rating ? starRatingHtml(h.rating) : ''}
        </div>
        <div class="text-gray-500 text-sm mb-1">📍 ${e(h.distance)} &nbsp;|&nbsp; 👫 ${e(h.gender)}</div>
        ${h.location?.address ? `<div class="text-gray-400 text-xs mb-2">🗺 ${e(h.location.address)}</div>` : ''}
        <p class="text-gray-600 text-sm mb-4 max-w-lg">${e(h.description)}</p>
        <div class="flex flex-wrap gap-2 mb-4">
          ${h.amenities.map(a => `<span class="chip">✓ ${e(a)}</span>`).join('')}
        </div>
        ${hasLoc ? `<a href="${e(mapLinkUrl(h.location.lat, h.location.lng))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-sm text-g font-semibold hover:underline">🗺 View on OpenStreetMap ↗</a>` : ''}
      </div>

      <!-- Stats + Map -->
      <div class="mt-4 md:mt-0 min-w-[200px]">
        <div class="bg-gray-50 rounded-xl p-4 mb-3">
          <div class="grid grid-cols-3 gap-2 text-center mb-3">
            <div>
              <div class="text-xl font-bold text-g">${s.a}</div>
              <div class="text-xs text-gray-500">Available</div>
            </div>
            <div>
              <div class="text-xl font-bold text-yellow-600">${s.p}</div>
              <div class="text-xs text-gray-500">Pending</div>
            </div>
            <div>
              <div class="text-xl font-bold text-red-500">${s.b}</div>
              <div class="text-xs text-gray-500">Booked</div>
            </div>
          </div>
          <!-- Occupancy bar -->
          <div class="bg-gray-200 rounded-full h-2 mb-2">
            <div class="prog h-2 rounded-full" style="width:${pct}%"></div>
          </div>
          <div class="text-xs text-gray-400 text-center">${pct}% occupied · ${s.t} total rooms</div>
          ${h.rooms.length ? `<div class="text-xs font-bold text-gold text-center mt-2">From ${formatPrice(Math.min(...h.rooms.map(r => r.price)))}/sem</div>` : ''}
          <!-- Urgency badge -->
          <div class="mt-2 text-center">${availabilityBadgeHtml(s.a)}</div>
        </div>
        ${hasLoc ? `<iframe class="map-frame" loading="lazy"
          src="${e(mapEmbedUrl(h.location.lat, h.location.lng))}"
          title="Hostel location map"></iframe>` : ''}
      </div>
    </div>
  </div>

  <!-- Room Filter Tabs -->
  <div class="flex items-center gap-2 mb-4 flex-wrap">
    <h2 class="text-g text-xl flex-1">Rooms</h2>
    ${['All','Single','Double','Triple'].map(t => `
      <button onclick="App.setState({ fType:'${t}' })"
              class="text-sm px-3 py-1 rounded-full border font-semibold transition-colors ${state.fType===t ? 'bg-g text-white border-transparent' : 'bg-white text-gray-600 border-gray-300 hover:border-green-600'}">
        ${t}
      </button>`).join('')}
  </div>

  <!-- Rooms Grid (Booking.com-style rich cards) -->
  <div class="grid md:grid-cols-2 gap-4">
    ${rooms.length === 0
      ? '<div class="col-span-2 text-center py-8 text-gray-400">No rooms match this filter.</div>'
      : rooms.map(r => {
          const isAvail = r.status === 'available';
          return `
          <div class="bg-white rounded-xl shadow-card overflow-hidden ${isAvail ? 'shadow-hover' : 'opacity-80'}">
            ${roomPreviewHtml(r, h)}
            <!-- Room header stripe -->
            <div class="px-4 py-3 flex items-center justify-between" style="background:${isAvail ? '#f0fdf4' : '#f9fafb'}; border-bottom:1px solid #f3f4f6">
              <div>
                <div class="font-bold text-g">Room ${e(r.number)}</div>
                <div class="text-xs text-gray-500">${e(r.type)} · ${e(r.floor)} Floor</div>
              </div>
              <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${r.status==='available'?'avail-high':r.status==='pending'?'bg-yellow-100 text-yellow-800':'avail-none'}">
                ${r.status === 'available' ? '✅ Available' : r.status === 'pending' ? '⏳ Pending' : '🔴 Booked'}
              </span>
            </div>

            <div class="p-4">
              <!-- Icon chips -->
              <div class="flex flex-wrap gap-2 mb-3">
                <span class="chip">🛏 ${e(bedIcon(r.type))}</span>
                <span class="chip">🏢 ${e(r.floor)} Floor</span>
                ${r.type === 'Single' ? '<span class="chip">🚿 Private Bath</span>' : ''}
              </div>

              <!-- Price breakdown (Booking.com style) -->
              <div class="bg-gray-50 rounded-lg p-3 mb-3 text-sm">
                <div class="flex justify-between mb-1">
                  <span class="text-gray-500">Per semester</span>
                  <span class="font-bold text-gold">${formatPrice(r.price)}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-400">Confirmation fee (pay now)</span>
                  <span class="font-semibold text-g">${formatPrice(r.confirmationFee || 0)}</span>
                </div>
                <div class="border-t border-gray-200 mt-2 pt-2 flex justify-between text-xs">
                  <span class="text-gray-400">Balance on arrival</span>
                  <span class="font-semibold">${formatPrice(r.price - (r.confirmationFee || 0))}</span>
                </div>
              </div>

              ${isAvail
                ? `<button onclick="App.openBooking(${h.id},${r.id})" class="btn-g w-full text-center">📅 Book This Room</button>`
                : `<div class="w-full bg-gray-100 text-gray-400 py-2 rounded-lg text-sm text-center font-semibold">
                     ${r.status === 'pending' ? '⏳ Awaiting Payment' : '🔴 Not Available'}
                   </div>`}
            </div>
          </div>`;
        }).join('')}
  </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   MY BOOKINGS  (with Shortlist tab)
══════════════════════════════════════════════════════════════════════════ */
export function renderMyBookings() {
  const tab       = state.bookingsTab ?? 'search';
  const shortlist = (state.shortlist ?? []).map(id => hostels.find(h => h.id === id)).filter(Boolean);
  const isStudentLoggedIn = state.userRole === 'student' && !!state.userEmail;
  const studentBookings = isStudentLoggedIn
    ? bookings.filter(b => (b.email || '').toLowerCase() === state.userEmail.toLowerCase())
    : [];

  return `
  <h2 class="text-g text-2xl mb-2">${isStudentLoggedIn ? 'Student Dashboard' : 'My Bookings'}</h2>
  <p class="text-gray-500 text-sm mb-5">${isStudentLoggedIn ? 'Welcome. Track your booking status and hostel details.' : 'Track your reservations and saved hostels.'}</p>

  <!-- Tab switcher -->
  <div class="flex gap-2 mb-5">
    <button class="tab-btn ${tab==='search'    ? 'active' : ''}" onclick="App.setState({ bookingsTab: 'search' })">${isStudentLoggedIn ? '📌 My Booking Status' : '🔍 Lookup Booking'}</button>
    <button class="tab-btn ${tab==='shortlist' ? 'active' : ''}" onclick="App.setState({ bookingsTab: 'shortlist' })">
      ❤️ My Shortlist
      ${shortlist.length ? `<span class="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">${shortlist.length}</span>` : ''}
    </button>
  </div>

  ${tab === 'search' ? `
  ${isStudentLoggedIn ? `
  <div class="bg-white rounded-xl shadow-card p-5 mb-5">
    ${studentBookings.length
      ? `<h3 class="text-g text-lg mb-3">My Bookings (${studentBookings.length})</h3><div class="space-y-3">${studentBookings.map(bookingCardHtml).join('')}</div>`
      : '<p class="text-gray-400 text-sm">No bookings found for your account yet.</p>'}
  </div>
  ` : `
  <!-- Booking Lookup -->
  <div class="bg-white rounded-xl shadow-card p-5 mb-5 max-w-md">
    <label class="lbl">Student Registration Number</label>
    <div class="flex gap-2">
      <input id="regIn" type="text" maxlength="40" placeholder="2026/U/MMU/CCS/STUDENTNUMBER" class="inp flex-1"
             onkeydown="if(event.key==='Enter') App.lookupBooking()"/>
      <button onclick="App.lookupBooking()" class="btn-g">Search</button>
    </div>
    <div class="text-xs text-gray-400 mt-1">Format: YYYY/U/MMU/COURSE/STUDENTNUMBER</div>
  </div>
  <div id="bkResult"></div>

  ${bookings.length ? `
  <h3 class="text-g text-lg mb-3 mt-6">All Bookings (${bookings.length})</h3>
  <div class="space-y-3">${bookings.map(bookingCardHtml).join('')}</div>` : ''}
  `}
  ` : ''}

  ${tab === 'shortlist' ? `
  <!-- Shortlist / Wishlist -->
  ${shortlist.length === 0 ? `
    <div class="bg-white rounded-xl shadow-card p-10 text-center">
      <div class="text-5xl mb-3">🤍</div>
      <div class="font-bold text-g text-lg mb-1">Your shortlist is empty</div>
      <p class="text-gray-400 text-sm mb-4">Tap the ❤️ heart on any hostel card to save it here.</p>
      <button onclick="App.go('hostels')" class="btn-g">Browse Hostels</button>
    </div>
  ` : `
    <div class="grid md:grid-cols-3 gap-4">
      ${shortlist.map(h => {
        const s = roomStats(h);
        return `
        <div class="bg-white rounded-xl shadow-card overflow-hidden">
          ${hostelCoverHtml(h)}
          <div class="p-4">
            <div class="flex items-start justify-between mb-1">
              <div class="font-bold text-g">${e(h.name)}</div>
              ${h.rating ? starRatingHtml(h.rating, false) : ''}
            </div>
            <div class="text-xs text-gray-400 mb-2">📍 ${e(h.distance)}</div>
            <div class="mb-3">${availabilityBadgeHtml(s.a)}</div>
            <div class="flex gap-2">
              <button onclick="App.go('hostelDetail', { selH: ${h.id}, fType: 'All' })" class="btn-g flex-1 text-sm">View Rooms</button>
              <button onclick="App.toggleShortlist(${h.id})" class="btn-heart saved text-xl" title="Remove from shortlist">❤️</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `}
  ` : ''}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   STUDENT DASHBOARD
══════════════════════════════════════════════════════════════════════════ */
export function renderStudentDashboard() {
  if (state.userRole !== 'student') {
    return '<div class="text-center py-10 text-gray-400">Student dashboard is available after student login.</div>';
  }

  const mine = bookings
    .filter(b => (b.email || '').toLowerCase() === (state.userEmail || '').toLowerCase())
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const latest = mine[0] || null;
  const hostel = latest ? getHostel(latest.hostelId) : null;
  const room = latest && hostel ? (hostel.rooms || []).find(r => r.id === latest.roomId) : null;

  const pendingCount = mine.filter(b => b.status === 'pending').length;
  const confirmedCount = mine.filter(b => b.status === 'confirmed').length;

  // Financial calculations
  let totalBilled = 0;
  let totalPaid = 0;
  const financeLedger = mine.map(b => {
    const h = getHostel(b.hostelId);
    const r = h?.rooms.find(rx => rx.id === b.roomId);
    if (!r) return null;
    
    const price = Number(r.price || 0);
    const fee = Number(r.confirmationFee || 0);
    const paid = (b.status === 'confirmed') ? fee : 0;
    const balance = price - paid;
    
    totalBilled += price;
    totalPaid += paid;
    
    return {
      id: b.id,
      hostelName: h.name,
      roomNumber: r.number,
      price,
      paid,
      balance,
      status: b.status,
      date: b.date
    };
  }).filter(Boolean);
  const totalBalanceDue = totalBilled - totalPaid;

  return `
  <div class="flex items-center justify-between mb-5 flex-wrap gap-2">
    <div>
      <h2 class="text-g text-2xl">Student Dashboard</h2>
      <p class="text-gray-500 text-sm">Welcome ${e(state.adminUser || 'Student')}. Track your booking status and hostel details.</p>
    </div>
    <div class="flex gap-2">
      <button onclick="App.go('profile')" class="btn-out text-sm">👤 My Profile</button>
      <button onclick="App.go('hostels')" class="btn-g">Browse Hostels</button>
    </div>
  </div>

  <!-- Booking Quick Stats -->
  <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
    <div class="bg-white rounded-xl shadow-card p-4">
      <div class="text-xs text-gray-500">Total Bookings</div>
      <div class="text-2xl font-bold text-g">${mine.length}</div>
    </div>
    <div class="bg-white rounded-xl shadow-card p-4">
      <div class="text-xs text-gray-500">Pending</div>
      <div class="text-2xl font-bold text-yellow-600">${pendingCount}</div>
    </div>
    <div class="bg-white rounded-xl shadow-card p-4">
      <div class="text-xs text-gray-500">Confirmed</div>
      <div class="text-2xl font-bold text-green-700">${confirmedCount}</div>
    </div>
  </div>

  <!-- Financial Overview -->
  <div class="mb-6">
    <h3 class="text-g text-lg mb-3 flex items-center gap-2">💰 My Finances</h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white rounded-xl shadow-card p-4 border-l-4 border-gray-400">
        <div class="text-xs text-gray-500 mb-1">Total Billed</div>
        <div class="text-xl font-bold text-gray-700">${formatPrice(totalBilled)}</div>
        <div class="text-[10px] text-gray-400 mt-1">Total cost of all bookings</div>
      </div>
      <div class="bg-white rounded-xl shadow-card p-4 border-l-4 border-yellow-500">
        <div class="text-xs text-gray-500 mb-1">Total Paid (Fees)</div>
        <div class="text-xl font-bold text-yellow-600">${formatPrice(totalPaid)}</div>
        <div class="text-[10px] text-gray-400 mt-1">Confirmed confirmation fees</div>
      </div>
      <div class="bg-white rounded-xl shadow-card p-4 border-l-4 border-blue-600">
        <div class="text-xs text-gray-500 mb-1">Balance Due on Arrival</div>
        <div class="text-xl font-bold text-blue-700">${formatPrice(totalBalanceDue)}</div>
        <div class="text-[10px] text-gray-400 mt-1">To be cleared at the hostel</div>
      </div>
    </div>
  </div>

  <div class="grid md:grid-cols-2 gap-6 mb-6">
    <!-- Latest Booking -->
    <div class="bg-white rounded-xl shadow-card p-5">
      <h3 class="text-g text-lg mb-3">Latest Booking</h3>
      ${latest ? `
        <div class="grid md:grid-cols-2 gap-3 text-sm">
          <div><span class="text-gray-500">Reference:</span> <b>#${e(latest.id)}</b></div>
          <div><span class="text-gray-500">Status:</span> <b class="${latest.status==='confirmed'?'text-green-700':'text-yellow-700'}">${e(latest.status)}</b></div>
          <div><span class="text-gray-500">Hostel:</span> <b>${e(hostel?.name || '—')}</b></div>
          <div><span class="text-gray-500">Room:</span> <b>${e(room?.number || '—')} ${room?.type ? `(${e(room.type)})` : ''}</b></div>
          <div><span class="text-gray-500">Date:</span> <b>${e(latest.date || '—')}</b></div>
          <div><span class="text-gray-500">Course:</span> <b>${e(latest.course || '—')}</b></div>
        </div>
        ${hostel ? `<div class="mt-4"><button class="btn-g w-full" onclick="App.go('hostelDetail', { selH: ${hostel.id}, fType: 'All' })">View Hostel Details</button></div>` : ''}
      ` : '<p class="text-gray-400 text-sm">No booking found for your account yet.</p>'}
    </div>

    <!-- Payment Ledger -->
    <div class="bg-white rounded-xl shadow-card p-5">
      <h3 class="text-g text-lg mb-3">Payment Ledger</h3>
      ${financeLedger.length ? `
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-gray-50 text-gray-500 uppercase font-semibold">
              <tr>
                <th class="px-2 py-2">Hostel / Room</th>
                <th class="px-2 py-2 text-right">Billed</th>
                <th class="px-2 py-2 text-right">Paid</th>
                <th class="px-2 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${financeLedger.map(l => `
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-2 py-2">
                    <div class="font-bold text-g">${e(l.hostelName)}</div>
                    <div class="text-gray-400">#${e(l.roomNumber)} · ${e(l.id)}</div>
                  </td>
                  <td class="px-2 py-2 text-right font-semibold">${formatPrice(l.price)}</td>
                  <td class="px-2 py-2 text-right text-yellow-600 font-bold">${formatPrice(l.paid)}</td>
                  <td class="px-2 py-2 text-right text-blue-700 font-bold">${formatPrice(l.balance)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p class="text-gray-400 text-sm text-center py-4">No financial records yet.</p>'}
    </div>
  </div>

  <div class="bg-white rounded-xl shadow-card p-5">
    <h3 class="text-g text-lg mb-3">My Booking History</h3>
    ${mine.length ? `<div class="space-y-3">${mine.map(bookingCardHtml).join('')}</div>` : '<p class="text-gray-400 text-sm">No bookings yet.</p>'}
  </div>`;
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

  const isSystemAdmin = state.userRole === 'admin';
  const perms = state.userPermissions || {};
  const can = (p) => isSystemAdmin || !!perms[p] || !!perms.system_admin;
  const visibleHostels = isSystemAdmin
    ? hostels
    : hostels.filter(h => Number(h.owner_id) === Number(state.userId));
  const visibleBookings = isSystemAdmin
    ? bookings
    : bookings.filter(b => visibleHostels.some(h => Number(h.id) === Number(b.hostelId)));
  const s = {
    t: visibleHostels.reduce((n, h) => n + (h.rooms?.length || 0), 0),
    a: visibleHostels.reduce((n, h) => n + ((h.rooms || []).filter(r => r.status === 'available').length), 0),
    b: visibleHostels.reduce((n, h) => n + ((h.rooms || []).filter(r => r.status === 'booked' || r.status === 'pending').length), 0),
  };
  const tab = state.adminTab ?? 'hostels';
  const who = state.adminUser || state.userRole || 'admin';
  if (tab === 'managers' && state.adminMode && !state.managersLoaded && !state.managersLoading) {
    setTimeout(() => window.App?.ensureManagersLoaded?.(), 0);
  }
  if (tab === 'hostels' && state.adminMode && !state.managersLoaded && !state.managersLoading) {
    setTimeout(() => window.App?.ensureManagersLoaded?.(), 0);
  }
  if (tab === 'roles' && state.adminMode && !state.rolesLoaded && !state.rolesLoading) {
    setTimeout(() => window.App?.ensureRolesLoaded?.(), 0);
  }
  if (tab === 'permissions' && state.adminMode && !state.permissionsLoaded && !state.permissionsLoading) {
    setTimeout(() => window.App?.ensurePermissionsLoaded?.(), 0);
  }
  if (tab === 'users' && state.adminMode && !state.usersLoaded && !state.usersLoading) {
    setTimeout(() => window.App?.ensureUsersLoaded?.(), 0);
    setTimeout(() => window.App?.ensureRolesLoaded?.(), 0);
    setTimeout(() => window.App?.ensurePermissionsLoaded?.(), 0);
  }
  if (tab === 'students' && state.adminMode && !state.usersLoaded && !state.usersLoading) {
    setTimeout(() => window.App?.ensureUsersLoaded?.(), 0);
  }

  return `
  <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
    <div>
      <h2 class="text-g text-2xl">Admin Panel</h2>
      <div class="text-xs text-gray-500">Logged in as <b>${e(who)}</b> · Session active</div>
    </div>
    <div class="flex gap-2">
      ${state.adminMode && isSystemAdmin ? `<button onclick="App.openModal('addManager', {})" class="btn-out text-sm">+ Add Manager</button>` : ''}
      ${can('create_hostel') ? `<button onclick="App.requireAdmin() && App.openModal('addHostel', {})" class="btn-g">+ Add Hostel</button>` : ''}
    </div>
  </div>

  <!-- Tab switcher -->
  <div class="flex flex-wrap gap-2 mb-6">
    <button class="tab-btn ${tab==='hostels'  ? 'active' : ''}" onclick="App.setState({ adminTab: 'hostels' })">🏢 Hostels</button>
    <button class="tab-btn ${tab==='bookings' ? 'active' : ''}" onclick="App.setState({ adminTab: 'bookings' })">📅 Bookings</button>
    ${state.adminMode && isSystemAdmin ? `<button class="tab-btn ${tab==='managers' ? 'active' : ''}" onclick="App.setState({ adminTab: 'managers' }); App.ensureManagersLoaded();">👥 Managers</button>` : ''}
    ${state.adminMode && isSystemAdmin ? `<button class="tab-btn ${tab==='roles' ? 'active' : ''}" onclick="App.setState({ adminTab: 'roles' }); App.ensureRolesLoaded();">🪪 Roles</button>` : ''}
    ${state.adminMode && isSystemAdmin ? `<button class="tab-btn ${tab==='permissions' ? 'active' : ''}" onclick="App.setState({ adminTab: 'permissions' }); App.ensurePermissionsLoaded();">🛡 Permissions</button>` : ''}
    ${state.adminMode && isSystemAdmin ? `<button class="tab-btn ${tab==='users' ? 'active' : ''}" onclick="App.setState({ adminTab: 'users' }); App.ensureUsersLoaded();">👤 Users</button>` : ''}
    ${(isSystemAdmin || can('view_users') || can('manage_users')) ? `<button class="tab-btn ${tab==='students' ? 'active' : ''}" onclick="App.setState({ adminTab: 'students' }); App.ensureUsersLoaded();">🎓 Students</button>` : ''}
    ${!isSystemAdmin ? `<button class="tab-btn ${tab==='finances' ? 'active' : ''}" onclick="App.setState({ adminTab: 'finances' })">💰 Finances</button>` : ''}
    ${isSystemAdmin ? `<button class="tab-btn" onclick="App.openModal('addManager', {})">➕ Add Users</button>` : ''}
    ${isSystemAdmin ? `<button class="tab-btn ${tab==='settings' ? 'active' : ''}" onclick="App.setState({ adminTab: 'settings' })">⚙️ Settings</button>` : ''}
    ${isSystemAdmin ? `<button class="tab-btn" onclick="App.go('security')">🔐 Security</button>` : ''}
  </div>

  ${tab === 'hostels' ? `
  <!-- Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    ${[['Hostels',visibleHostels.length,'🏢'],['Total Rooms',s.t,'🚪'],['Available',s.a,'✅'],['Booked',s.b,'🔴']].map(([l,v,ic])=>
      `<div class="bg-white rounded-xl shadow-card p-4 text-center" style="border-top:3px solid var(--gold)">
        <div class="text-2xl mb-1">${ic}</div>
        <div class="text-2xl font-bold text-g">${v}</div>
        <div class="text-xs text-gray-500">${l}</div>
      </div>`).join('')}
  </div>

  <!-- Hostels Table -->
  <div class="space-y-4 mb-6">
    ${visibleHostels.length === 0 ? '<div class="text-center py-10 text-gray-400 bg-white rounded-xl shadow-card">No hostels assigned to you yet.</div>' : ''}
    ${visibleHostels.map(h => {
      const hs = roomStats(h);
      const isExpanded = (state.expandedHostels || []).includes(h.id);
      return `
      <div class="bg-white rounded-xl shadow-card overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b flex-wrap gap-3 hostel-header-clickable ${isExpanded ? '' : 'border-b-0'}" 
             style="background:${e(h.color)}10"
             onclick="App.toggleHostelExpand(${h.id})">
          <div class="flex items-center gap-3">
            <span class="chevron-toggle ${isExpanded ? 'expanded' : ''}">▼</span>
            ${hostelThumbnailHtml(h)}
            <div>
              <div class="font-bold text-g">${e(h.name)}</div>
              <div class="text-xs text-gray-500">${e(h.distance)} · ${e(h.gender)}</div>
              ${h.location?.address ? `<div class="text-xs text-gray-400">📍 ${e(h.location.address.slice(0,45))}</div>` : ''}
              <div class="flex items-center gap-2 mt-1" onclick="event.stopPropagation()">
                ${h.rating ? starRatingHtml(h.rating, true) : '<span class="text-xs text-gray-400">No rating</span>'}
                <input type="number" min="0" max="5" step="0.1"
                       value="${h.rating ?? ''}"
                       placeholder="0–5"
                       style="width:4rem;padding:.15rem .4rem;font-size:.7rem;border:1px solid #d1d5db;border-radius:.4rem;"
                       onchange="App.requireAdmin() && App.setRating(${h.id}, +this.value)"
                       title="Set rating (0–5)"/>
              </div>
            </div>
          </div>
          <div class="action-row" onclick="event.stopPropagation()">
            ${isSystemAdmin ? `
              <select id="hostelOwner_${h.id}" class="inp" style="max-width:12rem;padding:.25rem .4rem;font-size:.75rem;">
                <option value="">Assign manager</option>
                ${(state.managers || [])
                  .filter(m => m.status === 'active')
                  .map(m => `<option value="${m.id}"${Number(h.owner_id)===Number(m.id)?' selected':''}>${e(m.name)}</option>`)
                  .join('')}
              </select>
              <button onclick="App.requireAdmin() && App.doAssignHostelManager(${h.id})" class="btn-out btn-sm" style="border-color:#0f766e;color:#0f766e">Assign</button>
            ` : ''}
            <span class="badge-ok  text-xs px-2 py-0.5 rounded-full font-semibold">${hs.a} avail</span>
            <span class="badge-err text-xs px-2 py-0.5 rounded-full font-semibold">${hs.b} booked</span>
            <button onclick="App.requireAdmin() && App.openModal('viewHostel',  { hostelId:${h.id} })" class="btn-out btn-sm">👁 View</button>
            ${can('edit_hostel') ? `<button onclick="App.requireAdmin() && App.openModal('editHostel',  { hostelId:${h.id} })" class="btn-out btn-sm" style="border-color:var(--g);color:var(--g)">✏️ Edit</button>` : ''}
            ${can('create_room') || can('manage_rooms') ? `<button onclick="App.requireAdmin() && App.openModal('addRoom',     { hostelId:${h.id} })" class="btn-out btn-sm" style="border-color:#2563eb;color:#2563eb">+ Room</button>` : ''}
            ${can('delete_hostel') ? `<button onclick="App.requireAdmin() && App.openModal('delHostelConf',{ hostelId:${h.id} })" class="btn-red btn-sm">🗑 Delete</button>` : ''}
          </div>
        </div>
        <div class="hostel-accordion-content ${isExpanded ? 'expanded' : ''}">
          <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="tbl-hd"><tr>
              <th>Room</th><th>Type</th><th>Floor</th><th>Price/Sem</th><th>Conf. Fee</th>
              <th>Status</th><th>Booked By</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${h.rooms.map(r => `
              <tr class="tbl-row">
                <td class="font-semibold">${e(r.number)}</td>
                <td>${e(r.type)}</td>
                <td>${e(r.floor)}</td>
                <td class="font-semibold text-gold">${formatPrice(r.price)}</td>
                <td class="text-xs text-g font-semibold">${formatPrice(r.confirmationFee || 0)}</td>
                <td><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${r.status==='available'?'badge-ok':r.status==='pending'?'bg-yellow-100 text-yellow-800':'badge-err'}">${r.status}</span></td>
                <td class="text-xs text-gray-500">${e(r.bookedBy||'—')}</td>
                <td>
                  <div class="action-row">
                    ${(can('edit_room') || can('manage_rooms')) ? `<button onclick="App.requireAdmin() && App.openModal('editRoom', { hostelId:${h.id}, roomId:${r.id} })" class="text-xs text-g font-semibold hover:underline">✏️ Edit</button>` : ''}
                    ${r.status === 'booked' || r.status === 'pending'
                      ? ((can('release_room') || can('manage_rooms')) ? `<button onclick="App.requireAdmin() && App.releaseRoom(${h.id},${r.id})" class="text-xs text-blue-600 font-semibold hover:underline">↩ Release</button>` : '')
                      : ((can('delete_room') || can('manage_rooms')) ? `<button onclick="App.requireAdmin() && App.openModal('delRoomConf', { hostelId:${h.id}, roomId:${r.id} })" class="text-xs text-red-500 font-semibold hover:underline">🗑 Del</button>` : '')}
                    ${r.status === 'pending'
                      ? ((can('confirm_room_payment') || can('manage_bookings')) ? `<button onclick="App.requireAdmin() && App.confirmRoomPayment(${h.id},${r.id})" class="text-xs text-green-600 font-semibold hover:underline">✅ Confirm Pay</button>` : '')
                      : ''}
                  </div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
    }).join('')}
  </div>
  ` : ''}

  <!-- Bookings Tab -->
  ${tab === 'bookings' && (isSystemAdmin || can('view_bookings')) ? `
  <div class="bg-white rounded-xl shadow-card p-5">
    <h3 class="text-g text-lg mb-3">All Bookings (${visibleBookings.length})</h3>
    ${visibleBookings.length ? `
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="tbl-hd"><tr>
          <th>Ref</th><th>Student</th><th>Reg No</th><th>Course</th>
          <th>Hostel / Room</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${visibleBookings.map(b => {
            const bh = getHostel(b.hostelId);
            const br = bh?.rooms.find(r => r.id === b.roomId);
            return `<tr class="tbl-row">
              <td class="font-mono text-xs text-gray-400">#${e(b.id)}</td>
              <td class="font-semibold">${e(b.studentName)}</td>
              <td class="text-gray-500">${e(b.regNo)}</td>
              <td class="text-xs text-gray-500">${e(b.course)}</td>
              <td class="text-xs">${e(bh?.name??'?')} / ${e(br?.number??'?')}</td>
              <td class="font-semibold text-gold text-xs">${br ? formatPrice(br.price) : '?'}</td>
              <td><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${b.status==='confirmed'?'badge-ok':'badge-warn'}">${b.status}</span></td>
              <td class="text-xs text-gray-400">${e(b.date)}</td>
              <td>
                ${b.status === 'confirmed' && b.email && (isSystemAdmin || can('manage_bookings') || can('confirm_room_payment'))
                  ? `<button onclick="App.requireAdmin() && App.resendStudentCredentials('${e(b.id)}')" class="text-xs text-blue-600 font-semibold hover:underline">✉ Resend Credentials</button>`
                  : '<span class="text-xs text-gray-300">—</span>'}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '<p class="text-gray-400 text-sm text-center py-4">No bookings yet.</p>'}
  </div>
  ` : ''}

  <!-- Finances Tab -->
  <!-- Finances Tab -->
  ${(tab === 'finances' && !isSystemAdmin) ? (() => {
    // Calculate global metrics
    let totalPotential = 0, collectedFees = 0, expectedBalance = 0;
    const roomDetails = [];
    
    const hostelData = visibleHostels.map(h => {
      let hPot = 0, hCol = 0, hBal = 0;
      h.rooms.forEach(r => {
        const price = Number(r.price || 0);
        const fee = Number(r.confirmationFee || 0);
        hPot += price;

        // Find associated booking for credentials
        const b = visibleBookings.find(bx => Number(bx.hostelId) === Number(h.id) && Number(bx.roomId) === Number(r.id));
        
        let earnings = 0;
        let balance = price;
        
        if (r.status === 'booked') {
          earnings = fee;
          balance = price - fee;
          hCol += fee;
          hBal += balance;
        } else if (r.status === 'pending') {
          hBal += price;
        }

        if (r.status !== 'available') {
            roomDetails.push({
                hostelName: h.name,
                roomNumber: r.number,
                studentName: b?.studentName || r.bookedBy || 'Unknown',
                regNo: b?.regNo || r.regNo || '—',
                course: b?.course || '—',
                email: b?.email || '—',
                phone: b?.phone || '—',
                year: b?.year || '—',
                semester: b?.semester || '—',
                price,
                earnings,
                balance,
                status: r.status
            });
        }
      });
      totalPotential += hPot;
      collectedFees += hCol;
      expectedBalance += hBal;
      
      return { 
        id: h.id, 
        name: h.name, 
        roomsCount: h.rooms.length, 
        pot: hPot, 
        col: hCol, 
        bal: hBal,
        expected: hCol + hBal
      };
    });

    const expectedTotal = collectedFees + expectedBalance;

    return `
    <div class="mb-6 space-y-6">
      <div>
        <div class="text-g text-xl mb-4">Financial Overview</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          ${[['Maximum Potential', totalPotential, 'text-gray-500'], ['Total Expected', expectedTotal, 'text-g'], ['Collected Fees', collectedFees, 'text-yellow-600'], ['Balance Due', expectedBalance, 'text-blue-600']].map(([l, v, c]) => `
            <div class="bg-white rounded-xl shadow-card p-4">
              <div class="text-xs text-gray-500 mb-1">${l}</div>
              <div class="text-xl font-bold ${c}">${formatPrice(v)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-card p-5">
        <h3 class="text-g text-lg mb-3">Hostel Summary</h3>
        ${hostelData.length === 0 ? '<p class="text-gray-400 text-sm">No hostels to display.</p>' : `
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="tbl-hd">
              <tr><th>Hostel</th><th>Rooms</th><th>Potential</th><th>Collected</th><th>Balance</th><th>Total Expected</th></tr>
            </thead>
            <tbody>
              ${hostelData.map(d => `
                <tr class="tbl-row">
                  <td class="font-semibold text-g">${e(d.name)}</td>
                  <td>${d.roomsCount}</td>
                  <td class="text-gray-500 text-sm">${formatPrice(d.pot)}</td>
                  <td class="text-yellow-600 font-semibold text-sm">${formatPrice(d.col)}</td>
                  <td class="text-blue-600 text-sm">${formatPrice(d.bal)}</td>
                  <td class="text-g font-bold text-sm bg-gray-50">${formatPrice(d.expected)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        `}
      </div>

      <div class="bg-white rounded-xl shadow-card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-g text-lg">Detailed Room & Occupant Ledger</h3>
          <div class="text-xs text-gray-400 font-mono capitalize">Detailed Revenue Breakdown</div>
        </div>
        ${roomDetails.length === 0 ? '<p class="text-gray-400 text-sm text-center py-8">No occupied rooms found yet.</p>' : `
        <div class="overflow-x-auto">
          <table class="w-full" style="min-width: 1000px;">
            <thead class="tbl-hd">
              <tr>
                <th>Room</th>
                <th>Occupant</th>
                <th>Credentials</th>
                <th>Course / Year</th>
                <th>Total Price</th>
                <th>Collected</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${roomDetails.map(d => `
                <tr class="tbl-row text-xs">
                  <td>
                    <div class="font-bold text-g">${e(d.roomNumber)}</div>
                    <div class="text-[10px] text-gray-400">${e(d.hostelName)}</div>
                  </td>
                  <td>
                    <div class="font-semibold">${e(d.studentName)}</div>
                    <div class="text-[10px] text-gray-500">${e(d.regNo)}</div>
                  </td>
                  <td>
                    <div class="mb-1">📧 ${e(d.email)}</div>
                    <div>📞 ${e(d.phone)}</div>
                  </td>
                  <td>
                    <div class="font-semibold">${e(d.course)}</div>
                    <div class="text-gray-400">Year ${e(d.year)} · Sem ${e(d.semester)}</div>
                  </td>
                  <td>${formatPrice(d.price)}</td>
                  <td class="text-yellow-600 font-bold">${formatPrice(d.earnings)}</td>
                  <td class="text-blue-700 font-bold">${formatPrice(d.balance)}</td>
                  <td>
                    <span class="px-2 py-0.5 rounded-full font-bold uppercase ${d.status==='booked'?'badge-ok':'bg-yellow-100 text-yellow-800'}" style="font-size: 9px;">
                      ${e(d.status)}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        `}
      </div>
    </div>
    `;
  })() : ''}

  <!-- Managers Tab -->
  ${tab === 'managers' && state.adminMode ? `
  <div class="bg-white rounded-xl shadow-card p-5">
    <div class="flex items-center justify-between mb-4">
        <h3 class="text-g text-lg">System Managers (Hostel Owners)</h3>
        <button onclick="App.openModal('addManager')" class="btn-g btn-sm">+ Add New Manager</button>
    </div>
    <div id="managersList" class="min-h-[200px]">
      ${state.managersLoading ? '<p class="text-center py-12 text-gray-400">Loading managers...</p>' : ''}
      ${!state.managersLoading && state.managers.length === 0 ? '<p class="text-center py-8 text-gray-400">No managers found.</p>' : ''}
      ${!state.managersLoading && state.managers.length > 0 ? `
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="tbl-hd">
              <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Assigned Hostels</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${state.managers.map(u => {
                const badge = u.status === 'active' ? 'badge-ok' : 'badge-warn';
                const suspendClr = u.status === 'active' ? 'text-yellow-600' : 'text-green-600';
                const suspendTxt = u.status === 'active' ? '⏸ Suspend' : '▶ Activate';
                const nextSt = u.status === 'active' ? 'suspended' : 'active';
                const p = u.permissions || {};
                const pKeys = Object.keys(p).filter(k => p[k]);
                const pTxt = pKeys.length ? pKeys.slice(0,2).join(', ') + (pKeys.length > 2 ? ` +${pKeys.length - 2} more` : '') : 'none';
                const assignedHostels = (hostels || []).filter(h => Number(h.owner_id) === Number(u.id));
                const hostelNames = assignedHostels.length ? assignedHostels.map(h => e(h.name)).join(', ') : '<span class="text-gray-300">None</span>';
                return `<tr class="tbl-row">
                  <td class="font-semibold">${e(u.name)}</td>
                  <td class="text-xs text-gray-500">${e(u.email)}</td>
                  <td class="text-xs text-gray-500">${e(u.phone || '—')}</td>
                  <td class="text-xs text-gray-500">${e(u.role_name || '—')}</td>
                  <td class="text-xs text-gray-500">${hostelNames}</td>
                  <td><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${badge}">${e(u.status)}</span></td>
                  <td>
                    <div class="action-row">
                      <button onclick="App.openModal('editManager', { managerId: ${u.id} })" class="text-xs text-g font-semibold hover:underline">✏️ Edit</button>
                      <button onclick="App.doUpdateUserStatus(${u.id}, '${nextSt}')" class="text-xs font-semibold ${suspendClr} hover:underline">${suspendTxt}</button>
                      <button onclick="App.openModal('delManagerConf', { managerId: ${u.id} })" class="text-xs text-red-500 font-semibold hover:underline">🗑 Delete</button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : ''}
    </div>
  </div>
  ` : ''}

  ${tab === 'roles' && state.adminMode ? `
  <div class="bg-white rounded-xl shadow-card p-5 mb-6">
    <h3 class="text-g text-lg mb-3">Roles</h3>
    <div class="flex gap-2 mb-4">
      <input id="roleName" class="inp" placeholder="Role name (e.g. hostel_manager)" maxlength="50"/>
      <button class="btn-g" onclick="App.doAddRole()">Add Role</button>
    </div>
    ${state.rolesLoading ? '<p class="text-gray-400 text-sm">Loading roles...</p>' : ''}
    ${!state.rolesLoading && state.roles.length === 0 ? '<p class="text-gray-400 text-sm">No roles yet.</p>' : ''}
    ${!state.rolesLoading && state.roles.length > 0 ? `
      <div class="overflow-x-auto">
        <table class="w-full"><thead class="tbl-hd"><tr><th>ID</th><th>Name</th></tr></thead>
          <tbody>${state.roles.map(r => `<tr class="tbl-row"><td>${r.id}</td><td>${e(r.name)}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : ''}
  </div>
  ` : ''}

  ${tab === 'permissions' && state.adminMode ? `
  <div class="bg-white rounded-xl shadow-card p-5 mb-6">
    <h3 class="text-g text-lg mb-3">Permissions</h3>
    <div class="flex gap-2 mb-4 flex-wrap">
      <input id="permName" class="inp" placeholder="Permission name (e.g. manage_rooms)" maxlength="50"/>
      <button class="btn-g" onclick="App.doAddPermission()">Add Permission</button>
      <button class="btn-out" onclick="App.doSeedPermissions()">Seed Default Permissions</button>
    </div>
    ${state.permissionsLoading ? '<p class="text-gray-400 text-sm">Loading permissions...</p>' : ''}
    ${!state.permissionsLoading && state.permissions.length === 0 ? '<p class="text-gray-400 text-sm">No permissions yet.</p>' : ''}
    ${!state.permissionsLoading && state.permissions.length > 0 ? `
      <div class="overflow-x-auto">
        <table class="w-full"><thead class="tbl-hd"><tr><th>ID</th><th>Name</th></tr></thead>
          <tbody>${state.permissions.map(p => `<tr class="tbl-row"><td>${p.id}</td><td>${e(p.name)}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : ''}
  </div>
  ` : ''}

  ${tab === 'students' && state.adminMode ? `
  <div class="bg-white rounded-xl shadow-card p-5 mb-6">
    <h3 class="text-g text-lg mb-3">Students in Assigned Hostels</h3>
    ${(() => {
      const userMap = new Map((state.users || []).map(u => [Number(u.id), u]));
      const rows = [];
      const seen = new Set();
      for (const b of (visibleBookings || [])) {
        const key = `${b.userId || ''}|${(b.email || '').toLowerCase()}|${b.hostelId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const u = b.userId ? userMap.get(Number(b.userId)) : null;
        const status = u?.status || 'active';
        const nextSt = status === 'active' ? 'suspended' : 'active';
        const bh = getHostel(b.hostelId);
        rows.push(`
          <tr class="tbl-row">
            <td class="font-semibold">${e(b.studentName || u?.name || 'Student')}</td>
            <td class="text-xs text-gray-500">${e(b.email || u?.email || '—')}</td>
            <td class="text-xs text-gray-500">${e(b.regNo || '—')}</td>
            <td class="text-xs text-gray-500">${e(bh?.name || '—')}</td>
            <td><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${status==='active'?'badge-ok':'badge-warn'}">${e(status)}</span></td>
            <td>
              ${b.userId
                ? `<button onclick="App.doUpdateUserStatus(${Number(b.userId)}, '${nextSt}')" class="text-xs font-semibold ${status==='active'?'text-red-500':'text-green-600'} hover:underline">${status==='active'?'Suspend':'Activate'}</button>`
                : '<span class="text-xs text-gray-300">—</span>'}
            </td>
          </tr>
        `);
      }
      return rows.length
        ? `<div class="overflow-x-auto"><table class="w-full"><thead class="tbl-hd"><tr><th>Name</th><th>Email</th><th>Reg No</th><th>Hostel</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
        : '<p class="text-gray-400 text-sm">No students found in your assigned hostels yet.</p>';
    })()}
  </div>
  ` : ''}

  ${tab === 'users' && state.adminMode ? `
  <div class="bg-white rounded-xl shadow-card p-5">
    <h3 class="text-g text-lg mb-3">Assign Roles & Permissions to Users</h3>
    ${state.usersLoading ? '<p class="text-gray-400 text-sm">Loading users...</p>' : ''}
    ${!state.usersLoading && state.users.length === 0 ? '<p class="text-gray-400 text-sm">No users found.</p>' : ''}
    ${!state.usersLoading && state.users.length > 0 ? state.users.map(u => `
      <details class="border rounded-xl p-3 mb-3">
        <summary class="cursor-pointer list-none flex items-center justify-between gap-3">
          <div class="font-semibold">${e(u.name)} <span class="text-xs text-gray-500">(${e(u.email)})</span></div>
          <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${u.status === 'active' ? 'badge-ok' : 'badge-warn'}">${e(u.status)}</span>
        </summary>
        <div class="grid md:grid-cols-3 gap-3 mt-3">
          <div>
            <label class="lbl">User Type</label>
            <select id="uType_${u.id}" class="inp">
              ${['admin','hostel_owner','student'].map(t => `<option value="${t}"${u.role===t?' selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="lbl">Role</label>
            <select id="uRole_${u.id}" class="inp">
              <option value="">No role</option>
              ${(state.roles||[]).map(r => `<option value="${r.id}"${u.role_id===r.id?' selected':''}>${e(r.name)}</option>`).join('')}
            </select>
          </div>
          <div class="flex items-end">
            <button class="btn-g w-full" onclick="App.doAssignUserAccess(${u.id})">Save Access</button>
          </div>
        </div>
        <div class="mt-2 text-xs text-gray-500">Permissions:</div>
        <div class="grid md:grid-cols-3 gap-2 text-sm mt-1">
          ${(state.permissions||[]).map(p => {
            const checked = !!(u.permissions && u.permissions[p.name]);
            return `<label><input type="checkbox" id="uPerm_${u.id}_${p.id}"${checked?' checked':''}> ${e(p.name)}</label>`;
          }).join('')}
        </div>
      </details>
    `).join('') : ''}
  </div>
  ` : ''}

  <!-- Settings Tab -->
  ${tab === 'settings' && isSystemAdmin ? `
  <div class="bg-white rounded-xl shadow-card p-5">
    <h3 class="text-g text-lg mb-4">System Settings</h3>
    
    <div class="max-w-md border rounded-xl p-4 mb-4">
      <h4 class="font-bold text-gray-700 mb-2">Developer Contact Information</h4>
      <p class="text-xs text-gray-500 mb-3">This information will be displayed in the footer of the home page.</p>
      <form onsubmit="App.doUpdateDeveloperContact(event)" class="space-y-3">
        <div>
          <label class="lbl">Contact Details</label>
          <input id="devContact" class="inp" value="${e(state.developerContact || '')}" placeholder="e.g. MMU Tech Team | devSupport@mmu.ac.ug | 0756188401" required />
        </div>
        <button type="submit" class="btn-g w-full">Save Settings</button>
      </form>
    </div>
  </div>
  ` : ''}`;
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

/* ══════════════════════════════════════════════════════════════════════════
   USER PROFILE
══════════════════════════════════════════════════════════════════════════ */
export function renderProfile() {
  const { adminUser, userEmail, userId, userRole } = state;
  const user = (state.users || []).find(u => Number(u.id) === Number(userId)) || { name: adminUser, email: userEmail, phone: '' };

  return `
  <div class="flex items-center gap-3 mb-5 flex-wrap">
    <button onclick="App.go('home')" class="text-g text-sm hover:underline">← Home</button>
    <h2 class="text-g text-2xl">User Profile</h2>
  </div>

  <div class="max-w-2xl mx-auto">
    <div class="bg-white rounded-2xl shadow-card overflow-hidden">
      <div class="bg-g p-8 text-center" style="background: linear-gradient(135deg, var(--g) 0%, #064e3b 100%)">
        <div class="w-24 h-24 rounded-full bg-yellow-400 mx-auto mb-4 flex items-center justify-center text-green-900 text-3xl font-bold shadow-lg border-4 border-white border-opacity-20">
          ${(user.name || 'U').charAt(0).toUpperCase()}
        </div>
        <h3 class="text-white text-xl font-bold">${e(user.name || 'User')}</h3>
        <p class="text-green-100 text-sm opacity-80 uppercase tracking-wider font-semibold">${e(userRole || 'User')}</p>
      </div>

      <div class="p-6 md:p-10">
        <div class="space-y-6">
          <div class="grid md:grid-cols-2 gap-6">
            <div>
              <label class="lbl">Full Name</label>
              <input type="text" id="profName" class="inp" value="${e(user.name || '')}" placeholder="Your full name" maxlength="100" />
            </div>
            <div>
              <label class="lbl">Phone Number</label>
              <input type="tel" id="profPhone" class="inp" value="${e(user.phone || '')}" placeholder="e.g. 0700000000" maxlength="20" />
            </div>
          </div>

          <div>
            <label class="lbl">Email Address</label>
            <input type="email" id="profEmail" class="inp" value="${e(user.email || '')}" placeholder="your@email.com" maxlength="100" />
            <p class="text-xs text-gray-400 mt-1">Used for login and hostle booking notifications.</p>
          </div>

          <div class="pt-6 border-t border-gray-100">
            <h4 class="text-g font-bold mb-4 flex items-center gap-2">
              <span class="text-lg">🔐</span> Security Settings
            </h4>
            <div>
              <label class="lbl">New Password</label>
              <input type="password" id="profPass" class="inp" placeholder="Leave blank to keep current" maxlength="50" />
              <p class="text-xs text-gray-400 mt-2">Update your password only if needed. Use at least 6 characters for better security.</p>
            </div>
          </div>

          <div class="pt-6">
            <button onclick="App.saveProfile()" class="btn-g w-full py-4 text-lg font-bold shadow-hover transition-all flex items-center justify-center gap-2">
              <span>💾</span> Save Profile Changes
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3 items-start">
      <span class="text-xl">💡</span>
      <div class="text-sm text-yellow-800">
        <p class="font-bold mb-1">Privacy Note</p>
        <p>Your particulars are only visible to the university administration and relevant hostel managers when you make a booking.</p>
      </div>
    </div>
  </div>`;
}
