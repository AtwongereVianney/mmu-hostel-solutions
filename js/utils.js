/**
 * utils.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: pure utility/helper functions only.
 * No DOM manipulation, no state mutation, no security logic.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { escapeHtml, safeImgSrc } from './security.js';
import { hostels }      from './state.js';

/* Re-export escapeHtml as the short alias used throughout templates */
export const e = escapeHtml;
export { escapeHtml };

/* ── Data helpers ─────────────────────────────────────────────────────────── */

/** Format UGX price with locale separator */
export function formatPrice(n) {
  return 'UGX ' + Number(n).toLocaleString();
}

/** Return { t: total, b: booked, a: available } for a hostel */
export function roomStats(hostel) {
  const t = hostel.rooms.length;
  const b = hostel.rooms.filter(r => r.status === 'booked').length;
  return { t, b, a: t - b };
}

/** Aggregate stats across all hostels */
export function allStats() {
  let t = 0, b = 0;
  hostels.forEach(h => { const s = roomStats(h); t += s.t; b += s.b; });
  return { t, b, a: t - b };
}

/** Find a hostel by id */
export function getHostel(id) {
  return hostels.find(h => h.id === id) ?? null;
}

/** Generate a unique numeric id */
export function makeId() {
  return Date.now() + (Math.random() * 1000 | 0);
}

/** Today's date as dd/mm/yyyy */
export function today() {
  return new Date().toLocaleDateString('en-GB');
}

/* ── Map URL builders ─────────────────────────────────────────────────────── */

export function mapLinkUrl(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`;
}

export function mapEmbedUrl(lat, lng) {
  const d = 0.008;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${+lng - d},${+lat - d},${+lng + d},${+lat + d}&layer=mapnik&marker=${lat},${lng}`;
}

/* ── HTML snippet builders ─────────────────────────────────────────────────── */

/** Render hostel cover: real <img> if photo exists, fallback emoji block */
export function hostelCoverHtml(hostel, cssClass = 'hostel-img') {
  const src = safeImgSrc(hostel.image);
  if (src) {
    return `<img src="${src}" class="${cssClass}" alt="${e(hostel.name)}" loading="lazy"/>`;
  }
  return `<div class="hostel-emoji" style="background:linear-gradient(135deg,${e(hostel.color)}22,${e(hostel.color)}55)">${hostel.emoji ?? '🏠'}</div>`;
}

/** Tiny thumbnail used in admin table rows */
export function hostelThumbnailHtml(hostel) {
  const src = safeImgSrc(hostel.image);
  const base = 'width:3rem;height:3rem;object-fit:cover;border-radius:.5rem;';
  if (src) {
    return `<img src="${src}" style="${base}" alt="${e(hostel.name)}" loading="lazy"/>`;
  }
  return `<div style="${base}display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:${e(hostel.color)}22">${hostel.emoji ?? '🏠'}</div>`;
}

/** Reusable booking card HTML (used in My Bookings + Admin) */
export function bookingCardHtml(booking) {
  const h    = getHostel(booking.hostelId);
  const room = h?.rooms.find(r => r.id === booking.roomId);
  if (!h || !room) return '';
  return `
  <div class="bg-white rounded-xl shadow-card p-4 border-l-4 border-green-500">
    <div class="flex items-start justify-between flex-wrap gap-2">
      <div>
        <div class="font-bold text-g">${e(booking.studentName)}</div>
        <div class="text-xs text-gray-500">${e(booking.regNo)} · ${e(booking.course)}</div>
      </div>
      <span class="badge-ok text-xs px-2 py-0.5 rounded-full font-semibold">✓ Confirmed</span>
    </div>
    <div class="mt-2 grid grid-cols-2 gap-1 text-xs">
      <div><span class="text-gray-400">Hostel:</span> <b>${e(h.name)}</b></div>
      <div><span class="text-gray-400">Room:</span> <b>${e(room.number)} (${e(room.type)})</b></div>
      <div><span class="text-gray-400">Amount:</span> <b class="text-gold">${formatPrice(room.price)}</b></div>
      <div><span class="text-gray-400">Date:</span> <b>${e(booking.date)}</b></div>
    </div>
    <div class="mt-2 text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded font-mono">
      Ref: #${e(booking.id)}
    </div>
  </div>`;
}
