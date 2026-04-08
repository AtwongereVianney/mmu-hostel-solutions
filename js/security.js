/**
 * js/security.js – ALL security primitives, zero circular imports.
 */
'use strict';

// [10] Prototype Pollution Prevention
try { Object.freeze(Object.prototype); } catch {}

// [11] Secure Global Error Handlers
window.addEventListener('error', ev => { console.error('[App Error]', ev.message); ev.preventDefault(); });
window.addEventListener('unhandledrejection', ev => { console.error('[Promise]', String(ev.reason?.message ?? ev.reason)); ev.preventDefault(); });

// [1] XSS Prevention
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#x27;').replace(/\//g,'&#x2F;').replace(/`/g,'&#x60;');
}

// [2] Input Sanitization
export function sanitize(str, maxLen = 200) {
  if (!str) return '';
  return String(str).replace(/<[^>]*>/g,'').replace(/[\x00-\x08\x0B\x0E-\x1F\x7F]/g,'')
    .replace(/javascript:/gi,'').replace(/data:/gi,'').replace(/vbscript:/gi,'')
    .replace(/on\w+\s*=/gi,'').trim().slice(0, maxLen);
}

// [8] Image validation
export const MAX_IMG_BYTES = 2 * 1024 * 1024;
export function validateImageFile(file) {
  if (!file) return 'No file selected.';
  if (!file.type.startsWith('image/')) return 'File must be an image (JPEG, PNG, WebP, GIF).';
  if (file.size > MAX_IMG_BYTES) return 'Image must be under 2 MB.';
  return null;
}
export function safeImgSrc(src) {
  if (!src) return null;
  if (/^data:image\/(jpeg|jpg|png|gif|webp);base64,/.test(src)) return src;
  if (/^https?:\/\//i.test(src)) return src;
  return null;
}

// [3] Validation patterns
export const PATTERNS = Object.freeze({
  regNo: /^\d{4}\/U\/MMU\/[A-Z0-9]{2,10}\/[A-Z0-9]{3,20}$/i,
  phone: /^(\+?256|0)[0-9]{9}$/,
  email: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
  name:  /^[a-zA-Z\s'\-]{2,80}$/,
  course:/^[a-zA-Z0-9\s,.\-()]{2,100}$/,
  rnum:  /^[A-Za-z0-9\-\/]{1,10}$/,
  lat:   /^-?([0-8]?\d(\.\d+)?|90(\.0+)?)$/,
  lng:   /^-?(1[0-7]\d(\.\d+)?|\d{1,2}(\.\d+)?|180(\.0+)?)$/,
});
export function validate(type, value) { const p=PATTERNS[type]; return p?p.test(String(value??'').trim()):false; }

// [4] Password hashing
const _SALT = 'MMU$H0sT3L$S3CUR3$SALT$2025';
// Simple fallback hash when crypto.subtle is unavailable
function _simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}
export async function hashPassword(plaintext) {
  try {
    if (crypto?.subtle?.digest) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(_SALT + plaintext));
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }
  } catch {
    console.warn('[Security] crypto.subtle unavailable, using fallback hash');
  }
  return _simpleHash(_SALT + plaintext);
}

// [5] Session management
const _SK = 'mmu_admin_sess', _IDLE = 30*60*1000;
let _idleTimer = null;
function _tok(n=32){const a=new Uint8Array(n);if(crypto?.getRandomValues)crypto.getRandomValues(a);else for(let i=0;i<n;i++)a[i]=Math.floor(Math.random()*256);return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('');}
export function createSession(){const s={token:_tok(),at:Date.now()};sessionStorage.setItem(_SK,JSON.stringify(s));_resetIdle();return s.token;}
export function getSession(){try{const s=JSON.parse(sessionStorage.getItem(_SK)||'null');if(!s)return null;if(Date.now()-s.at>_IDLE){destroySession();return null;}return s;}catch{return null;}}
export function touchSession(){const s=getSession();if(!s)return;s.at=Date.now();sessionStorage.setItem(_SK,JSON.stringify(s));_resetIdle();}
export function destroySession(){sessionStorage.removeItem(_SK);clearTimeout(_idleTimer);}
export function isAuthenticated(){return getSession()!==null;}
function _resetIdle(){clearTimeout(_idleTimer);_idleTimer=setTimeout(()=>{destroySession();window.dispatchEvent(new CustomEvent('mmu:sessionExpired'));},_IDLE);}

