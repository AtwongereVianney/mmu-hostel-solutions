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
      <div class="flex items-center justify-between">
        ${minPrice
          ? `<div>
               <div class="text-xs text-gray-400">From</div>
               <div class="font-bold text-gold">${formatPrice(minPrice)}<span class="text-gray-400 font-normal text-xs">/sem</span></div>
             </div>`
          : '<div class="text-xs text-gray-400">No rooms yet</div>'}
        <button class="btn-g btn-sm" onclick="event.stopPropagation(); App.go('hostelDetail', { selH: ${h.id}, fType: 'All' })">
          View Rooms
        </button>
      </div>
    </div>
  </div>`;
}
