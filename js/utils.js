/**
 * utils.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: pure utility/helper functions only.
 * No DOM manipulation, no state mutation, no security logic.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { escapeHtml, safeImgSrc } from './security.js';
import { hostels, state } from './state.js';

/* Re-export escapeHtml as the short alias used throughout templates */
export const e = escapeHtml;
export { escapeHtml };

/** Whitelist: only serve images from our known upload folders */
const BACKEND_ASSET_IMG_RE = /^assets\/images\/(?:rooms|hostels)\/[A-Za-z0-9_.\-]+\.(?:jpe?g|png|gif|webp)$/i;

/** Base URL for `new-hostel/` (matches js/storage.js getApiBaseUrl) */
export function getBackendPublicBase() {
  if (typeof window === 'undefined') return '';
  if (window.location.port === '3000') {
    return 'http://localhost/mmu-hostel%20solutions/new-hostel/';
  }
  try {
    return new URL('new-hostel/', window.location.href).href;
  } catch {
    return '';
  }
}

/** Turn a DB-stored relative path into an absolute URL safe for <img src> */
export function backendAssetImgUrl(relPath) {
  if (relPath == null || relPath === '') return null;
  const p = String(relPath).trim().replace(/^\/+/, '');
  if (/^https?:\/\//i.test(p)) return safeImgSrc(p) ? p : null;
  if (!BACKEND_ASSET_IMG_RE.test(p)) return null;
  const base = getBackendPublicBase();
  if (!base) return null;
  try {
    return new URL(p, base).href;
  } catch {
    return null;
  }
}

function safeHostelAccent(hex) {
  return /^#[0-9A-Fa-f]{6}$/.test(String(hex || '')) ? hex : '#1a5c38';
}

/**
 * Room card / modal preview: room photo if available, else hostel gallery, else illustrative placeholder.
 * @param {{ image?: string|null, number?: string, type?: string }} room
 * @param {{ image?: string|null, images?: string[], color?: string, emoji?: string }} hostel
 */
export function roomPreviewHtml(room, hostel, opts = {}) {
  const h = hostel || {};
  const compact = !!opts.compact;
  let src = backendAssetImgUrl(room?.image);
  if (!src && Array.isArray(h.images) && h.images[0]) {
    src = backendAssetImgUrl(h.images[0]);
  }
  if (!src && h.image) {
    const tryH = safeImgSrc(h.image) || backendAssetImgUrl(h.image);
    src = tryH || null;
  }
  const alt = `Room ${room?.number ?? ''}`.trim() || 'Room preview';
  const cls = compact ? 'room-preview-img room-preview-img--sm' : 'room-preview-img';
  if (src) {
    return `<div class="room-preview-wrap${compact ? ' room-preview-wrap--sm' : ''}"><img src="${e(src)}" class="${cls}" alt="${e(alt)}" loading="lazy"/></div>`;
  }
  const accent = safeHostelAccent(h.color);
  const num = e(room?.number ?? '');
  const typ = e(room?.type ?? 'Room');
  const bed = room?.type === 'Single' ? '🛏' : room?.type === 'Double' ? '🛏🛏' : '🛏🛏🛏';
  return `<div class="room-preview-placeholder${compact ? ' room-preview-placeholder--sm' : ''}" style="background:linear-gradient(135deg,${e(accent)}22,${e(accent)}55)">
    <span class="room-preview-ph-inner">
      <span class="room-preview-ph-bed">${bed}</span>
      <span class="room-preview-ph-num">Room ${num}</span>
      <span class="room-preview-ph-type">${typ}</span>
    </span>
  </div>`;
}

/* ── Data helpers ─────────────────────────────────────────────────────────── */

/** Format UGX price with locale separator */
export function formatPrice(n) {
  return 'UGX ' + Number(n).toLocaleString();
}

/** Return { t: total, b: booked, a: available, p: pending } for a hostel */
export function roomStats(hostel) {
  const t = hostel.rooms.length;
  const a = hostel.rooms.filter(r => r.status === 'available').length;
  const p = hostel.rooms.filter(r => r.status === 'pending').length;
  return { t, b: t - a - p, a, p };
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
  const src = safeImgSrc(hostel.image) || backendAssetImgUrl(hostel.image);
  if (src) {
    return `<img src="${e(src)}" class="${e(cssClass)}" alt="${e(hostel.name)}" loading="lazy"/>`;
  }
  return `<div class="hostel-emoji" style="background:linear-gradient(135deg,${e(hostel.color)}22,${e(hostel.color)}55)">${hostel.emoji ?? '🏠'}</div>`;
}

/** Tiny thumbnail used in admin table rows */
export function hostelThumbnailHtml(hostel) {
  const src = safeImgSrc(hostel.image) || backendAssetImgUrl(hostel.image);
  const base = 'width:3rem;height:3rem;object-fit:cover;border-radius:.5rem;';
  if (src) {
    return `<img src="${e(src)}" style="${base}" alt="${e(hostel.name)}" loading="lazy"/>`;
  }
  return `<div style="${base}display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:${e(hostel.color)}22">${hostel.emoji ?? '🏠'}</div>`;
}

/** ── STAR RATING HTML ─────────────────────────────────────────────────────
 *  Renders a row of filled/empty stars for a 0–5 rating.
 *  @param {number} rating   e.g. 4.2
 *  @param {boolean} showNum  whether to show the numeric score
 */
export function starRatingHtml(rating = 0, showNum = true) {
  const r = Math.round(rating * 2) / 2; // round to nearest 0.5
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(r))      stars += '<span class="star">★</span>';
    else if (i - 0.5 === r)      stars += '<span class="star">½</span>';
    else                          stars += '<span class="star-empty">★</span>';
  }
  return `<span class="star-row">${stars}${showNum ? `<span class="star-score">${Number(rating).toFixed(1)}</span>` : ''}</span>`;
}

