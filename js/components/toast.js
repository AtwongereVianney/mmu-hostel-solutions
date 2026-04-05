/**
 * components/toast.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Separation of Concerns: renders and controls toast notifications only.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

import { state, setState } from '../state.js';
import { e }               from '../utils.js';

/** Render a toast if one is active */
export function renderToast() {
  const { toast } = state;
  if (!toast) return '';
  const cls = toast.type === 'error' ? 'toast-error'
            : toast.type === 'warn'  ? 'toast-warn'
            : 'toast-success';
  return `<div class="toast ${cls} fade">${e(toast.msg)}</div>`;
}

/** Show a toast for 3.5 seconds */
export function showToast(msg, type = 'success') {
  setState({ toast: { msg, type } });
  setTimeout(() => setState({ toast: null }), 3500);
}
