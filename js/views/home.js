/**
 * views/home.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: renders ONLY the home page.
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
  const { fSearch, fGender } = state;

  return `
  <!-- Hero responsive styles -->
  <style>
    .hero-wrap {
      background: linear-gradient(135deg,#0b2e1a 0%,#1a5c38 55%,#2d7a4f 100%);
      position: relative;
      overflow: hidden;
      border-radius: 1rem;
      margin-bottom: 2rem;
      font-family: 'Inter','Segoe UI',system-ui,-apple-system,sans-serif;
    }
    .hero-inner {
      position: relative;
      padding: 1.6rem 2rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1.5rem;
    }
    .hero-text { flex: 1; min-width: 220px; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: .35rem;
      background: rgba(240,180,41,.15); border: 1px solid rgba(240,180,41,.35);
      border-radius: 999px; padding: .18rem .75rem;
      margin-bottom: .55rem; font-size: .67rem; font-weight: 700;
      letter-spacing: .09em; text-transform: uppercase; color: #f0b429;
    }
    .hero-h1 {
      margin: 0 0 .35rem 0;
      font-size: clamp(1.35rem, 3.5vw, 2.1rem);
      font-weight: 800; line-height: 1.2; color: #fff; letter-spacing: -.02em;
    }
    .hero-sub {
      margin: 0 0 .85rem 0; font-size: .86rem; font-weight: 500;
      color: rgba(187,247,208,.9); line-height: 1.5; max-width: 420px;
    }
    .hero-btn {
      display: inline-flex; align-items: center; gap: .4rem;
      background: #f0b429; color: #0b2e1a; border: none;
      border-radius: .6rem; padding: .6rem 1.5rem;
      font-size: .9rem; font-weight: 700; letter-spacing: .01em;
      cursor: pointer; transition: background .2s, transform .15s, box-shadow .2s;
      box-shadow: 0 4px 18px rgba(240,180,41,.35);
    }
    .hero-btn:hover {
      background: #ffc94d; transform: translateY(-1px);
      box-shadow: 0 6px 22px rgba(240,180,41,.5);
    }
    .hero-stats {
      display: grid; grid-template-columns: repeat(3,1fr);
      gap: .75rem; flex-shrink: 0;
    }
    .hero-stat {
      text-align: center;
      background: rgba(11,46,26,.45);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: .9rem; padding: .65rem .8rem;
      backdrop-filter: blur(8px); min-width: 76px;
    }
    .hero-stat-icon  { font-size:1.2rem; margin-bottom:.18rem; line-height:1; }
    .hero-stat-val   {
      font-size:1.4rem; font-weight:800; color:#f0b429;
      line-height:1; margin-bottom:.2rem;
      font-variant-numeric:tabular-nums; letter-spacing:-.02em;
    }
    .hero-stat-label {
      font-size:.64rem; font-weight:700; color:#4ade80;
      letter-spacing:.09em; text-transform:uppercase;
    }

    /* Tablet */
    @media(max-width:768px){
      .hero-inner { padding:1.25rem 1.25rem; gap:1.1rem; }
      .hero-h1    { font-size: clamp(1.2rem, 5vw, 1.7rem); }
      .hero-sub   { font-size:.82rem; }
      .hero-btn   { padding:.55rem 1.2rem; font-size:.85rem; }
      .hero-stats { gap:.55rem; }
      .hero-stat  { padding:.55rem .6rem; min-width:68px; }
      .hero-stat-val { font-size:1.2rem; }
    }

    /* Mobile */
    @media(max-width:480px){
      .hero-inner  { padding:1rem; flex-direction:column; align-items:stretch; gap:.9rem; }
      .hero-text   { min-width:unset; }
      .hero-h1     { font-size: clamp(1.15rem, 6vw, 1.5rem); }
      .hero-sub    { font-size:.8rem; max-width:100%; }
      .hero-btn    { width:100%; justify-content:center; padding:.6rem 1rem; }
      .hero-stats  { grid-template-columns:repeat(3,1fr); gap:.5rem; width:100%; }
      .hero-stat   { padding:.5rem .4rem; min-width:0; }
      .hero-stat-icon { font-size:1rem; }
      .hero-stat-val  { font-size:1.1rem; }
      .hero-stat-label{ font-size:.58rem; }
    }
  </style>

  <!-- Hero Banner -->
  <div class="hero-wrap">
    <!-- Ambient glow -->
    <div style="position:absolute;inset:0;opacity:.18;background:radial-gradient(ellipse at 15% 85%,#f0b429,transparent 55%),radial-gradient(ellipse at 85% 15%,#c9961a,transparent 55%)"></div>
    <div style="position:absolute;bottom:-3rem;right:-3rem;width:12rem;height:12rem;border-radius:50%;background:rgba(255,255,255,.04)"></div>
    <div style="position:absolute;top:-2rem;left:60%;width:8rem;height:8rem;border-radius:50%;background:rgba(255,255,255,.04)"></div>

    <div class="hero-inner">

      <!-- Left: Text -->
      <div class="hero-text">
        <div class="hero-badge">🏔 Fort Portal, Uganda &nbsp;·&nbsp; MMU Campus</div>
        <h1 class="hero-h1">Find Your Perfect <span style="color:#f0b429;">Student Hostel</span></h1>
        <p class="hero-sub">Secure accommodation near MMU &nbsp;·&nbsp; ⚡ Instant booking &nbsp;·&nbsp; 📱 Mobile money</p>
        <button class="hero-btn" onclick="App.go('hostels')">Browse Hostels <span>→</span></button>
      </div>

      <!-- Right: Stats -->
      <div class="hero-stats">
        ${[['Available',s.a,'✅'],['Hostels',hostels.length,'🏢'],['Total Rooms',s.t,'🚪']].map(([l,v,ic])=>`
          <div class="hero-stat">
            <div class="hero-stat-icon">${ic}</div>
            <div class="hero-stat-val">${v}</div>
            <div class="hero-stat-label">${l}</div>
          </div>`).join('')}
      </div>

    </div>
  </div>

  <!-- Search Hostels Section -->
  <div class="bg-white rounded-2xl shadow-card p-5 mb-8">
    <div class="text-g font-bold text-sm mb-3">🔍 Search Hostels</div>
    <div class="grid md:grid-cols-4 gap-3 items-end">
      <div class="md:col-span-2">
        <label class="lbl">Search Hostel</label>
        <input id="homeSearchInput" class="inp" maxlength="80" placeholder="Type full hostel name, then press Enter or click Search"
               value="${e(fSearch)}"
               onkeydown="if(event.key==='Enter'){ App.setState({ fSearch: Sec.sanitize(this.value, 80) }); App.searchHostels(); }"/>
      </div>
      <div>
        <label class="lbl">Gender</label>
        <select class="inp" onchange="App.setState({ fGender: this.value })">
          ${['All','Male','Female','Mixed'].map(g => `<option value="${g}"${fGender===g?' selected':''}>${g}</option>`).join('')}
        </select>
      </div>
      <div>
        <button onclick="App.setState({ fSearch: Sec.sanitize(document.getElementById('homeSearchInput')?.value || '', 80) }); App.searchHostels();" class="btn-g w-full">Search →</button>
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

  <!-- How It Works Section -->
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

  <!-- Trust Signals -->
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
  </div>
  
  <!-- System Developers Footer Strip -->
  <div class="mt-8 text-center text-xs text-gray-500 pb-4">
    <p>System Developers: <b>${e(state.developerContact || 'Not Specified')}</b></p>
  </div>`;
}
