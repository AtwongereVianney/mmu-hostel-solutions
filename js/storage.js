/**
 * storage.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: ALL persistence logic lives here.
 * Reads/writes to localStorage via AES-GCM encryption (security.js).
 * No rendering, no state mutation beyond what is exported.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { encryptForStorage, decryptFromStorage, loadAuditLog } from './security.js';
import { SEED_HOSTELS } from './data.js';
import { setHostels, setBookings } from './state.js';

const STORAGE_KEYS = Object.freeze({
  hostels:  'mmu_hostels_v3',
  bookings: 'mmu_bookings_v3',
});

/* ── Secure read/write helpers ───────────────────────────────────────────── */
async function secureGet(key, fallback = null) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const decrypted = await decryptFromStorage(raw);
  if (decrypted !== null) return decrypted;
  // Fallback: try plain JSON (first-run migration path)
  try { return JSON.parse(raw); } catch { return fallback; }
}

async function secureSet(key, value) {
  const encrypted = await encryptForStorage(value);
  if (encrypted) localStorage.setItem(key, encrypted);
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/** Load all persisted data and populate the state stores */
export async function loadData() {
  await loadAuditLog();
  const h = await secureGet(STORAGE_KEYS.hostels,  SEED_HOSTELS);
  const b = await secureGet(STORAGE_KEYS.bookings, []);
  setHostels(Array.isArray(h) ? h : SEED_HOSTELS);
  setBookings(Array.isArray(b) ? b : []);
}

/** Persist current hostels and bookings to encrypted localStorage */
export async function saveData() {
  const { hostels, bookings } = await import('./state.js');
  await secureSet(STORAGE_KEYS.hostels,  hostels);
  await secureSet(STORAGE_KEYS.bookings, bookings);
}
