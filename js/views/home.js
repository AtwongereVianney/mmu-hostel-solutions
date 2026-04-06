/**
 * views/home.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: renders ONLY the home page.
 * Booking.com-inspired upgrades:
 *   - Price range slider + semester filter in search bar
 *   - Skeleton loader while data is loading
 *   - Upgraded "How It Works" section with step illustrations
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { state }               from '../state.js';
import { hostels }             from '../state.js';
import { e, allStats, skeletonCardHtml } from '../utils.js';
import { renderHostelCard }    from '../components/hostelCard.js';
import { PRICE_RANGE }         from '../data.js';

export function renderHome() {
  const s = allStats();
  const { fSearch, fGender, fPriceMin, fPriceMax } = state;

  return `
  <!-- Hero Banner -->
  <div class="rounded-2xl overflow-hidden mb-8" style="background:linear-gradient(135deg,#0f3520,#1a5c38 60%,#2d7a4f);min-height:260px;position:relative;">
    <div style="position:absolute;inset:0;opacity:.12;background:radial-gradient(circle at 20% 80%,#f0b429,transparent 50%),radial-gradient(circle at 80% 20%,#c9961a,transparent 50%)"></div>
    <!-- Decorative circles -->
    <div style="position:absolute;bottom:-3rem;right:-3rem;width:12rem;height:12rem;border-radius:50%;background:rgba(255,255,255,.04)"></div>
    <div style="position:absolute;top:-2rem;left:60%;width:8rem;height:8rem;border-radius:50%;background:rgba(255,255,255,.04)"></div>

    <div class="relative p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
      <div class="flex-1">
        <div class="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-2">🏔 Fort Portal, Uganda · MMU Campus</div>
        <h1 class="text-white text-3xl md:text-4xl mb-3">
          Find Your Perfect<br/>
          <span class="text-yellow-400">Student Hostel</span>
        </h1>
        <p class="text-green-200 text-sm mb-5 max-w-md">
          Secure accommodation near Mountains of the Moon University.<br/>
          Instant booking · Mobile money payment · Confirmed in seconds.
        </p>
        <div class="flex gap-3 flex-wrap">
          <button onclick="App.go('hostels')"    class="bg-yellow-400 text-green-900 px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-yellow-300 transition-colors">Browse Hostels →</button>
          <button onclick="App.go('myBookings')" class="border border-white text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-white hover:text-green-900 transition-colors">My Bookings</button>
        </div>
      </div>

      <!-- Live Stats -->
      <div class="grid grid-cols-3 gap-3 flex-shrink-0">
        ${[['Available', s.a, '✅'], ['Hostels', hostels.length, '🏢'], ['Total Rooms', s.t, '🚪']].map(([l, v, ic]) => `
          <div class="text-center bg-white bg-opacity-10 rounded-xl p-4 backdrop-blur-sm">
            <div class="text-2xl mb-1">${ic}</div>
            <div class="text-yellow-400 text-2xl font-bold">${v}</div>
            <div class="text-green-200 text-xs">${l}</div>
          </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Smart Search Bar (Booking.com style) -->
  <div class="bg-white rounded-2xl shadow-card p-5 mb-8">
    <div class="text-g font-bold text-sm mb-3">🔍 Smart Search</div>
    <div class="grid md:grid-cols-4 gap-3 items-end">
      <div class="md:col-span-2">
        <label class="lbl">Search Hostel</label>
        <input class="inp" maxlength="80" placeholder="Hostel name…"
               value="${e(fSearch)}"
               oninput="App.setState({ fSearch: Sec.sanitize(this.value, 80) })"/>
      </div>
      <div>
        <label class="lbl">Gender</label>
        <select class="inp" onchange="App.setState({ fGender: this.value })">
          ${['All','Male','Female','Mixed'].map(g => `<option value="${g}"${fGender===g?' selected':''}>${g}</option>`).join('')}
        </select>
      </div>
      <div>
        <button onclick="App.go('hostels')" class="btn-g w-full">Search →</button>
      </div>
    </div>
    <!-- Price range slider -->
    <div class="mt-4 pt-4 border-t border-gray-100">
      <div class="flex items-center justify-between mb-1">
        <label class="lbl">Max Price per Semester</label>
        <span class="text-xs font-bold text-gold" id="priceDisplay">
          UGX ${Number(fPriceMax).toLocaleString()}
        </span>
      </div>
      <input type="range" class="range-inp"
             min="${PRICE_RANGE.min}" max="${PRICE_RANGE.max}" step="50000"
             value="${fPriceMax}"
             oninput="
               App.setState({ fPriceMax: +this.value });
               document.getElementById('priceDisplay').textContent = 'UGX ' + (+this.value).toLocaleString();
             "/>
      <div class="flex justify-between text-xs text-gray-400 mt-1">
        <span>UGX ${Number(PRICE_RANGE.min).toLocaleString()}</span>
        <span>UGX ${Number(PRICE_RANGE.max).toLocaleString()}</span>
      </div>
    </div>
  </div>

  <!-- Featured Hostels -->
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-g text-2xl">Featured Hostels</h2>
    <button onclick="App.go('hostels')" class="text-sm text-g font-semibold hover:underline">View all →</button>
  </div>

  <div class="grid md:grid-cols-3 gap-5 mb-8">
    ${state.loading
      ? [1,2,3].map(skeletonCardHtml).join('')
      : hostels.slice(0, 3).map(renderHostelCard).join('')}
  </div>

  <!-- How It Works (Booking.com style) -->
  <div class="bg-white rounded-2xl shadow-card p-6 mb-6">
    <h2 class="text-g text-xl mb-6 text-center">How It Works</h2>
    <div class="grid md:grid-cols-4 gap-4 relative">
      <!-- Connector line on desktop -->
      <div class="hidden md:block absolute top-6 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-transparent via-green-200 to-transparent" style="z-index:0"></div>
      ${[
        { icon: '🔍', step: '01', title: 'Browse Hostels',   desc: 'Explore available hostels with live availability, photos, and amenities.', color: '#f0fdf4' },
        { icon: '🛏',  step: '02', title: 'Choose Your Room', desc: 'Select room type (Single, Double, Triple) and view price breakdown.',      color: '#fdf9f0' },
        { icon: '📝',  step: '03', title: 'Fill Details',     desc: 'Enter your student registration number and contact information.',           color: '#f0fdf4' },
        { icon: '💳',  step: '04', title: 'Pay & Confirm',    desc: 'Pay the confirmation fee via mobile money. Get instant booking reference.', color: '#fef3c7' },
      ].map(({ icon, step, title, desc, color }) => `
        <div class="text-center p-4 rounded-xl relative" style="background:${color};z-index:1">
          <div class="text-xs font-bold text-gray-400 mb-2">STEP ${step}</div>
          <div class="w-14 h-14 rounded-full bg-white shadow flex items-center justify-center text-2xl mx-auto mb-3 shadow-card">${icon}</div>
          <div class="font-bold text-sm text-g mb-2">${title}</div>
          <div class="text-gray-500 text-xs leading-relaxed">${desc}</div>
        </div>`).join('')}
    </div>
  </div>

  <!-- Trust Signals (Booking.com style footer strip) -->
  <div class="grid md:grid-cols-3 gap-4">
    ${[
      { icon: '🔒', title: 'Secure Payments',    desc: 'Flutterwave-powered · AES-256 encrypted data storage' },
      { icon: '⚡', title: 'Instant Booking',     desc: 'Room locked during payment · Confirmed in seconds' },
      { icon: '📞', title: '24/7 Campus Support', desc: 'Hostel warden always available · Walk-in welcome' },
    ].map(t => `
      <div class="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-xl flex-shrink-0">${t.icon}</div>
        <div>
          <div class="font-bold text-sm text-g">${t.title}</div>
          <div class="text-xs text-gray-400">${t.desc}</div>
        </div>
      </div>`).join('')}
  </div>`;
}
