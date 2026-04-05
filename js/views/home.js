/**
 * views/home.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: renders ONLY the home page.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { state }               from '../state.js';
import { hostels }             from '../state.js';
import { e, allStats }         from '../utils.js';
import { renderHostelCard }    from '../components/hostelCard.js';

export function renderHome() {
  const s = allStats();
  const { fSearch, fGender } = state;

  return `
  <!-- Hero Banner -->
  <div class="rounded-2xl overflow-hidden mb-8" style="background:linear-gradient(135deg,#0f3520,#1a5c38 60%,#2d7a4f);min-height:240px;position:relative;">
    <div style="position:absolute;inset:0;opacity:.1;background:radial-gradient(circle at 20% 80%,#f0b429,transparent 50%),radial-gradient(circle at 80% 20%,#c9961a,transparent 50%)"></div>
    <div class="relative p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
      <div class="flex-1">
        <div class="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-2">Welcome · Fort Portal, Uganda</div>
        <h1 class="text-white text-3xl md:text-4xl mb-3">
          Find Your Perfect<br/>
          <span class="text-yellow-400">Student Hostel</span>
        </h1>
        <p class="text-green-200 text-sm mb-5 max-w-md">
          Affordable, comfortable accommodation near Mountains of the Moon University campus.
        </p>
        <div class="flex gap-3 flex-wrap">
          <button onclick="App.go('hostels')"    class="bg-yellow-400 text-green-900 px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-yellow-300">Browse Hostels</button>
          <button onclick="App.go('myBookings')" class="border border-white text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-white hover:text-green-900">My Bookings</button>
        </div>
      </div>
      <!-- Stats -->
      <div class="grid grid-cols-3 gap-3 flex-shrink-0">
        ${[['Available', s.a, '✅'], ['Hostels', hostels.length, '🏢'], ['Total Rooms', s.t, '🚪']].map(([l, v, ic]) => `
          <div class="text-center bg-white bg-opacity-10 rounded-xl p-4">
            <div class="text-2xl mb-1">${ic}</div>
            <div class="text-yellow-400 text-2xl font-bold">${v}</div>
            <div class="text-green-200 text-xs">${l}</div>
          </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Quick Search Bar -->
  <div class="bg-white rounded-xl shadow-card p-5 mb-8 flex flex-col md:flex-row gap-3 items-end">
    <div class="flex-1">
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
    <button onclick="App.go('hostels')" class="btn-g">Search</button>
  </div>

  <!-- Featured Hostels -->
  <h2 class="text-g text-2xl mb-4">Featured Hostels</h2>
  <div class="grid md:grid-cols-3 gap-5 mb-8">
    ${hostels.slice(0, 3).map(renderHostelCard).join('')}
  </div>

  <!-- How It Works -->
  <div class="bg-white rounded-xl shadow-card p-6">
    <h2 class="text-g text-xl mb-5">How It Works</h2>
    <div class="grid md:grid-cols-4 gap-4">
      ${[
        ['🔍', 'Browse',      'Explore hostels with live availability'],
        ['🚪', 'Choose',      'Select your preferred room type'],
        ['📝', 'Fill Details','Enter your student registration number'],
        ['✅', 'Confirmed',   'Receive instant booking confirmation'],
      ].map(([icon, title, desc]) => `
        <div class="text-center p-3">
          <div class="w-12 h-12 rounded-full bg-green-50 text-2xl flex items-center justify-center mx-auto mb-2">${icon}</div>
          <div class="font-bold text-sm text-g mb-1">${title}</div>
          <div class="text-gray-500 text-xs">${desc}</div>
        </div>`).join('')}
    </div>
  </div>`;
}
