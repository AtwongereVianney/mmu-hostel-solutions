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

function getApiBaseUrl() {
  // When running the static frontend via `npm run dev` (serve on :3000),
  // the PHP backend is on Apache (usually :80).
  if (window.location.port === '3000') {
    return 'http://localhost/mmu-hostel%20solutions/new-hostel/api.php';
  }
  // When running the app via Apache, the API is same-origin.
  return './new-hostel/api.php';
}

const API_BASE_URL = getApiBaseUrl();
const STORAGE_KEYS = Object.freeze({
  hostels:  'mmu_hostels_v3',
  bookings: 'mmu_bookings_v3',
  settings: 'mmu_settings_v3',
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

    if (data && (['POST', 'PUT', 'DELETE'].includes(method))) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      return {
        success: false,
        error: payload?.error || `API request failed: ${response.status}`,
        status: response.status,
      };
    }
    return payload;
  } catch (error) {
    console.warn(`API request failed for ${endpoint}:`, error.message);
    return { success: false, error: error.message || 'Network error' };
  }
}

export async function loadUsers(role = 'hostel_owner') {
  const q = encodeURIComponent(role);
  const users = await apiRequest(`users?role=${q}`, 'GET');
  return Array.isArray(users) ? users : [];
}

export async function loadUserById(id) {
  const user = await apiRequest(`users?id=${encodeURIComponent(id)}`, 'GET');
  return user && typeof user === 'object' ? user : null;
}

export async function createUser(payload) {
  return apiRequest('users', 'POST', payload);
}

export async function loginUser(email, password) {
  return apiRequest('login', 'POST', { email, password });
}

export async function updateUserStatus(id, status) {
  return apiRequest('users', 'PUT', { id, status });
}

export async function loadRoles() {
  const roles = await apiRequest('roles', 'GET');
  return Array.isArray(roles) ? roles : [];
}

export async function createRole(name, business_id = 1, branch_id = 1) {
  return apiRequest('roles', 'POST', { name, business_id, branch_id });
}

export async function loadPermissions() {
  const perms = await apiRequest('permissions', 'GET');
  return Array.isArray(perms) ? perms : [];
}

export async function createPermission(name, business_id = 1, branch_id = 1) {
  return apiRequest('permissions', 'POST', { name, business_id, branch_id });
}

export async function seedDefaultPermissions(business_id = 1, branch_id = 1) {
  return apiRequest('permissions', 'POST', { seed_defaults: true, business_id, branch_id });
}

export async function updateUserAccess(id, payload = {}) {
  return apiRequest('users', 'PUT', { id, ...payload });
}

export async function saveUserProfile(id, payload) {
  return apiRequest('users', 'PUT', { id, ...payload });
}

export async function deleteUser(id) {
  return apiRequest('users', 'DELETE', { id });
}

export async function deleteHostel(id) {
  return apiRequest('hostels', 'DELETE', { id });
}

export async function deleteBooking(id) {
  return apiRequest('bookings', 'DELETE', { id });
}

export async function deleteRole(id) {
  return apiRequest('roles', 'DELETE', { id });
}

export async function deletePermission(id) {
  return apiRequest('permissions', 'DELETE', { id });
}

export async function deleteRoom(id) {
  return apiRequest('rooms', 'DELETE', { id });
}


export async function assignHostelOwner(hostelId, ownerId) {
  return apiRequest('hostels', 'PUT', { id: hostelId, owner_id: ownerId });
}

export async function sendApprovedBookingCredentials(payload) {
  return apiRequest('booking-approval', 'POST', payload);
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

/** Strip one-time API payloads (e.g. base64 room photos) before caching to localStorage */
function hostelsForLocalStorage(hostels) {
  if (!Array.isArray(hostels)) return hostels;
  return hostels.map(h => {
    const copy = { ...h };
    delete copy.image_upload;
    copy.rooms = (h.rooms || []).map((r) => {
      const rCopy = { ...r };
      delete rCopy.image_upload;
      return rCopy;
    });
    return copy;
  });
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

    if (Array.isArray(hostelsData) && hostelsData.length > 0) {
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

  // Settings
  const settingsObj = await secureGet(STORAGE_KEYS.settings, { developerContact: 'MMU Tech Team: devSupport@mmu.ac.ug | 0756188401' });
  import('./state.js').then(module => {
    module.setState({ developerContact: settingsObj.developerContact });
  });

  // Data Migration: Ensure existing hostels get the new managerPhone from seeds if missing
  if (Array.isArray(hostels)) {
    hostels = hostels.map(h => {
      const seed = SEED_HOSTELS.find(s => s.id === h.id);
      if (seed && !h.managerPhone) {
        h.managerPhone = seed.managerPhone;
      }
      // Normalize DB hostels so UI components never crash on missing fields
      // (DB schema stores only a subset; UI expects richer fields).
      h.rooms = Array.isArray(h.rooms) ? h.rooms : [];
      h.amenities = Array.isArray(h.amenities) ? h.amenities : (seed?.amenities ?? []);
      h.gender = h.gender ?? seed?.gender ?? 'Mixed';
      h.distance = h.distance ?? seed?.distance ?? '';
      const firstHostelImg = Array.isArray(h.images) && h.images.length ? h.images[0] : null;
      h.image = h.image ?? firstHostelImg ?? seed?.image ?? null;
      h.emoji = h.emoji ?? seed?.emoji ?? '🏠';
      h.color = h.color ?? seed?.color ?? '#1a5c38';
      h.rating = (h.rating ?? seed?.rating ?? 0);
      h.location = h.location ?? seed?.location ?? { address: h.address ?? '', lat: '', lng: '' };

      // Normalize room shapes/fields for UI
      h.rooms = h.rooms.map(r => ({
        id: r.id,
        number: r.number ?? r.room_number ?? '',
        type: r.type ?? '',
        price: Number(r.price ?? 0),
        confirmationFee: Number(r.confirmationFee ?? 50000),
        status: r.status ?? 'available',
        floor: r.floor ?? null,
        bookedBy: r.bookedBy ?? null,
        regNo: r.regNo ?? null,
        image: r.image ?? r.image_path ?? null,
      }));
      return h;
    });
  }

  setHostels(Array.isArray(hostels) ? hostels : SEED_HOSTELS);
  setBookings(Array.isArray(bookings) ? bookings : []);
}

/** Persist current hostels and bookings to API and localStorage */
export async function saveData() {
  const { hostels, bookings } = await import('./state.js');

  // Save to localStorage immediately for responsiveness (no transient upload blobs)
  await secureSet(STORAGE_KEYS.hostels, hostelsForLocalStorage(hostels));
  await secureSet(STORAGE_KEYS.bookings, bookings);

  // Try to sync with API (don't block on failure)
  try {
    // Sync hostels (upsert + room status persistence is handled server-side)
    for (const hostel of Array.isArray(hostels) ? hostels : []) {
      await apiRequest('hostels', 'POST', hostel);
    }

    // Sync bookings (upserted server-side by user+room+start_date)
    for (const booking of Array.isArray(bookings) ? bookings : []) {
      await apiRequest('bookings', 'POST', booking);
    }
  } catch (error) {
    console.warn('Failed to sync with API:', error);
    // Data is still saved locally, will sync when connection is restored
  }
}

/** Save System Settings to local storage */
export async function saveSystemSettings(settings) {
  let current = await secureGet(STORAGE_KEYS.settings, {});
  current = { ...current, ...settings };
  await secureSet(STORAGE_KEYS.settings, current);
}
