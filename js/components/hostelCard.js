/**
 * components/hostelCard.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: renders a single hostel card HTML snippet.
 * Pure function – no state reads except what is passed in.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { e, formatPrice, roomStats, hostelCoverHtml } from '../utils.js';

/**
 * @param {object} hostel – a hostel object from state
 * @returns {string}      – HTML string for the card
 */
export function renderHostelCard(hostel) {
  const s   = roomStats(hostel);
  const pct = s.t > 0 ? Math.round((s.b / s.t) * 100) : 0;

  const badgeCls = s.a === 0 ? 'badge-err' : s.a < 3 ? 'badge-warn' : 'badge-ok';
  const label    = s.a === 0 ? 'Fully Booked' : `${s.a} Available`;
  const minPrice = hostel.rooms.length
    ? formatPrice(Math.min(...hostel.rooms.map(r => r.price)))
    : 'N/A';

  return `
  <div class="bg-white rounded-xl shadow-card overflow-hidden hostel-card shadow-hover"
       onclick="App.go('hostelDetail', { selH: ${hostel.id}, fType: 'All' })">
    ${hostelCoverHtml(hostel)}
    <div class="p-4">
      <div class="flex items-start justify-between mb-1">
        <h3 class="font-bold text-g">${e(hostel.name)}</h3>
        <span class="text-xs px-2 py-0.5 rounded-full font-semibold ml-2 whitespace-nowrap ${badgeCls}">
          ${e(label)}
        </span>
      </div>
      <div class="text-xs text-gray-500 mb-1">📍 ${e(hostel.distance)}</div>
      ${hostel.location?.address
        ? `<div class="text-xs text-gray-400 mb-2">🗺 ${e(hostel.location.address.slice(0, 50))}</div>`
        : ''}
      <div class="text-xs text-gray-400 mb-3">
        ${e(hostel.description.slice(0, 70))}${hostel.description.length > 70 ? '…' : ''}
      </div>
      <div class="flex items-center gap-2 mb-3">
        <div class="flex-1 bg-gray-100 rounded-full h-1.5">
          <div class="prog h-1.5 rounded-full" style="width:${pct}%"></div>
        </div>
        <span class="text-xs text-gray-500">${pct}%</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-500">👫 ${e(hostel.gender)}</span>
        <span class="text-xs font-bold text-gold">From ${minPrice}/sem</span>
      </div>
    </div>
  </div>`;
}
