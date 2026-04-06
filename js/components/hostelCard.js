/**
 * components/hostelCard.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Reusable hostel card component with:
 *   - Star rating (Booking.com style)
 *   - Availability urgency badge
 *   - ❤️ Shortlist / Wishlist button
 *   - Price-from display
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { state }                from '../state.js';
import { e, formatPrice, roomStats, hostelCoverHtml, starRatingHtml, availabilityBadgeHtml } from '../utils.js';

export function renderHostelCard(h) {
  const s        = roomStats(h);
  const minPrice = h.rooms.length ? Math.min(...h.rooms.map(r => r.price)) : 0;
  const isSaved  = state.shortlist.includes(h.id);
  const rating   = h.rating ?? 0;

  return `
  <div class="bg-white rounded-2xl shadow-card shadow-hover overflow-hidden hostel-card"
       onclick="App.go('hostelDetail', { selH: ${h.id}, fType: 'All' })">

    <!-- Cover image / emoji fallback -->
    <div style="position:relative">
      ${hostelCoverHtml(h)}
      <!-- Wishlist heart button (Booking.com style) -->
      <button class="btn-heart${isSaved ? ' saved' : ''}"
              style="position:absolute;top:.5rem;right:.5rem;background:rgba(255,255,255,.85);backdrop-filter:blur(4px);border-radius:50%;width:2rem;height:2rem;display:flex;align-items:center;justify-content:center;"
              onclick="event.stopPropagation(); App.toggleShortlist(${h.id})"
              title="${isSaved ? 'Remove from shortlist' : 'Save to shortlist'}">
        ${isSaved ? '❤️' : '🤍'}
      </button>
      <!-- Gender badge -->
      <span class="text-xs px-2 py-0.5 rounded-full font-semibold"
            style="position:absolute;top:.5rem;left:.5rem;background:rgba(255,255,255,.85);color:#1a5c38;backdrop-filter:blur(4px);">
        ${h.gender}
      </span>
    </div>

    <!-- Card body -->
    <div class="p-4">
      <!-- Name + rating row -->
      <div class="flex items-start justify-between gap-2 mb-1">
        <div class="font-bold text-g text-base leading-tight">${e(h.name)}</div>
        ${rating ? starRatingHtml(rating) : ''}
      </div>

      <!-- Distance -->
      <div class="text-xs text-gray-400 mb-2">📍 ${e(h.distance)}</div>

      <!-- Availability urgency badge (Booking.com style) -->
      <div class="mb-3">${availabilityBadgeHtml(s.a)}</div>

      <!-- Amenity chips (first 3) -->
      <div class="flex flex-wrap gap-1 mb-3">
        ${h.amenities.slice(0, 3).map(a => `<span class="chip">✓ ${e(a)}</span>`).join('')}
        ${h.amenities.length > 3 ? `<span class="chip text-gray-400">+${h.amenities.length - 3} more</span>` : ''}
      </div>

      <!-- Price from + CTA -->
      <div class="flex items-center justify-between gap-2">
        ${minPrice
          ? `<div class="flex-1">
               <div class="text-xs text-gray-400">From</div>
               <div class="font-bold text-gold">${formatPrice(minPrice)}<span class="text-gray-400 font-normal text-xs">/sem</span></div>
             </div>`
          : '<div class="text-xs text-gray-400 flex-1">No rooms yet</div>'}
        
        <!-- WhatsApp Contact -->
        ${h.managerPhone ? `
          <a href="https://wa.me/${h.managerPhone.replace(/\D/g,'').replace(/^0/,'256')}" 
             target="_blank" onclick="event.stopPropagation()"
             class="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors"
             title="Chat with Manager">
            <svg viewBox="0 0 448 512" fill="currentColor" style="width:1.2rem;height:1.2rem"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.2-8.5-44.2-27.1-16.4-14.6-27.4-32.7-30.6-38.2-3.2-5.6-.3-8.6 2.5-11.3 2.5-2.5 5.5-6.5 8.3-9.8 2.8-3.3 3.7-5.6 5.5-9.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.3 5.7 23.7 9.2 31.8 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
          </a>` : ''}

        <button class="btn-g btn-sm" onclick="event.stopPropagation(); App.go('hostelDetail', { selH: ${h.id}, fType: 'All' })">
          View Rooms
        </button>
      </div>
    </div>
  </div>`;
}
