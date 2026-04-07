/**
 * storage.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: ALL persistence logic lives here.
 * Uses API backend for data synchronization, with localStorage fallback.
 * No rendering, no state mutation beyond what is exported.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { encryptForStorage, decryptFromStorage, loadAuditLog } from './security.js';
import { SEED_HOSTELS } from './data.js';
import { setHostels, setBookings } from './state.js';

const API_BASE_URL = './new-hostel/api.php';
const STORAGE_KEYS = Object.freeze({
  hostels:  'mmu_hostels_v3',
  bookings: 'mmu_bookings_v3',
});

/* ── API helpers ────────────────────────────────────────────────────────── */
async function apiRequest(endpoint, method = 'GET', data = null) {
  try {
    const url = `${API_BASE_URL}/${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`API request failed for ${endpoint}:`, error.message);
    return null;
  }
}

/* ── Secure localStorage helpers (fallback) ─────────────────────────────── */
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

  // Try to load from API first
  let hostels = null;
  let bookings = null;

  try {
    const [hostelsData, bookingsData] = await Promise.all([
      apiRequest('hostels'),
      apiRequest('bookings')
    ]);

    if (hostelsData && Array.isArray(hostelsData)) {
      hostels = hostelsData;
      // Cache in localStorage for offline access
      await secureSet(STORAGE_KEYS.hostels, hostels);
    }

    if (bookingsData && Array.isArray(bookingsData)) {
      bookings = bookingsData;
      // Cache in localStorage for offline access
      await secureSet(STORAGE_KEYS.bookings, bookings);
    }
  } catch (error) {
    console.warn('Failed to load from API, using localStorage:', error);
  }

  // Fallback to localStorage if API failed
  if (!hostels) {
    hostels = await secureGet(STORAGE_KEYS.hostels, SEED_HOSTELS);
  }
  if (!bookings) {
    bookings = await secureGet(STORAGE_KEYS.bookings, []);
  }

  // Data Migration: Ensure existing hostels get the new managerPhone from seeds if missing
  if (Array.isArray(hostels)) {
    hostels = hostels.map(h => {
      const seed = SEED_HOSTELS.find(s => s.id === h.id);
      if (seed && !h.managerPhone) {
        h.managerPhone = seed.managerPhone;
      }
      return h;
    });
  }

  setHostels(Array.isArray(hostels) ? hostels : SEED_HOSTELS);
  setBookings(Array.isArray(bookings) ? bookings : []);
}

/** Fetch all users (admin only) */
export async function loadUsers(role = null) {
  const endpoint = role ? `users?role=${role}` : 'users';
  const data = await apiRequest(endpoint);
  return Array.isArray(data) ? data : [];
}

/** Re-load hostels filtered by owner */
export async function loadOwnerHostels(ownerId) {
  const hostelsData = await apiRequest(`hostels?owner_id=${ownerId}`);
  if (hostelsData && Array.isArray(hostelsData)) {
    setHostels(hostelsData);
    return true;
  }
  return false;
}

/** Persist current hostels and bookings to API and localStorage */
export async function saveData() {
  const { hostels, bookings } = await import('./state.js');

  // Save to localStorage immediately for responsiveness
  await secureSet(STORAGE_KEYS.hostels, hostels);
  await secureSet(STORAGE_KEYS.bookings, bookings);

  // Try to sync with API (don't block on failure)
  try {
    // Sync hostels
    const currentHostels = await apiRequest('hostels');
    if (currentHostels) {
      // Find new hostels to add
      const existingIds = new Set(currentHostels.map(h => h.id));
      const newHostels = hostels.filter(h => !existingIds.has(h.id));

      for (const hostel of newHostels) {
        await apiRequest('hostels', 'POST', hostel);
      }
    }

    // Sync bookings
    const currentBookings = await apiRequest('bookings');
    if (currentBookings) {
      // Find new bookings to add
      const existingIds = new Set(currentBookings.map(b => b.id));
      const newBookings = bookings.filter(b => !existingIds.has(b.id));

      for (const booking of newBookings) {
        await apiRequest('bookings', 'POST', booking);
      }
    }
  } catch (error) {
    console.warn('Failed to sync with API:', error);
    // Data is still saved locally, will sync when connection is restored
  }
}