/** ── AVAILABILITY BADGE HTML (Booking.com-style urgency) ─────────────────
 *  @param {number} available  count of available rooms
 */
export function availabilityBadgeHtml(available) {
  if (available === 0) {
    return `<span class="text-xs px-2 py-0.5 rounded-full font-semibold avail-none">Fully Booked</span>`;
  }
  if (available === 1) {
    return `<span class="text-xs px-2 py-0.5 rounded-full font-semibold avail-low">🔴 Only 1 left!</span>`;
  }
  if (available <= 4) {
    return `<span class="text-xs px-2 py-0.5 rounded-full font-semibold avail-medium">🟡 ${available} rooms left</span>`;
  }
  return `<span class="text-xs px-2 py-0.5 rounded-full font-semibold avail-high">✅ ${available} available</span>`;
}

/** ── SKELETON CARD HTML ──────────────────────────────────────────────────── */
export function skeletonCardHtml() {
  return `
  <div class="skeleton-card">
    <div class="skeleton skeleton-img"></div>
    <div class="p-4 space-y-2">
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line-sm"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line-sm" style="width:40%"></div>
    </div>
  </div>`;
}

/** ── BOOKING TIMELINE HTML ────────────────────────────────────────────────
 *  Shows Booking.com-style status steps: Submitted → Payment → Confirmed
 */
export function bookingTimelineHtml(status) {
  const steps = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'payment',   label: 'Payment'   },
    { key: 'confirmed', label: 'Confirmed' },
  ];
  const activeIdx = status === 'confirmed' ? 2 : status === 'pending' ? 1 : 0;

  const dots = steps.map((step, i) => {
    const cls = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending';
    const line = i < steps.length - 1
      ? `<div class="tl-line ${i < activeIdx ? 'done' : ''}"></div>`
      : '';
    return `
    <div class="tl-step">
      <div class="tl-dot ${cls}">${i < activeIdx ? '✓' : i + 1}</div>
      <div class="tl-label">${step.label}</div>
    </div>${line}`;
  }).join('');

  return `<div class="timeline">${dots}</div>`;
}

/** ── BOOKING CARD HTML (enhanced with timeline + download slip) ─────────── */
export function bookingCardHtml(booking) {
  const h    = getHostel(booking.hostelId);
  const room = h?.rooms.find(r => r.id === booking.roomId);
  if (!h || !room) return '';

  const statusLabel = booking.status === 'confirmed'
    ? '<span class="text-xs px-2 py-0.5 rounded-full font-semibold badge-ok">✓ Confirmed</span>'
    : '<span class="text-xs px-2 py-0.5 rounded-full font-semibold badge-warn">⏳ Pending Payment</span>';

  return `
  <div class="bg-white rounded-xl shadow-card p-4 border-l-4 ${booking.status === 'confirmed' ? 'border-green-500' : 'border-yellow-400'}">
    <div class="flex items-start justify-between flex-wrap gap-2 mb-2">
      <div>
        <div class="font-bold text-g">${e(booking.studentName)}</div>
        <div class="text-xs text-gray-500">${e(booking.regNo)} · ${e(booking.course)}</div>
      </div>
      ${statusLabel}
    </div>
    ${bookingTimelineHtml(booking.status)}
    <div class="mt-2 grid grid-cols-2 gap-1 text-xs">
      <div><span class="text-gray-400">Hostel:</span> <b>${e(h.name)}</b></div>
      <div><span class="text-gray-400">Room:</span> <b>${e(room.number)} (${e(room.type)})</b></div>
      <div><span class="text-gray-400">Floor:</span> <b>${e(room.floor)}</b></div>
      <div><span class="text-gray-400">Semester:</span> <b>${e(booking.semester ?? '—')}</b></div>
      <div><span class="text-gray-400">Amount:</span> <b class="text-gold">${formatPrice(room.price)}</b></div>
      <div><span class="text-gray-400">Date:</span> <b>${e(booking.date)}</b></div>
    </div>
    <div class="mt-3 flex items-center justify-between flex-wrap gap-2">
      <div class="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded font-mono">
        Ref: #${e(booking.id)}
      </div>
      ${booking.status === 'confirmed'
        ? `<button onclick="App.downloadBookingSlip('${e(booking.id)}')"
                   class="text-xs text-g font-bold hover:underline flex items-center gap-1">
             📄 Download Slip
           </button>`
        : ''}
    </div>
  </div>`;
}
