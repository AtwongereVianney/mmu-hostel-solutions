/**
 * components/nav.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: renders ONLY the top navigation bar.
 * Reads from state; never mutates it.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { state } from '../state.js';

export function renderNav() {
  const { view, adminMode } = state;

  const adminLinks = adminMode
    ? `<button onclick="App.go('admin')"    class="nav-a ${view==='admin'    ?'active':''}">Admin</button>
       <button onclick="App.go('security')" class="nav-a ${view==='security' ?'active':''}">🔐 Security</button>
       <button onclick="App.logout()"       class="text-red-300 text-xs border border-red-400 px-2 py-1 rounded font-semibold hover:text-red-100">Logout</button>`
    : `<button onclick="App.openModal('adminLogin')" class="text-white text-xs border border-white border-opacity-30 px-3 py-1 rounded-full hover:bg-white hover:bg-opacity-10">Admin Login</button>`;

  return `
  <nav class="bg-g shadow-lg sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">

      <!-- Brand -->
      <button onclick="App.go('home')" class="flex items-center gap-3 text-left">
        <div class="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-green-900 font-bold text-sm flex-shrink-0">MMU</div>
        <div>
          <div class="text-white font-bold text-sm serif leading-none">Mountains of the Moon</div>
          <div class="text-yellow-300 text-xs flex items-center gap-1">
            University Hostel Booking
            <span class="sec-badge">🔒 SECURED</span>
          </div>
        </div>
      </button>

      <!-- Desktop links -->
      <div class="hidden md:flex items-center gap-5">
        <button onclick="App.go('home')"       class="nav-a ${view==='home'?'active':''}">Home</button>
        <button onclick="App.go('hostels')"    class="nav-a ${view==='hostels'||view==='hostelDetail'?'active':''}">Hostels</button>
        <button onclick="App.go('myBookings')" class="nav-a ${view==='myBookings'?'active':''}">My Bookings</button>
        ${adminLinks}
      </div>

      <!-- Mobile hamburger -->
      <button onclick="document.getElementById('mob-menu')?.classList.toggle('hidden')"
              class="md:hidden text-white text-xl" aria-label="Toggle menu">☰</button>
    </div>

    <!-- Mobile dropdown -->
    <div id="mob-menu" class="hidden md:hidden px-4 pb-3 flex flex-col gap-2 border-t border-green-700 bg-g">
      <button onclick="App.go('home')"       class="nav-a text-left py-1">🏠 Home</button>
      <button onclick="App.go('hostels')"    class="nav-a text-left py-1">🏢 Hostels</button>
      <button onclick="App.go('myBookings')" class="nav-a text-left py-1">📋 My Bookings</button>
      ${adminMode
        ? `<button onclick="App.go('admin')"    class="nav-a text-left py-1">⚙️ Admin</button>
           <button onclick="App.go('security')" class="nav-a text-left py-1">🔐 Security</button>
           <button onclick="App.logout()"       class="text-red-300 text-left text-sm py-1">🚪 Logout</button>`
        : `<button onclick="App.openModal('adminLogin')" class="nav-a text-left py-1">🔐 Admin Login</button>`
      }
    </div>
  </nav>`;
}