// [6] CSRF
const _CK='mmu_csrf';
export function getCsrfToken(){let t=sessionStorage.getItem(_CK);if(!t){t=_tok(24);sessionStorage.setItem(_CK,t);}return t;}
export function verifyCsrfToken(sub){const st=sessionStorage.getItem(_CK);if(!st||!sub||st.length!==sub.length)return false;let d=0;for(let i=0;i<st.length;i++)d|=st.charCodeAt(i)^sub.charCodeAt(i);return d===0;}

// [7] Brute force
const _BK='mmu_bf',_MAX=5,_LOCK=15*60*1000;
export function getBruteForceState(){try{return JSON.parse(sessionStorage.getItem(_BK)||'{"n":0,"until":0}');}catch{return{n:0,until:0};}}
export function recordFailedLogin(){const s=getBruteForceState();s.n++;if(s.n>=_MAX){s.until=Date.now()+_LOCK;s.n=0;}sessionStorage.setItem(_BK,JSON.stringify(s));return s;}
export function resetBruteForce(){sessionStorage.removeItem(_BK);}
export function isLoginLocked(){const s=getBruteForceState();if(s.until&&Date.now()<s.until)return{locked:true,remaining:s.until-Date.now()};return{locked:false,remaining:0};}
export function loginDelay(n){return Math.min(500*Math.pow(2,n),8000);}

// [9] AES-GCM encrypted storage
let _ek=null; const _ES='MMU-HOSTEL-v3-PROD-2025';
async function _dk(){
  if(_ek)return _ek;
  if(!crypto?.subtle?.importKey) {
    console.warn('[Security] crypto.subtle unavailable - encryption disabled');
    return null;
  }
  try{const fp=[navigator.language,screen.colorDepth,Intl.DateTimeFormat().resolvedOptions().timeZone,_ES].join('|');const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(fp),{name:'HKDF'},false,['deriveKey']);_ek=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new TextEncoder().encode('mmu-salt-v3'),info:new TextEncoder().encode('localStorage')},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);return _ek;}catch(e){console.warn('[Security] Key derivation failed:',e.message);return null;}
}
export async function encryptForStorage(obj){
  try{const k=await _dk();if(!k)return null;const iv=crypto.getRandomValues?crypto.getRandomValues(new Uint8Array(12)):new Uint8Array(12).map(()=>Math.floor(Math.random()*256));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(JSON.stringify(obj)));const o=new Uint8Array(12+ct.byteLength);o.set(iv);o.set(new Uint8Array(ct),12);return btoa(String.fromCharCode(...o));}
  catch(e){console.error('[Security] Encrypt:',e.message);return null;}
}
export async function decryptFromStorage(b64){
  try{const k=await _dk();if(!k)return null;const d=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:d.slice(0,12)},k,d.slice(12));return JSON.parse(new TextDecoder().decode(pt));}
  catch{return null;}
}

// [12] Audit log
const _AK='mmu_audit_v3'; let _log=[];
async function _he(p,e2){const d=new TextEncoder().encode(JSON.stringify(p)+JSON.stringify(e2));try{if(crypto?.subtle?.digest){const b=await crypto.subtle.digest('SHA-256',d);return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,16);}}catch(e){console.warn('[Security] Hash failed:',e.message);}let hash=0;for(let i=0;i<d.length;i++){hash=((hash<<5)-hash)+d[i];hash=hash&hash;}return Math.abs(hash).toString(16).padStart(16,'0');}
export async function auditLog(action,message,extra={}){const e2={ts:new Date().toISOString(),action,msg:sanitize(message,300),...extra};e2.hash=await _he(_log[_log.length-1]??{},e2);_log.push(e2);if(_log.length>200)_log=_log.slice(-200);encryptForStorage(_log).then(enc=>{if(enc)localStorage.setItem(_AK,enc);});}
export async function loadAuditLog(){const raw=localStorage.getItem(_AK);if(!raw){_log=[];return;}const d=await decryptFromStorage(raw);_log=Array.isArray(d)?d:[];}
export function getAuditLog(){return[..._log];}

// [13] Booking rate limit
let _bc=0; const _MB=10;
export function canBook(){return _bc<_MB;}
export function countBooking(){_bc++;}
