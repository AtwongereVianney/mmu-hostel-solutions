/**
 * js/handlers/index.js  –  ALL Business Logic & Action Handlers
 * ═══════════════════════════════════════════════════════════════════════════
 * Booking.com upgrades added:
 *   • toggleShortlist(hostelId)  — save/remove from wishlist
 *   • downloadBookingSlip(id)    — open printable booking receipt
 *   • setRating(hostelId, rating) — admin sets star rating
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { state, setState, hostels, bookings, setBookings } from '../state.js';
import { saveData, loadData, createUser, updateUserStatus, deleteUser, deleteHostel, deleteRoom, deleteBooking, loadUsers, loadRoles, loadPermissions, createRole, createPermission, updateUserAccess, saveUserProfile, seedDefaultPermissions, assignHostelOwner, loginUser, loadUserById, sendApprovedBookingCredentials, saveSystemSettings }  from '../storage.js';

import { showToast } from '../components/toast.js';
import {
  sanitize, validate, hashPassword,
  verifyCsrfToken,
  createSession, destroySession,
  recordFailedLogin, resetBruteForce, isLoginLocked, loginDelay, getBruteForceState,
  auditLog, canBook, countBooking,
  validateImageFile, safeImgSrc,
} from '../security.js';
import { ADMIN_PASS_HASH } from '../data.js';
import { getHostel, makeId, today, escapeHtml, bookingCardHtml, formatPrice } from '../utils.js';
import { GENDER_OPTIONS, ROOM_TYPES, FLOOR_OPTIONS } from '../data.js';

/* ── Private helper: show a field-level error ─────────────────────────── */
function _fieldErr(elId, msg) {
  const el = typeof elId === 'string' ? document.getElementById(elId) : elId;
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hasPermission(permission) {
  if (state.userRole === 'admin') return true;
  const perms = state.userPermissions || {};
  return !!perms[permission] || !!perms.system_admin;
}

function canManageHostel(hostelId) {
  if (state.userRole === 'admin') return true;
  const id = Number(hostelId);
  return Array.isArray(state.assignedHostelIds) && state.assignedHostelIds.some(hid => Number(hid) === id);
}

let _lastAccessSyncAt = 0;
async function ensureLiveAccessSync() {
  // Admin is always full-access, no sync needed.
  if (state.userRole === 'admin') return true;
  if (!state.userId) return true;

  const now = Date.now();
  // Keep this lightweight: at most one refresh every 5 seconds.
  if (now - _lastAccessSyncAt < 5000) return true;
  _lastAccessSyncAt = now;

  const user = await loadUserById(state.userId);
  if (!user) return true;

  if (user.status === 'suspended') {
    destroySession();
    setState({ adminMode: false, adminUser: '', userId: null, userRole: '', userPermissions: {}, assignedHostelIds: [], view: 'home' });
    showToast('Your account was suspended. Please contact admin.', 'error');
    return false;
  }

  setState({
    userRole: user.role || state.userRole,
    userPermissions: user.permissions || {},
    assignedHostelIds: Array.isArray(user.assigned_hostel_ids) ? user.assigned_hostel_ids : [],
  });
  return true;
}

/* ════════════════════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════════════════════ */
export async function doLogin() {
  const lk = isLoginLocked();
  if (lk.locked) { showToast('Account locked. Try again later.', 'error'); return; }

  const csrf = document.getElementById('lcsrf')?.value ?? '';
  if (!verifyCsrfToken(csrf)) { showToast('Invalid security token — please refresh.', 'error'); return; }

  const username = sanitize(document.getElementById('aU')?.value ?? '', 30);
  const password = document.getElementById('aP')?.value ?? '';

  if (!username || !password) { _fieldErr('lErr', 'Please enter username and password.'); return; }

  const bfSt = getBruteForceState();
  await new Promise(r => setTimeout(r, loginDelay(bfSt.n ?? 0)));

  const btn = document.getElementById('lBtn');
  if (btn) btn.disabled = true;

  const inputHash  = await hashPassword(password);
  const storedHash = await ADMIN_PASS_HASH;

  if (username === 'admin' && inputHash === storedHash) {
    resetBruteForce();
    createSession();
    await auditLog('ADMIN_LOGIN', 'Admin authenticated successfully');
    setState({
      adminMode: true,
      adminUser: username,
      userId: 0,
      userEmail: '',
      userRole: 'admin',
      userPermissions: { system_admin: true },
      assignedHostelIds: [],
      modal: null,
      view: 'admin'
    });
    showToast('Welcome, Admin!');
  } else {
    try {
      const res = await loginUser(username, password);
      const user = res?.user ?? null;
      if (res?.success && user && ['admin', 'hostel_owner', 'student'].includes(user.user_type)) {
        resetBruteForce();
        createSession();
        await auditLog('USER_LOGIN', `User authenticated: ${user.email} (${user.user_type})`);
        setState({
          adminMode: user.user_type !== 'student',
          adminUser: user.name || user.email,
          userId: Number(user.id) || null,
          userEmail: user.email || '',
          userRole: user.user_type,
          userPermissions: user.permissions || {},
          assignedHostelIds: Array.isArray(user.assigned_hostel_ids) ? user.assigned_hostel_ids : [],
          modal: null,
          view: user.user_type === 'student' ? 'studentDashboard' : 'admin',
        });
        showToast(`Welcome, ${user.name || 'User'}!`);
        return;
      }
    } catch (e) {}

    const s    = recordFailedLogin();
    await auditLog('LOGIN_FAIL', `Failed login attempt for: ${username}`);
    const left = Math.max(0, 5 - (s.n ?? 0));
    const msg  = s.until
      ? '🔒 Too many failed attempts. Locked for 15 minutes.'
      : `Invalid credentials. ${left} attempt(s) remaining.`;
    _fieldErr('lErr', msg);
    if (btn) btn.disabled = false;
    setState({});
  }
}

export async function doLogout() {
  destroySession();
  await auditLog('ADMIN_LOGOUT', 'Admin logged out');
  setState({ adminMode: false, adminUser: '', userId: null, userEmail: '', userRole: '', userPermissions: {}, assignedHostelIds: [], view: 'home' });
  showToast('Logged out successfully.');
}

/**
 * Save user profile changes (name, email, phone, password)
 */
export async function saveProfile() {
  const name  = sanitize(document.getElementById('profName')?.value?.trim() ?? '', 100);
  const email = (document.getElementById('profEmail')?.value ?? '').trim().toLowerCase();
  const phone = sanitize(document.getElementById('profPhone')?.value?.trim() ?? '', 20);
  const pwd   = document.getElementById('profPass')?.value ?? '';

  if (!name)  { showToast('Full name is required.', 'error'); return; }
  if (!email) { showToast('Email address is required.', 'error'); return; }
  if (!validate('email', email)) { showToast('Invalid email format.', 'error'); return; }
  if (pwd && pwd.length < 6) { showToast('New password must be at least 6 characters.', 'error'); return; }

  const btn = document.querySelector('button[onclick="App.saveProfile()"]');
  if (btn) btn.disabled = true;

  try {
    const payload = { name, email, phone };
    if (pwd) payload.password = pwd;

    const res = await saveUserProfile(state.userId, payload);
    if (!res || !res.success) {
      showToast(res?.error || 'Could not save profile changes.', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    await auditLog('PROFILE_UPDATED', `User #${state.userId} updated profile particulars.`);
    
    // Update local state
    setState({
      adminUser: name,
      userEmail: email,
      // If we added userPhone to state, we'd update it here too.
    });

    showToast('Profile updated successfully!');
    if (pwd) showToast('Password changed.', 'info');
    
    // Refresh user data in case of other changes
    await ensureUsersLoaded(true);
    
    // Redirect home or stay on profile
    App.go('home');
    
  } catch (err) {
    showToast('Network error while saving profile.', 'error');
    if (btn) btn.disabled = false;
  }
}

export async function doAddManager() {
  const name = sanitize(document.getElementById('mN')?.value ?? '', 60);
  const email = sanitize(document.getElementById('mE')?.value ?? '', 80);
  const phone = sanitize(document.getElementById('mPh')?.value ?? '', 20);
  let password = document.getElementById('mP')?.value ?? '';
  const roleIdRaw = document.getElementById('mRole')?.value ?? '';
  const roleId = roleIdRaw ? parseInt(roleIdRaw, 10) : null;
  const userType = (document.getElementById('mUserType')?.value ?? 'hostel_owner').trim();
  const permissions = {};
  for (const p of (state.permissions || [])) {
    permissions[p.name] = !!document.getElementById(`mPerm_${p.id}`)?.checked;
  }
  if (Object.keys(permissions).length === 0) {
    permissions.view_hostels = !!document.getElementById('mPermDefaultViewHostels')?.checked;
    permissions.edit_hostel = !!document.getElementById('mPermDefaultEditHostel')?.checked;
    permissions.manage_rooms = !!document.getElementById('mPermDefaultManageRooms')?.checked;
    permissions.view_bookings = !!document.getElementById('mPermDefaultViewBookings')?.checked;
    permissions.manage_bookings = !!document.getElementById('mPermDefaultManageBookings')?.checked;
  }
  
  const assignedHostelNodes = document.getElementById('mAssignedHostels')?.querySelectorAll('option:checked');
  const assigned_hostel_ids = Array.from(assignedHostelNodes || []).map(o => parseInt(o.value, 10)).filter(id => !isNaN(id));

  const errEl = document.getElementById('mErr');
  const btn = document.getElementById('mBtn');

  if (!name) {
    _fieldErr(errEl, 'Name is required.');
    return;
  }
  if (!email) {
    _fieldErr(errEl, 'Email is required.');
    return;
  }
  if (!validate('email', email)) {
    _fieldErr(errEl, 'Invalid email format.');
    return;
  }
  if (password && password.length < 6) {
    _fieldErr(errEl, 'Password must be at least 6 characters, or leave blank to auto-generate.');
    return;
  }
  if (!password) {
    password = `MMU${Math.random().toString(36).slice(-6)}!`;
  }

  if (btn) btn.disabled = true;
  try {
    const res = await createUser({
      name,
      email,
      phone,
      password,
      role: userType || 'hostel_owner',
      role_id: Number.isInteger(roleId) && roleId > 0 ? roleId : null,
      business_id: 1,
      branch_id: 1,
      permissions,
      assigned_hostel_ids,
    });

    if (!res || !res.success) {
      const msg = res?.error || 'Could not create account.';
      _fieldErr(errEl, msg);
      if (btn) btn.disabled = false;
      return;
    }

    await auditLog('USER_CREATED', `Created user: ${email} (${userType || 'hostel_owner'})`);
    showToast('User account created.');
    if ((document.getElementById('mP')?.value ?? '') === '') {
      showToast(`Temporary password generated: ${password}`, 'warn');
    }
    await ensureManagersLoaded(true);
    setState({ modal: null, adminTab: 'managers' });
  } catch (e) {
    _fieldErr(errEl, 'Network error while creating account.');
    if (btn) btn.disabled = false;
  }
}

export async function doUpdateUserStatus(userId, status) {
  if (!userId || !['active', 'suspended'].includes(status)) {
    showToast('Invalid status change request.', 'error');
    return;
  }
  const res = await updateUserStatus(userId, status);
  if (!res || !res.success) {
    showToast(res?.error || 'Failed to update user status.', 'error');
    return;
  }
  await auditLog('USER_STATUS_CHANGED', `Set user #${userId} to ${status}`);
  showToast(`User ${status === 'active' ? 'activated' : 'suspended'}.`);
  await ensureManagersLoaded(true);
  await ensureUsersLoaded(true);
  setState({});
}

export async function doDeleteManager(userId) {
  if (!userId) return;
  const res = await deleteUser(userId);
  if (!res || !res.success) {
    showToast(res?.error || 'Failed to delete manager.', 'error');
    return;
  }
  await auditLog('USER_DELETED', `Deleted manager #${userId}`);
  showToast('Manager account deleted.');
  await ensureManagersLoaded(true);
  setState({});
}

export async function doEditManager() {
  if (!(await ensureLiveAccessSync())) return;
  const id    = parseInt(document.getElementById('eMgrId')?.value ?? '0', 10);
  const name  = sanitize(document.getElementById('eMgrName')?.value?.trim() ?? '');
  const email = (document.getElementById('eMgrEmail')?.value ?? '').trim().toLowerCase();
  const phone = sanitize(document.getElementById('eMgrPhone')?.value?.trim() ?? '');
  const roleId = parseInt(document.getElementById('eMgrRole')?.value ?? '0', 10) || null;
  const pwd   = document.getElementById('eMgrPwd')?.value ?? '';

  const errEl = document.getElementById('eMgrErr');
  const btn   = document.getElementById('eMgrBtn');

  if (!id)    { _fieldErr(errEl, 'Invalid manager.'); return; }
  if (!name)  { _fieldErr(errEl, 'Full name is required.'); return; }
  if (!email) { _fieldErr(errEl, 'Email is required.'); return; }
  if (!validate('email', email)) { _fieldErr(errEl, 'Invalid email format.'); return; }
  if (pwd && pwd.length < 6) { _fieldErr(errEl, 'New password must be at least 6 characters.'); return; }

  // Collect permissions
  const permissions = {};
  (state.permissions || []).forEach(p => {
    permissions[p.name] = !!document.getElementById(`eMgrPerm_${p.id}`)?.checked;
  });
  if (Object.keys(permissions).length === 0) {
    ['view_hostels','edit_hostel','manage_rooms','view_bookings','manage_bookings'].forEach(k => {
      permissions[k] = !!document.getElementById(`eMgrPermDef_${k}`)?.checked;
    });
  }

  // Collect hostel assignments
  const hostelNodes = document.getElementById('eMgrHostels')?.querySelectorAll('option:checked');
  const assigned_hostel_ids = Array.from(hostelNodes || []).map(o => parseInt(o.value, 10)).filter(id => !isNaN(id));

  if (btn) btn.disabled = true;
  try {
    const payload = { id, name, email, phone, role_id: roleId, permissions, assigned_hostel_ids };
    if (pwd) payload.password = pwd;

    const res = await updateUserAccess(id, payload);
    if (!res || !res.success) {
      _fieldErr(errEl, res?.error || 'Could not update manager.');
      if (btn) btn.disabled = false;
      return;
    }
    await auditLog('USER_UPDATED', `Updated manager #${id} (${email})`);
    showToast('Manager updated successfully.');
    await ensureManagersLoaded(true);
    setState({ modal: null, adminTab: 'managers' });
  } catch (err) {
    _fieldErr(errEl, 'Network error while saving.');
    if (btn) btn.disabled = false;
  }
}


export async function ensureManagersLoaded(force = false) {
  if (state.managersLoading) return;
  if (!force && state.managersLoaded) return;

  setState({ managersLoading: true });
  try {
    const users = await loadUsers('hostel_owner');
    setState({
      managers: Array.isArray(users) ? users : [],
      managersLoading: false,
      managersLoaded: true,
    });
  } catch (e) {
    setState({ managersLoading: false, managersLoaded: true });
    showToast('Failed to load managers from database.', 'error');
  }
}

export async function ensureRolesLoaded(force = false) {
  if (state.rolesLoading) return;
  if (!force && state.rolesLoaded) return;
  setState({ rolesLoading: true });
  try {
    const roles = await loadRoles();
    setState({
      roles: Array.isArray(roles) ? roles : [],
      rolesLoading: false,
      rolesLoaded: true,
    });
  } catch (e) {
    setState({ rolesLoading: false, rolesLoaded: true });
    showToast('Failed to load roles.', 'error');
  }
}

export async function ensurePermissionsLoaded(force = false) {
  if (state.permissionsLoading) return;
  if (!force && state.permissionsLoaded) return;
  setState({ permissionsLoading: true });
  try {
    const perms = await loadPermissions();
    setState({
      permissions: Array.isArray(perms) ? perms : [],
      permissionsLoading: false,
      permissionsLoaded: true,
    });
  } catch (e) {
    setState({ permissionsLoading: false, permissionsLoaded: true });
    showToast('Failed to load permissions.', 'error');
  }
}

export async function ensureUsersLoaded(force = false) {
  if (state.usersLoading) return;
  if (!force && state.usersLoaded) return;
  setState({ usersLoading: true });
  try {
    const users = await loadUsers('all');
    setState({
      users: Array.isArray(users) ? users : [],
      usersLoading: false,
      usersLoaded: true,
    });
  } catch (e) {
    setState({ usersLoading: false, usersLoaded: true });
    showToast('Failed to load users.', 'error');
  }
}

export async function doAddRole() {
  const name = sanitize(document.getElementById('roleName')?.value ?? '', 50);
  if (!name) {
    showToast('Role name is required.', 'error');
    return;
  }
  const res = await createRole(name);
  if (!res || !res.success) {
    showToast(res?.error || 'Could not create role.', 'error');
    return;
  }
  await auditLog('ROLE_CREATED', `Created role: ${name}`);
  document.getElementById('roleName').value = '';
  await ensureRolesLoaded(true);
  showToast('Role created.');
}

export async function doAddPermission() {
  const name = sanitize(document.getElementById('permName')?.value ?? '', 50);
  if (!name) {
    showToast('Permission name is required.', 'error');
    return;
  }
  const res = await createPermission(name);
  if (!res || !res.success) {
    showToast(res?.error || 'Could not create permission.', 'error');
    return;
  }
  await auditLog('PERMISSION_CREATED', `Created permission: ${name}`);
  document.getElementById('permName').value = '';
  await ensurePermissionsLoaded(true);
  showToast('Permission created.');
}

export async function doSeedPermissions() {
  const res = await seedDefaultPermissions(1, 1);
  if (!res || !res.success) {
    showToast(res?.error || 'Failed to seed permissions.', 'error');
    return;
  }
  await auditLog('PERMISSIONS_SEEDED', `Seeded default permissions. Added: ${res.added ?? 0}`);
  await ensurePermissionsLoaded(true);
  showToast(`Permissions ready. Added ${res.added ?? 0}, skipped ${res.skipped_existing ?? 0}.`);
}

export async function doAssignUserAccess(userId) {
  const roleIdRaw = document.getElementById(`uRole_${userId}`)?.value ?? '';
  const userType = document.getElementById(`uType_${userId}`)?.value ?? 'student';
  const permMap = {};
  for (const p of (state.permissions || [])) {
    const key = `uPerm_${userId}_${p.id}`;
    permMap[p.name] = !!document.getElementById(key)?.checked;
  }
  const role_id = roleIdRaw ? parseInt(roleIdRaw, 10) : null;
  const res = await updateUserAccess(userId, { role_id, user_type: userType, permissions: permMap });
  if (!res || !res.success) {
    showToast(res?.error || 'Failed to assign access.', 'error');
    return;
  }
  await auditLog('USER_ACCESS_UPDATED', `Updated role/permissions for user #${userId}`);
  await ensureUsersLoaded(true);
  await ensureManagersLoaded(true);
  showToast('User access updated.');
}

export async function doAssignHostelManager(hostelId) {
  if (!(await ensureLiveAccessSync())) return;
  if (state.userRole !== 'admin') {
    showToast('Only admin can assign hostel managers.', 'error');
    return;
  }
  const raw = document.getElementById(`hostelOwner_${hostelId}`)?.value ?? '';
  const ownerId = parseInt(raw, 10);
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    showToast('Select a manager first.', 'error');
    return;
  }

  const res = await assignHostelOwner(hostelId, ownerId);
  if (!res || !res.success) {
    showToast(res?.error || 'Failed to assign manager.', 'error');
    return;
  }

  const hostel = hostels.find(h => Number(h.id) === Number(hostelId));
  if (hostel) hostel.owner_id = ownerId;
  await auditLog('HOSTEL_OWNER_ASSIGNED', `Assigned hostel #${hostelId} to manager #${ownerId}`);
  setState({});
  showToast('Hostel assigned to manager.');
}

/* ── Search ────────────────────────────────────────────────────────────── */
/**
 * Intelligent search: redirects to detail page if a single/exact match is found,
 * otherwise shows the list with filters applied.
 */
export function doSearchHostels() {
  const query = (state.fSearch || '').trim().toLowerCase();
  if (!query) {
    App.go('hostels');
    return;
  }

  // Find matches using simple case-insensitive substring search
  const matches = hostels.filter(h => {
    const nameMatch = h.name.toLowerCase().includes(query);
    const genderOk = state.fGender === 'All' || h.gender === state.fGender || h.gender === 'Mixed';
    return nameMatch && genderOk;
  });

  if (matches.length === 1) {
    // Single match found – go directly to details
    App.go('hostelDetail', { selectedHostelId: matches[0].id });
    showToast(`Found: ${matches[0].name}`, 'success');
  } else if (matches.length > 1) {
    // Multiple matches – go to list view with filter applied
    App.go('hostels');
  } else {
    // No matches
    showToast(`No hostels found matching "${query}"`, 'warn');
    App.go('hostels');
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   HOSTEL CRUD
════════════════════════════════════════════════════════════════════════════ */
function _readHostelForm() {
  return {
    csrf:   document.getElementById('hcsrf')?.value  ?? '',
    editId: document.getElementById('hEditId')?.value ?? '',
    name:   sanitize(document.getElementById('hN')?.value    ?? ''),
    gender: document.getElementById('hG')?.value    ?? '',
    dist:   sanitize(document.getElementById('hD')?.value    ?? ''),
    desc:   sanitize(document.getElementById('hDesc')?.value ?? '', 250),
    amen:   sanitize(document.getElementById('hAm')?.value   ?? '', 200),
    addr:   sanitize(document.getElementById('hAddr')?.value ?? '', 120),
    lat:    (document.getElementById('hLat')?.value ?? '').trim(),
    lng:    (document.getElementById('hLng')?.value ?? '').trim(),
    rating: parseFloat(document.getElementById('hRating')?.value ?? '0') || 0,
    mgr:    sanitize(document.getElementById('hMgr')?.value ?? '').trim(),
  };
}

function _validateHostelForm(f) {
  if (!verifyCsrfToken(f.csrf))            { _fieldErr('hErr','Invalid security token.'); return false; }
  if (!f.name || f.name.length < 2)        { _fieldErr('hErr','Hostel name is required (min 2 chars).'); return false; }
  if (!GENDER_OPTIONS.includes(f.gender))  { _fieldErr('hErr','Please select a valid gender.'); return false; }
  if (!f.dist)                             { _fieldErr('hErr','Distance from campus is required.'); return false; }
  if (!f.addr)                             { _fieldErr('hErr','Full address is required.'); return false; }
  if (!f.lat || !validate('lat', f.lat))   { _fieldErr('hErr','Valid latitude required (e.g. 0.6591).'); return false; }
  if (!f.lng || !validate('lng', f.lng))   { _fieldErr('hErr','Valid longitude required (e.g. 30.2752).'); return false; }
  if (f.rating < 0 || f.rating > 5)       { _fieldErr('hErr','Rating must be between 0 and 5.'); return false; }
  if (f.mgr && !validate('phone', f.mgr)) { _fieldErr('hErr','Invalid manager phone number.'); return false; }
  return true;
}

export async function doAddHostel() {
  if (!(await ensureLiveAccessSync())) return;
  if (!hasPermission('create_hostel')) { showToast('You do not have permission to create hostels.', 'error'); return; }
  const f = _readHostelForm();
  if (!_validateHostelForm(f)) return;

  const amenities = f.amen
    ? f.amen.split(',').map(a => sanitize(a.trim(), 30)).filter(Boolean)
    : ['Security', 'Water'];

  const hostel = {
    id: makeId(), name: f.name, gender: f.gender,
    distance: f.dist, description: f.desc || 'No description provided.',
    color: '#1a5c38',
    rating: f.rating || null,
    managerPhone: f.mgr || null,
    location: { address: f.addr, lat: f.lat, lng: f.lng },
    amenities, rooms: [],
  };

  if (state.pendingImg) {
    hostel.image = state.pendingImg; // Set for immediate UI preview
    hostel.image_upload = {
      base64: state.pendingImg.startsWith('data:') ? state.pendingImg.split(',')[1] : state.pendingImg,
      filename: `hostel_${Date.now()}.jpg`
    };
  }

  hostels.push(hostel);

  await saveData();
  await auditLog('HOSTEL_CREATED', `Admin added hostel: ${f.name}`);
  setState({ modal: null, pendingImg: null });
  showToast(`"${f.name}" added successfully!`);
}

export async function doEditHostel() {
  if (!(await ensureLiveAccessSync())) return;
  const targetId = parseInt(document.getElementById('hEditId')?.value ?? '0', 10);
  if (!hasPermission('edit_hostel') || !canManageHostel(targetId)) { showToast('You cannot edit this hostel.', 'error'); return; }
  const f = _readHostelForm();
  if (!_validateHostelForm(f)) return;

  const h = getHostel(parseInt(f.editId, 10));
  if (!h) { showToast('Hostel not found.', 'error'); return; }

  Object.assign(h, {
    name: f.name, gender: f.gender, distance: f.dist,
    description: f.desc || h.description,
    rating: f.rating || h.rating,
    managerPhone: f.mgr || h.managerPhone,
    location: { address: f.addr, lat: f.lat, lng: f.lng },
    amenities: f.amen
      ? f.amen.split(',').map(a => sanitize(a.trim(), 30)).filter(Boolean)
      : h.amenities,
  });

  if (state.isImageRemoved) {
    h.image = null;
    h.delete_images = true; // Signal to backend
  } else if (state.pendingImg) {
    h.image = state.pendingImg; // Set for immediate UI preview
    h.image_upload = {
      base64: state.pendingImg.startsWith('data:') ? state.pendingImg.split(',')[1] : state.pendingImg,
      filename: `hostel_${Date.now()}.jpg`
    };
  }

  await saveData();
  await auditLog('HOSTEL_UPDATED', `Admin updated hostel: ${f.name}`);
  setState({ modal: null, pendingImg: null });
  showToast(`"${f.name}" updated!`);
}

export async function doDelHostel() {
  if (!(await ensureLiveAccessSync())) return;
  const id = state.modalData.hostelId;
  if (!hasPermission('delete_hostel') || !canManageHostel(id)) { showToast('You cannot delete this hostel.', 'error'); return; }
  const h  = getHostel(id);
  if (!h) return;
  
  const res = await deleteHostel(id);
  if (!res || !res.success) {
    showToast(res?.error || 'Failed to delete hostel via API.', 'error');
    return;
  }

  const idx = hostels.indexOf(h);
  if (idx !== -1) hostels.splice(idx, 1);
  setBookings(bookings.filter(b => b.hostelId !== id));
  
  await saveData(); // To sync localStorage
  await auditLog('HOSTEL_DELETED', `Admin deleted hostel: ${h.name}`);
  setState({ modal: null });
  showToast(`"${h.name}" deleted.`, 'warn');
}

/* ════════════════════════════════════════════════════════════════════════════
   ROOM CRUD
════════════════════════════════════════════════════════════════════════════ */
function _readRoomForm() {
  return {
    csrf:   document.getElementById('rcsrf')?.value ?? '',
    num:    sanitize((document.getElementById('rN')?.value ?? '').toUpperCase()),
    type:   document.getElementById('rT')?.value  ?? '',
    floor:  document.getElementById('rF')?.value  ?? '',
    price:  parseInt(document.getElementById('rP')?.value ?? '0', 10),
    fee:    parseInt(document.getElementById('rCF')?.value ?? '0', 10),
    status: document.getElementById('rS')?.value  ?? 'available',
  };
}

export function onRoomImagePick(ev) {
  const file = ev?.target?.files?.[0];
  if (!file) {
    setState({ pendingRoomImage: null });
    return;
  }
  const err = validateImageFile(file);
  if (err) {
    showToast(err, 'error');
    ev.target.value = '';
    setState({ pendingRoomImage: null });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || '');
    const comma = dataUrl.indexOf(',');
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
    setState({
      pendingRoomImage: {
        dataUrl,
        base64,
        filename: file.name || 'room.jpg',
      },
    });
  };
  reader.readAsDataURL(file);
}

export function clearRoomImagePick() {
  const inp = document.getElementById('rImg');
  if (inp) inp.value = '';
  setState({ pendingRoomImage: null });
}

function _validateRoomForm(f) {
  if (!verifyCsrfToken(f.csrf))            { _fieldErr('rErr','Invalid security token.'); return false; }
  if (!validate('rnum', f.num))            { _fieldErr('rErr','Invalid room number — alphanumeric only, max 10 chars.'); return false; }
  if (!ROOM_TYPES.includes(f.type))        { _fieldErr('rErr','Invalid room type.'); return false; }
  if (!FLOOR_OPTIONS.includes(f.floor))    { _fieldErr('rErr','Invalid floor.'); return false; }
  if (!f.price||f.price<50000||f.price>2000000) { _fieldErr('rErr','Price must be UGX 50,000 – 2,000,000.'); return false; }
  if (f.fee < 0 || f.fee > f.price) { _fieldErr('rErr','Confirmation fee must be between 0 and the room price.'); return false; }
  if (!['available','pending','booked'].includes(f.status)) { _fieldErr('rErr','Invalid status.'); return false; }
  return true;
}

export async function doAddRoom() {
  if (!(await ensureLiveAccessSync())) return;
  if (!hasPermission('create_room') && !hasPermission('manage_rooms')) { showToast('You do not have permission to add rooms.', 'error'); return; }
  const f = _readRoomForm();
  if (!_validateRoomForm(f)) return;
  const h = getHostel(state.modalData.hostelId);
  if (!canManageHostel(h?.id)) { showToast('You cannot manage rooms for this hostel.', 'error'); return; }
  if (!h) { showToast('Hostel not found.', 'error'); return; }
  if (h.rooms.some(r => r.number === f.num)) { _fieldErr('rErr', `Room ${f.num} already exists in this hostel.`); return; }
  const pending = state.pendingRoomImage;
  const room = { id: makeId(), number: f.num, type: f.type, floor: f.floor, price: f.price, confirmationFee: f.fee, status: 'available' };
  if (pending?.base64) {
    room.image_upload = { base64: pending.base64, filename: pending.filename || 'room.jpg' };
  }
  h.rooms.push(room);
  const uploaded = !!pending?.base64;
  await saveData();
  delete room.image_upload;
  if (uploaded) await loadData();
  await auditLog('ROOM_CREATED', `Admin added room ${f.num} to ${h.name}`);
  setState({ modal: null, pendingRoomImage: null });
  showToast(`Room ${f.num} added to ${h.name}!`);
}

export async function doEditRoom() {
  if (!(await ensureLiveAccessSync())) return;
  if (!hasPermission('edit_room') && !hasPermission('manage_rooms')) { showToast('You do not have permission to edit rooms.', 'error'); return; }
  const f    = _readRoomForm();
  if (!_validateRoomForm(f)) return;
  const h    = getHostel(state.modalData.hostelId);
  if (!canManageHostel(h?.id)) { showToast('You cannot manage rooms for this hostel.', 'error'); return; }
  const rIdx = h?.rooms.findIndex(x => x.id === state.modalData.roomId) ?? -1;
  if (!h || rIdx === -1) { showToast('Room not found.', 'error'); return; }
  if (h.rooms.some((r, i) => r.number === f.num && i !== rIdx)) { _fieldErr('rErr', `Room ${f.num} already exists.`); return; }
  const target = h.rooms[rIdx];
  const pending = state.pendingRoomImage;
  Object.assign(target, { number: f.num, type: f.type, floor: f.floor, price: f.price, confirmationFee: f.fee, status: f.status });
  if (f.status === 'available') { delete target.bookedBy; delete target.regNo; }
  if (pending?.base64) {
    target.image_upload = { base64: pending.base64, filename: pending.filename || 'room.jpg' };
  }
  const uploaded = !!pending?.base64;
  await saveData();
  delete target.image_upload;
  if (uploaded) await loadData();
  await auditLog('ROOM_UPDATED', `Admin updated room ${f.num} in ${h.name}`);
  setState({ modal: null, pendingRoomImage: null });
  showToast(`Room ${f.num} updated!`);
}

export async function doDelRoom() {
  if (!(await ensureLiveAccessSync())) return;
  const h = getHostel(state.modalData.hostelId);
  if (!h) return;
  const roomId = state.modalData.roomId;

  if (!hasPermission('delete_room') && !hasPermission('manage_rooms')) { showToast('You do not have permission to delete rooms.', 'error'); return; }
  if (!canManageHostel(h.id)) { showToast('You cannot manage rooms for this hostel.', 'error'); return; }
  
  const r = h.rooms.find(x => x.id === roomId);
  if (!r) return;

  const res = await deleteRoom(roomId);
  if (!res || !res.success) {
    showToast(res?.error || 'Failed to delete room via API.', 'error');
    return;
  }

  h.rooms = h.rooms.filter(x => x.id !== roomId);
  setBookings(bookings.filter(b => !(b.hostelId === h.id && b.roomId === roomId)));
  
  await saveData(); // To sync localStorage
  await auditLog('ROOM_DELETED', `Admin removed room ${r.number} from ${h.name}`);
  setState({ modal: null });
  showToast(`Room ${r.number} removed.`, 'warn');
}

export async function releaseRoom(hostelId, roomId) {
  if (!(await ensureLiveAccessSync())) return;
  if (!hasPermission('release_room') && !hasPermission('manage_rooms')) { showToast('You do not have permission to release rooms.', 'error'); return; }
  if (!canManageHostel(hostelId)) { showToast('You cannot manage this hostel.', 'error'); return; }
  const h = getHostel(hostelId);
  const r = h?.rooms.find(x => x.id === roomId);
  if (!h || !r) return;
  const prev = r.bookedBy;
  r.status = 'available';
  delete r.bookedBy;
  delete r.regNo;
  const bookingsToRemove = bookings.filter(b => Number(b.hostelId) === Number(hostelId) && Number(b.roomId) === Number(roomId));
  for (const b of bookingsToRemove) {
    if (b.id) await deleteBooking(b.id);
  }

  setBookings(bookings.filter(b => !(Number(b.hostelId) === Number(hostelId) && Number(b.roomId) === Number(roomId))));
  await saveData();
  await auditLog('BOOKING_RELEASED', `Room ${r.number} in ${h.name} released (was: ${prev})`);
  setState({});
  showToast(`Room ${r.number} is now available.`);
}

/* ════════════════════════════════════════════════════════════════════════════
   BOOKING FLOW
════════════════════════════════════════════════════════════════════════════ */
export function openBooking(hostelId, roomId) {
  const h = getHostel(hostelId);
  const r = h?.rooms.find(x => x.id === roomId);
  if (!r || r.status !== 'available') { showToast('This room is no longer available.', 'warn'); setState({}); return; }
  if (!canBook()) { showToast('Booking limit reached for this session.', 'error'); return; }
  setState({ modal: 'booking', selH: hostelId, selR: roomId, bStep: 1, bData: {} });
}

export function bStep1() {
  const name  = sanitize(document.getElementById('fN')?.value ?? '');
  const reg   = sanitize((document.getElementById('fR')?.value ?? '').toUpperCase());
  const year  = document.getElementById('fY')?.value ?? '';

  if (!name)                      { _fieldErr('s1e', 'Full name is required.'); return; }
  if (!validate('name', name))    { _fieldErr('s1e', 'Name: letters and spaces only (2–80 chars).'); return; }
  if (!reg)                       { _fieldErr('s1e', 'Registration number is required.'); return; }
  if (!validate('regNo', reg))    { _fieldErr('s1e', 'Invalid format. Use: YYYY/U/MMU/COURSE/STUDENTNUMBER'); return; }
  if (!year)                      { _fieldErr('s1e', 'Please select your year of study.'); return; }

  const dup = bookings.find(b => b.regNo.toUpperCase() === reg && b.hostelId === state.selH);
  if (dup) { _fieldErr('s1e', `Reg ${reg} already has a booking here (Ref #${dup.id}).`); return; }

  document.getElementById('s1e')?.classList.add('hidden');
  Object.assign(state.bData, { studentName: name, regNo: reg, year });
  setState({ bStep: 2 });
}

export function bStep2() {
  const phone   = sanitize(document.getElementById('fPh')?.value ?? '');
  const network = document.getElementById('fNet')?.value ?? '';
  const email   = sanitize(document.getElementById('fE')?.value  ?? '');
  const course  = sanitize(document.getElementById('fC')?.value  ?? '');
  const sem     = document.getElementById('fSm')?.value ?? '';

  if (!phone)                             { _fieldErr('s2e','Phone number is required.'); return; }
  if (!validate('phone', phone))          { _fieldErr('s2e','Invalid phone. Use +256XXXXXXXXX or 07XXXXXXXX.'); return; }
  if (!network)                           { _fieldErr('s2e','Please select a Mobile Network (MTN or Airtel).'); return; }
  if (email && !validate('email', email)) { _fieldErr('s2e','Invalid email format.'); return; }
  if (!course)                            { _fieldErr('s2e','Programme / course is required.'); return; }
  if (!validate('course', course))        { _fieldErr('s2e','Course contains invalid characters.'); return; }
  if (!sem)                               { _fieldErr('s2e','Please select your semester.'); return; }

  document.getElementById('s2e')?.classList.add('hidden');
  Object.assign(state.bData, { phone, network, email, course, semester: sem });
  setState({ bStep: 3 });
}

export async function confirmBooking() {
  const csrf = document.getElementById('bcsrf')?.value ?? '';
  if (!verifyCsrfToken(csrf)) {
    showToast('Security token invalid — refresh the page.', 'error');
    await auditLog('CSRF_REJECT', 'Booking rejected: invalid CSRF token');
    return;
  }
  if (!canBook()) { showToast('Booking rate limit reached.', 'error'); return; }

  const h    = getHostel(state.selH);
  const rIdx = h?.rooms.findIndex(r => r.id === state.selR) ?? -1;
  if (!h || rIdx === -1) { showToast('Room not found.', 'error'); return; }

  // Atomic double-booking check
  if (h.rooms[rIdx].status !== 'available') {
    showToast('Room just booked by someone else. Please choose another.', 'warn');
    setState({ modal: null });
    return;
  }

  const btn = document.getElementById('cbtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  // Mark as pending so manager/admin can review and confirm from dashboard
  h.rooms[rIdx].status   = 'pending';
  h.rooms[rIdx].bookedBy = state.bData.studentName;
  h.rooms[rIdx].regNo    = state.bData.regNo;

  const room = h.rooms[rIdx];
  const randArr = new Uint32Array(1);
  crypto.getRandomValues(randArr);
  const bookingId = 'B' + randArr[0].toString(36).toUpperCase();

  const booking = {
    id:       bookingId,
    hostelId: h.id,
    roomId:   room.id,
    ...state.bData,
    date:     today(),
    status:   'pending',
  };
  bookings.push(booking);

  // Expose bookings globally so slip modal can access them
  window.__mmuBookings__ = bookings;

  // Persist pending booking request
  await saveData();
  countBooking();
  await auditLog('BOOKING_CREATED',
    `Pending booking request for room ${room.number} in ${h.name} by ${booking.studentName} (${booking.regNo})`,
    { ref: bookingId }
  );

  // Notify assigned hostel manager on WhatsApp with booking details.
  const managerPhone = (h.managerPhone || '').replace(/\D/g, '').replace(/^0/, '256');
  if (managerPhone) {
    const waText =
      `New Hostel Booking Request%0A` +
      `Ref: #${bookingId}%0A` +
      `Hostel: ${encodeURIComponent(h.name)}%0A` +
      `Room: ${encodeURIComponent(room.number)} (${encodeURIComponent(room.type || '')})%0A` +
      `Student: ${encodeURIComponent(booking.studentName)}%0A` +
      `Reg No: ${encodeURIComponent(booking.regNo)}%0A` +
      `Phone: ${encodeURIComponent(booking.phone || '')}%0A` +
      `Course: ${encodeURIComponent(booking.course || '')}%0A` +
      `Semester: ${encodeURIComponent(booking.semester || '')}%0A` +
      `Status: pending`;
    window.open(`https://wa.me/${managerPhone}?text=${waText}`, '_blank', 'noopener');
  }

  setState({
    modal:      'success',
    successMsg: `Booking request submitted for ${h.name} Room ${room.number}. Ref: #${bookingId}. It is now pending manager/admin confirmation.`,
    bStep:      1,
    bData:      {},
  });
}

export async function confirmRoomPayment(hostelId, roomId) {
  if (!(await ensureLiveAccessSync())) return;
  if (!hasPermission('confirm_room_payment') && !hasPermission('manage_bookings')) { showToast('You do not have permission to confirm payments.', 'error'); return; }
  if (!canManageHostel(hostelId)) { showToast('You cannot manage this hostel.', 'error'); return; }
  const h = getHostel(hostelId);
  const r = h?.rooms.find(x => x.id === roomId);
  if (!h || !r) return;

  r.status = 'booked';

  // Find associated pending booking
  const b = bookings.find(x => x.hostelId === hostelId && x.roomId === roomId && x.status === 'pending');
  if (b) b.status = 'confirmed';

  window.__mmuBookings__ = bookings;
  await saveData();
  let confirmMsg = `Booking confirmed for Room ${r.number}.`;
  if (b?.email) {
    const notify = await sendApprovedBookingCredentials({
      email: b.email,
      studentName: b.studentName || '',
      regNo: b.regNo || '',
      hostelName: h.name || '',
      roomNumber: r.number || '',
    });
    if (notify?.success) {
      confirmMsg = (notify.email_sent
        ? `Booking approved. Credentials sent to ${b.email}.`
        : `Booking approved. Account ready for ${b.email} (email sending unavailable on server).`
      );
    }
  }
  await auditLog('PAYMENT_CONFIRMED', `Admin confirmed payment for room ${r.number} in ${h.name}`);
  setState({});
  showToast(confirmMsg);
}

export async function resendStudentCredentials(bookingId) {
  if (!(await ensureLiveAccessSync())) return;
  if (!hasPermission('confirm_room_payment') && !hasPermission('manage_bookings')) {
    showToast('You do not have permission to resend credentials.', 'error');
    return;
  }

  const b = bookings.find(x => String(x.id) === String(bookingId));
  if (!b) { showToast('Booking not found.', 'error'); return; }
  if (b.status !== 'confirmed') {
    showToast('Only confirmed bookings can resend credentials.', 'warn');
    return;
  }
  if (!b.email) {
    showToast('Student email missing on booking.', 'error');
    return;
  }

  const h = getHostel(b.hostelId);
  const r = h?.rooms.find(x => x.id === b.roomId);
  const notify = await sendApprovedBookingCredentials({
    email: b.email,
    studentName: b.studentName || '',
    regNo: b.regNo || '',
    hostelName: h?.name || '',
    roomNumber: r?.number || '',
  });
  if (!notify?.success) {
    showToast(notify?.error || 'Failed to resend credentials.', 'error');
    return;
  }
  showToast(notify.email_sent
    ? `Credentials resent to ${b.email}.`
    : `Account refreshed for ${b.email}, but email sending is unavailable on server.`
  );
  await auditLog('STUDENT_CREDENTIALS_RESENT', `Credentials resent for booking #${b.id} to ${b.email}`);
}

/* Student booking lookup */
export function lookupBooking() {
  const raw   = document.getElementById('regIn')?.value?.trim() ?? '';
  const resEl = document.getElementById('bkResult');
  if (!resEl) return;

  if (!raw) {
    resEl.innerHTML = '<p class="text-red-500 text-sm">Please enter your registration number.</p>';
    return;
  }
  if (!validate('regNo', raw)) {
    resEl.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">⚠️ Invalid format. Use: YYYY/U/MMU/COURSE/STUDENTNUMBER</div>`;
    return;
  }

  const found = bookings.filter(b => b.regNo.toLowerCase() === raw.toLowerCase());
  if (found.length) {
    resEl.innerHTML = `<div class="space-y-3">${found.map(bookingCardHtml).join('')}</div>`;
  } else {
    resEl.innerHTML = `<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-700 text-sm">No booking found for <b>${escapeHtml(raw)}</b>.</div>`;
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   SHORTLIST / WISHLIST (Booking.com heart button)
════════════════════════════════════════════════════════════════════════════ */
export function toggleShortlist(hostelId) {
  const current = state.shortlist ?? [];
  const idx     = current.indexOf(hostelId);
  let next;
  if (idx === -1) {
    next = [...current, hostelId];
    showToast('Added to your shortlist! ❤️');
  } else {
    next = current.filter(id => id !== hostelId);
    showToast('Removed from shortlist.', 'warn');
  }
  setState({ shortlist: next });
}

/* ════════════════════════════════════════════════════════════════════════════
   DOWNLOAD BOOKING SLIP
════════════════════════════════════════════════════════════════════════════ */
export function downloadBookingSlip(bookingId) {
  // Open slip in a print-ready window
  const booking = (window.__mmuBookings__ ?? bookings).find(b => b.id === bookingId);
  if (!booking) { showToast('Booking not found.', 'error'); return; }

  const h    = getHostel(booking.hostelId);
  const room = h?.rooms.find(r => r.id === booking.roomId);

  const formatP = n => 'UGX ' + Number(n).toLocaleString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Booking Slip – #${booking.id}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #fff; margin: 0; padding: 2rem; color: #1f2937; }
    .slip { max-width: 480px; margin: 0 auto; border: 2px solid #1a5c38; border-radius: 12px; overflow: hidden; }
    .slip-header { background: linear-gradient(135deg, #0f3520, #1a5c38); color: #fff; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem; }
    .slip-body { padding: 1.25rem 1.5rem; }
    .row { display: flex; justify-content: space-between; padding: .4rem 0; border-bottom: 1px solid #f3f4f6; font-size: .875rem; }
    .row:last-child { border-bottom: none; }
    .key { color: #6b7280; }
    .val { font-weight: 700; text-align: right; }
    .divider { border-top: 2px dashed #d1d5db; margin: .75rem 0; }
    .ref { background: #f0fdf4; border-radius: .5rem; padding: .75rem; text-align: center; margin-top: 1rem; }
    .ref-num { font-size: 1.5rem; font-weight: 800; color: #1a5c38; font-family: monospace; letter-spacing: .1em; }
    .confirmed { color: #16a34a; font-size: .75rem; margin-top: .25rem; }
    @media print { body { padding: 0; } button { display: none; } }
  </style>
</head>
<body>
  <div class="slip">
    <div class="slip-header">
      <div style="font-size:1.1rem;font-weight:800">🏠 MMU Hostel Booking</div>
      <div>
        <div style="font-size:.7rem;opacity:.75;margin-top:.25rem">Mountains of the Moon University · Fort Portal</div>
      </div>
    </div>
    <div class="slip-body">
      <div class="row"><span class="key">Student Name</span><span class="val">${escapeHtml(booking.studentName)}</span></div>
      <div class="row"><span class="key">Reg Number</span><span class="val">${escapeHtml(booking.regNo)}</span></div>
      <div class="row"><span class="key">Course</span><span class="val">${escapeHtml(booking.course)}</span></div>
      <div class="row"><span class="key">Academic Year</span><span class="val">${escapeHtml(booking.year ?? '—')}</span></div>
      <div class="row"><span class="key">Semester</span><span class="val">${escapeHtml(booking.semester ?? '—')}</span></div>
      <div class="row"><span class="key">Phone</span><span class="val">${escapeHtml(booking.phone ?? '—')}</span></div>
      <div class="divider"></div>
      <div class="row"><span class="key">Hostel</span><span class="val">${escapeHtml(h?.name ?? '—')}</span></div>
      <div class="row"><span class="key">Room</span><span class="val">${escapeHtml(room?.number ?? '—')} (${escapeHtml(room?.type ?? '—')})</span></div>
      <div class="row"><span class="key">Floor</span><span class="val">${escapeHtml(room?.floor ?? '—')}</span></div>
      <div class="row"><span class="key">Semester Fee</span><span class="val">${formatP(room?.price ?? 0)}</span></div>
      <div class="row"><span class="key">Confirmation Paid</span><span class="val" style="color:#1a5c38">${formatP(room?.confirmationFee ?? 0)}</span></div>
      <div class="row"><span class="key">Balance on Arrival</span><span class="val" style="color:#c9961a">${formatP((room?.price ?? 0) - (room?.confirmationFee ?? 0))}</span></div>
      <div class="row"><span class="key">Booking Date</span><span class="val">${escapeHtml(booking.date ?? '—')}</span></div>
      <div class="ref">
        <div style="font-size:.65rem;color:#6b7280;margin-bottom:.25rem">BOOKING REFERENCE</div>
        <div class="ref-num">#${escapeHtml(booking.id)}</div>
        <div class="confirmed">✅ CONFIRMED · Paid via Flutterwave</div>
      </div>
    </div>
  </div>
  <p style="text-align:center;margin-top:1.5rem;font-size:.8rem;color:#6b7280">
    Present this slip and your student ID on arrival to collect your room key.
  </p>
  <script>window.print();<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=600,height=750');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    showToast('Please allow popups to download your booking slip.', 'warn');
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   ADMIN: SET HOSTEL STAR RATING
════════════════════════════════════════════════════════════════════════════ */
export async function setRating(hostelId, rating) {
  const h = getHostel(hostelId);
  if (!h) { showToast('Hostel not found.', 'error'); return; }
  if (rating < 0 || rating > 5) { showToast('Rating must be between 0 and 5.', 'error'); return; }
  h.rating = Math.round(rating * 10) / 10; // round to 1 decimal
  await saveData();
  await auditLog('RATING_SET', `Admin set rating ${h.rating} for ${h.name}`);
  setState({});
  showToast(`Rating updated to ${h.rating} ⭐ for ${h.name}.`);
}

/* ════════════════════════════════════════════════════════════════════════════
   IMAGE HANDLERS
════════════════════════════════════════════════════════════════════════════ */
export function handleImgUpload(input) {
  const file   = input?.files?.[0];
  const errEl  = document.getElementById('imgErr');
  const err    = validateImageFile(file);
  if (err) { if (errEl) { errEl.textContent = err; errEl.classList.remove('hidden'); } return; }
  if (errEl) errEl.classList.add('hidden');

  const reader = new FileReader();
  reader.onload = ev => {
    const b64 = ev.target.result;
    if (!safeImgSrc(b64)) {
      if (errEl) { errEl.textContent = 'Invalid image data.'; errEl.classList.remove('hidden'); }
      return;
    }
    state.isImageRemoved = false;
    state.pendingImg = b64;
    const drop = document.getElementById('imgDrop');
    if (drop) {
      drop.innerHTML = `<img src="${b64}" style="max-height:160px;border-radius:.5rem;margin:0 auto;display:block;" alt="Preview"/>
        <div class="text-xs text-gray-500 mt-2">Click to change photo</div>`;
    }
    setState({}); // Reactive update
  };
  reader.readAsDataURL(file);
}

export function handleDrop(ev) {
  ev.preventDefault();
  document.getElementById('imgDrop')?.classList.remove('drag');
  const file = ev.dataTransfer?.files?.[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    const fi = document.getElementById('imgFile');
    if (fi) { fi.files = dt.files; handleImgUpload(fi); }
  }
}

export function clearImg() {
  state.isImageRemoved = true;
  state.pendingImg = null;
  setState({});
}

export function previewMap() {
  const lat = (document.getElementById('hLat')?.value ?? '').trim();
  const lng = (document.getElementById('hLng')?.value ?? '').trim();
  const el  = document.getElementById('mapPrev');
  if (!el) return;
  if (!lat || !lng || !validate('lat', lat) || !validate('lng', lng)) {
    el.innerHTML = '<p class="text-red-500 text-xs">Please enter valid latitude and longitude first.</p>';
    el.classList.remove('hidden');
    return;
  }
  const b   = 0.008;
  const emb = `https://www.openstreetmap.org/export/embed.html?bbox=${+lng-b},${+lat-b},${+lng+b},${+lat+b}&layer=mapnik&marker=${lat},${lng}`;
  const lnk = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`;
  el.innerHTML = `
    <iframe class="map-frame" loading="lazy" src="${emb}" title="Location preview"></iframe>
    <a href="${lnk}" target="_blank" rel="noopener noreferrer" class="text-xs text-g hover:underline">Open full map ↗</a>`;
  el.classList.remove('hidden');
}

/* Live validation feedback for input fields */
export function liveVal(el, type) {
  const v = el.value.trim();
  el.classList.remove('ok', 'bad');
  if (!v) return;
  const ok = type === 'email' ? (v === '' || validate('email', v)) : validate(type, v);
  el.classList.add(ok ? 'ok' : 'bad');
}

/* ── Camera Capture Handlers ────────────────────────────────────────────── */
export async function openCamera(target = 'hostel') {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    const prevModal = state.modal;
    const prevData  = { ...state.modalData };
    setState({
      modal: 'camera',
      camTarget: target,
      camReturnModal: prevModal,
      camReturnData: prevData,
      camStream: stream,
      isCaptured: false,
      capturedImg: null
    });
    
    // Attach stream to video element after render
    setTimeout(() => {
      const v = document.getElementById('camVideo');
      if (v) v.srcObject = stream;
    }, 100);
  } catch (err) {
    console.error('Camera access denied:', err);
    showToast('Could not access camera. Please check permissions.', 'error');
  }
}

export function capturePhoto() {
  const v = document.getElementById('camVideo');
  const c = document.getElementById('camCanvas');
  if (!v || !c) return;

  const ctx = c.getContext('2d');
  // Capture a 4:3 area from the center of the video
  const vW = v.videoWidth;
  const vH = v.videoHeight;
  const targetAspect = 4 / 3;
  
  let sW, sH, sX, sY;
  if (vW / vH > targetAspect) {
    sH = vH;
    sW = vH * targetAspect;
    sX = (vW - sW) / 2;
    sY = 0;
  } else {
    sW = vW;
    sH = vW / targetAspect;
    sX = 0;
    sY = (vH - sH) / 2;
  }

  ctx.drawImage(v, sX, sY, sW, sH, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', 1.0);
  setState({ isCaptured: true, capturedImg: dataUrl });
}

export function doApplyCapture() {
  const b64 = state.capturedImg;
  const target = state.camTarget;
  stopCamera();
  
  if (target === 'room') {
    state.pendingRoomImage = { dataUrl: b64, base64: b64.split(',')[1], filename: `capture_${Date.now()}.jpg` };
    // UI update for room modal is handled via reactive state.pendingRoomImage in modalRoomForm
  } else {
    state.isImageRemoved = false;
    state.pendingImg = b64;
    const drop = document.getElementById('imgDrop');
    if (drop) {
      drop.innerHTML = `<img src="${b64}" style="max-height:160px;border-radius:.5rem;margin:0 auto;display:block;" alt="Preview"/>
        <div class="text-xs text-gray-500 mt-2">Click to change photo</div>`;
    }
    setState({}); // Re-render target modal
  }
  showToast('Photo captured!', 'success');
}

export function stopCamera() {
  const returnModal = state.camReturnModal;
  const returnData  = state.camReturnData;

  if (state.camStream) {
    state.camStream.getTracks().forEach(track => track.stop());
  }
  setState({
    modal: returnModal,
    modalData: returnData,
    camStream: null,
    camReturnModal: null,
    camReturnData: {},
    isCaptured: false,
    capturedImg: null
  });
}

export function toggleHostelExpand(id) {
  const current = state.expandedHostels || [];
  const expanded = current.includes(id)
    ? current.filter(x => x !== id)
    : [...current, id];
  setState({ expandedHostels: expanded });
}

/* ── Settings ────────────────────────────────────────────────────────────── */
export async function doUpdateDeveloperContact(ev) {
  ev.preventDefault();
  if (state.userRole !== 'admin') return;
  const f = { dev_contact: document.getElementById('devContact').value.trim() };
  if (!f.dev_contact) { showToast('Contact cannot be empty', 'error'); return; }
  
  await saveSystemSettings({ developerContact: f.dev_contact });
  setState({ developerContact: f.dev_contact });
  showToast('Settings saved successfully.', 'success');
  await auditLog('SETTINGS_UPDATE', 'System developer contact updated');
}
