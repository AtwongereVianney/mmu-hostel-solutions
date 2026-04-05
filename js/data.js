/**
 * data.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: static seed data and app-wide constants.
 * No business logic, no DOM manipulation, no security code lives here.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { hashPassword } from './security.js';

/* ── App-wide constants ───────────────────────────────────────────────────── */
export const APP_NAME    = 'MMU Hostel Booking System';
export const APP_VERSION = '3.0.0';

/** Promise resolves to the SHA-256 hash of the admin password */
export const ADMIN_PASS_HASH = hashPassword('admin123');

/** Allowed navigation views (open-redirect guard) */
export const ALLOWED_VIEWS = Object.freeze([
  'home', 'hostels', 'hostelDetail', 'admin', 'myBookings', 'security',
]);

/** Room types */
export const ROOM_TYPES = Object.freeze(['Single', 'Double', 'Triple']);

/** Floor options */
export const FLOOR_OPTIONS = Object.freeze(['Ground', '1st', '2nd', '3rd']);

/** Gender options for hostels */
export const GENDER_OPTIONS = Object.freeze(['Mixed', 'Male', 'Female']);

/** Semesters available for booking */
export const SEMESTERS = Object.freeze([
  'Semester 1 2025/26',
  'Semester 2 2025/26',
  'Semester 1 2026/27',
  'Semester 2 2026/27',
]);

/** Year-of-study options */
export const STUDY_YEARS = Object.freeze([
  'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Postgraduate',
]);

/* ── Seed data (used only when localStorage is empty) ────────────────────── */
export const SEED_HOSTELS = [
  {
    id: 1,
    name: 'Rwenzori Hall',
    gender: 'Mixed',
    distance: '0.3 km from Main Gate',
    description: 'Modern hall with Rwenzori mountain views, 24/7 security, Wi-Fi and clean water supply.',
    image: null,
    emoji: '🏢',
    color: '#1a5c38',
    location: {
      address: 'Along Kibundaire Road, Fort Portal City',
      lat: '0.6591',
      lng: '30.2752',
    },
    amenities: ['Wi-Fi', 'Security', 'Water', 'Electricity', 'Laundry'],
    rooms: [
      { id: 101, number: 'R101', type: 'Single', price: 450000, status: 'available', floor: '1st' },
      { id: 102, number: 'R102', type: 'Double', price: 300000, status: 'available', floor: '1st' },
      { id: 103, number: 'R103', type: 'Single', price: 450000, status: 'booked',    floor: '1st', bookedBy: 'John Doe',    regNo: '2026/U/MMU/CCS/0000001' },
      { id: 104, number: 'R201', type: 'Triple', price: 220000, status: 'available', floor: '2nd' },
      { id: 105, number: 'R202', type: 'Double', price: 300000, status: 'booked',    floor: '2nd', bookedBy: 'Mary Tendo',  regNo: '2026/U/MMU/BIT/0000047' },
    ],
  },
  {
    id: 2,
    name: 'Saaka Hostel',
    gender: 'Female',
    distance: '0.5 km from Main Gate',
    description: 'Quiet female-only hostel near the library, excellent study environment.',
    image: null,
    emoji: '🏠',
    color: '#c9961a',
    location: {
      address: 'Saaka Campus Road, Fort Portal City',
      lat: '0.6620',
      lng: '30.2650',
    },
    amenities: ['Wi-Fi', 'Security', 'Water', 'Electricity', 'Study Room'],
    rooms: [
      { id: 201, number: 'S101', type: 'Single', price: 500000, status: 'available', floor: '1st' },
      { id: 202, number: 'S102', type: 'Double', price: 320000, status: 'available', floor: '1st' },
      { id: 203, number: 'S103', type: 'Single', price: 500000, status: 'booked',    floor: '1st', bookedBy: 'Grace Asiimwe', regNo: '2026/U/MMU/ENG/0000112' },
    ],
  },
  {
    id: 3,
    name: 'Tooro Block',
    gender: 'Male',
    distance: '0.8 km from Main Gate',
    description: 'Affordable male hostel with sports facilities and a friendly atmosphere.',
    image: null,
    emoji: '🏗️',
    color: '#2d7a4f',
    location: {
      address: 'Fort Portal–Kasese Road, Fort Portal City',
      lat: '0.6560',
      lng: '30.2800',
    },
    amenities: ['Security', 'Water', 'Electricity', 'Parking', 'Kitchen'],
    rooms: [
      { id: 301, number: 'T101', type: 'Triple', price: 200000, status: 'available', floor: '1st' },
      { id: 302, number: 'T102', type: 'Double', price: 270000, status: 'available', floor: '1st' },
      { id: 303, number: 'T103', type: 'Triple', price: 200000, status: 'booked',    floor: '1st', bookedBy: 'Peter Mugisha', regNo: '2026/U/MMU/BBA/0000089' },
    ],
  },
];
