# 🏫 MMU Hostel Booking System v3.0

**Mountains of the Moon University – Student Hostel Booking Portal**
Fort Portal, Uganda

---

## 📁 Project Structure

```
mmu-hostel/
│
├── index.html                  ← Entry point (HTML shell only)
│
├── css/
│   └── styles.css              ← All visual styles & design tokens
│
├── js/
│   ├── app.js                  ← Entry point: render engine + window.App
│   ├── security.js             ← ALL security primitives (17 mechanisms)
│   ├── state.js                ← Single source of truth for app state
│   ├── storage.js              ← Encrypted localStorage persistence
│   ├── utils.js                ← Pure helper functions (no side effects)
│   ├── data.js                 ← Seed data & app-wide constants
│   │
│   ├── components/
│   │   ├── nav.js              ← Top navigation bar
│   │   ├── toast.js            ← Toast notification component
│   │   └── hostelCard.js       ← Reusable hostel card
│   │
│   ├── views/
│   │   ├── home.js             ← Home page
│   │   └── pages.js            ← Hostels, Detail, MyBookings, Admin, Security
│   │
│   ├── modals/
│   │   └── index.js            ← All modal templates (login, CRUD, booking)
│   │
│   └── handlers/
│       └── index.js            ← All business logic & event handlers
│
├── .htaccess                   ← Apache config (cPanel / shared hosting)
├── nginx.conf                  ← Nginx config (VPS / dedicated server)
├── netlify.toml                ← Netlify deployment config
├── vercel.json                 ← Vercel deployment config
├── package.json                ← Dev server scripts
└── .gitignore
```

### Separation of Concerns

| File | Responsibility |
|------|---------------|
| `security.js` | Crypto, validation, sessions, CSRF — **zero** app imports |
| `state.js` | Mutable data stores only — no DOM, no rendering |
| `storage.js` | Read/write encrypted localStorage — no rendering |
| `utils.js` | Pure functions — no side effects |
| `components/` | Small reusable HTML snippets |
| `views/` | Full page layouts |
| `modals/` | Modal HTML templates |
| `handlers/` | Business logic, API calls, state mutations |
| `app.js` | Wires everything together; owns the render loop |

---

## 🔐 Security Features (17 Mechanisms)

1. XSS Prevention — `escapeHtml()` on all dynamic content
2. Content Security Policy — Meta CSP in `index.html`
3. Clickjacking Defense — `X-Frame-Options: DENY` + JS frame-buster
4. Brute-Force Protection — 5 attempts → 15-min lockout + exponential backoff
5. Cryptographic Sessions — 256-bit CSPRNG token, 30-min idle expiry
6. CSRF Tokens — 192-bit per-session, constant-time comparison
7. Input Validation — Strict regex per field (regNo, phone, email, lat/lng)
8. Input Sanitization — Strip HTML tags, control chars, JS/data URIs
9. Password Hashing — SHA-256 + SALT via Web Crypto API
10. Image Validation — MIME whitelist, 2 MB max, base64 sandbox
11. AES-GCM Encryption — localStorage encrypted with AES-256-GCM, random IV
12. Authorization Guards — Every admin action checks live session
13. Rate Limiting — Max 10 bookings/session; double-submit prevention
14. Audit Logging — SHA-256 chain-hashed tamper-evident log
15. Prototype Pollution — `Object.freeze(Object.prototype)`
16. Secure Error Handler — Global catch; no stack traces to UI
17. Double-Booking Guard — Atomic check-then-set before confirming

---

