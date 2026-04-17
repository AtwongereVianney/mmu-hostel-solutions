/**
 * state.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: single source of truth for ALL mutable state.
 * No rendering, no DOM, no security logic lives here.
 *
 * Pattern: centralised mutable object + a setState() helper that merges
 * partial updates and schedules a re-render via the registered callback.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { touchSession } from './security.js';
import { SEED_HOSTELS, PRICE_RANGE } from './data.js';

/* ── Mutable data stores ─────────────────────────────────────────────────── */
export let hostels  = [...SEED_HOSTELS];   // replaced on load from storage
export let bookings = [];

export function setHostels(arr)  { hostels  = arr; }
export function setBookings(arr) { bookings = arr; }

/* ── UI State ────────────────────────────────────────────────────────────── */
export const state = {
  /* navigation */
  view:        'home',       // current page view
  selH:        null,         // selected hostel id
  selR:        null,         // selected room id

  /* admin */
  adminMode:   false,
  adminUser:   '',
  userId:      null,
  userEmail:   '',
  userRole:    '',
  userPermissions: {},
  assignedHostelIds: [],
  managers:    [],
  managersLoading: false,
  managersLoaded: false,
  roles:       [],
  rolesLoading: false,
  rolesLoaded: false,
  permissions: [],
  permissionsLoading: false,
  permissionsLoaded: false,
  users: [],
  usersLoading: false,
  usersLoaded: false,

  /* modal */
  modal:       null,         // active modal name, or null
  modalData:   {},           // arbitrary payload for the open modal

  /* booking flow */
  bStep:       1,
  bData:       {},

  /* filters */
  fGender:     'All',
  fType:       'All',
  fSearch:     '',
  fPriceMin:   PRICE_RANGE.min,
  fPriceMax:   PRICE_RANGE.max,
  fSemester:   'All',

  /* shortlist (hostel IDs) */
  shortlist:   [],

  /* active tab on My Bookings page */
  bookingsTab: 'search',     // 'search' | 'shortlist'

  /* loading state (for skeleton screens) */
  loading:     true,

  /* image upload staging */
  pendingImg:  null,
  isImageRemoved: false,
  /** { dataUrl, base64, filename } after user picks a room photo in Add/Edit Room */
  pendingRoomImage: null,
  /* camera capture staging */
  camStream:    null,
  camTarget:    'hostel',    // 'hostel' | 'room'
  isCaptured:   false,
  capturedImg:  null,

  /* admin */
  expandedHostels: [],       // array of hostel IDs currently expanded in dashboard
  toast:       null,         // { msg, type } or null
  successMsg:  '',
};

/* ── Render callback registry ────────────────────────────────────────────── */
let _renderFn = null;

/** Called once by app.js to register the render function */
export function registerRenderer(fn) {
  _renderFn = fn;
}

/* ── setState ────────────────────────────────────────────────────────────── */
/**
 * Merge partial state updates and trigger a re-render.
 * Resets the session idle timer on every user interaction.
 */
export function setState(patch) {
  Object.assign(state, patch);
  touchSession();
  if (_renderFn) _renderFn();
}
