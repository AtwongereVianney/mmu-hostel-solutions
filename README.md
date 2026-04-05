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

## 🚀 Hosting Options

### Option 1 — Netlify (Recommended · Free · 5 minutes)

**Requirements:** GitHub account, Netlify account (free)

```bash
# Step 1 – Push your code to GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/mmu-hostel.git
git push -u origin main

# Step 2 – Deploy on Netlify
# 1. Go to https://netlify.com → "Add new site" → "Import from Git"
# 2. Connect GitHub → select your repository
# 3. Build settings:
#       Build command:  (leave empty)
#       Publish directory: .
# 4. Click "Deploy site"
# 5. Your site is live at: https://random-name.netlify.app
```

**Custom domain (optional):**
- Netlify dashboard → Domain settings → Add custom domain
- Add a CNAME record in your DNS: `mmu-hostel → random-name.netlify.app`

The `netlify.toml` file already configures:
- All security headers
- SPA routing
- Asset caching

---

### Option 2 — Vercel (Free · Fast · 3 minutes)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (run from project folder)
vercel

# Answer the prompts:
#   Set up and deploy? Y
#   Which scope? (your account)
#   Link to existing project? N
#   Project name: mmu-hostel
#   Directory: ./
#   Override settings? N

# Your site is live at: https://mmu-hostel.vercel.app
```

---

### Option 3 — cPanel Shared Hosting (Hostinger, SiteGround, Bluehost)

**Requirements:** Web hosting account with cPanel, domain name

**Steps:**

1. **Log in** to your cPanel at `yourdomain.com/cpanel`

2. **Open File Manager** → Navigate to `public_html`

3. **Upload all files** from this project:
   - Upload every file maintaining the folder structure
   - Make sure `js/`, `css/` folders are inside `public_html`

4. **Verify** the `.htaccess` file is uploaded (it handles routing + security headers)

5. **Test** by visiting `https://yourdomain.com`

> ⚠️ The `.htaccess` file is hidden on some systems. Make sure "Show hidden files" is enabled in File Manager.

**Using FTP (FileZilla):**
```
Host:     ftp.yourdomain.com
Username: (your cPanel username)
Password: (your cPanel password)
Port:     21

Upload all files to: /public_html/
```

---

### Option 4 — VPS / Dedicated Server (Ubuntu + Nginx)

**Requirements:** Ubuntu 20.04+ server, domain pointed to server IP

```bash
# --- On your server ---

# Step 1: Install Nginx
sudo apt update && sudo apt install nginx -y

# Step 2: Create site directory
sudo mkdir -p /var/www/mmu-hostel

# Step 3: Upload your files (from your local machine)
scp -r ./mmu-hostel/* user@YOUR_SERVER_IP:/var/www/mmu-hostel/

# Step 4: Copy the nginx config
sudo cp /var/www/mmu-hostel/nginx.conf /etc/nginx/sites-available/mmu-hostel

# Step 5: Edit the config — replace yourdomain.com with your actual domain
sudo nano /etc/nginx/sites-available/mmu-hostel

# Step 6: Enable the site
sudo ln -s /etc/nginx/sites-available/mmu-hostel /etc/nginx/sites-enabled/
sudo nginx -t        # test config
sudo systemctl reload nginx

# Step 7: Install SSL certificate (free via Let's Encrypt)
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Done! Visit https://yourdomain.com
```

---

### Option 5 — GitHub Pages (Free · Static only)

```bash
# Step 1: Push to GitHub (same as Netlify step 1 above)

# Step 2: In GitHub repository:
# Settings → Pages → Source: Deploy from branch → main → / (root) → Save

# Site will be at: https://YOUR-USERNAME.github.io/mmu-hostel/

# ⚠️ Note: GitHub Pages does not support custom HTTP headers,
#           so some security headers won't be set at the server level.
#           The Meta CSP in index.html still protects against XSS.
```

---

## 🛠️ Local Development

```bash
# Install dev dependencies
npm install

# Start local dev server (opens http://localhost:3000)
npm run dev
```

> ⚠️ **You must use a local server** (not `file://`). ES modules require HTTP.
> The `npm run dev` command starts one automatically.

---

## 🔑 Admin Access

| Field    | Value      |
|----------|------------|
| Username | `admin`    |
| Password | `admin123` |

> **For production:** Change the password hash in `js/data.js`:
> ```js
> // Replace this line:
> export const ADMIN_PASS_HASH = hashPassword('admin123');
> // With your new password:
> export const ADMIN_PASS_HASH = hashPassword('YourStrongPassword!');
> ```

---

## 📋 Pre-Launch Checklist

- [ ] Change admin password in `js/data.js`
- [ ] Replace seed hostel data in `js/data.js` with real data
- [ ] Upload real hostel photos through the Admin panel
- [ ] Enter correct GPS coordinates for each hostel
- [ ] Set up a real domain name (not `.netlify.app` / `.vercel.app`)
- [ ] Confirm HTTPS is working (padlock icon in browser)
- [ ] Test on mobile devices (phone + tablet)
- [ ] Test admin login lockout works (5 failed attempts)
- [ ] Test a full booking flow end-to-end
- [ ] Verify the map embeds show correct hostel locations

---

## 🌐 Domain Registrars (Uganda)

| Registrar | Price | Notes |
|-----------|-------|-------|
| UIXP (.ug domains) | ~$30/yr | `.ac.ug` for universities |
| Hostinger | ~$10/yr | `.com`, `.net`, `.org` |
| Namecheap | ~$10/yr | `.com`, free WhoisGuard |
| GoDaddy | ~$12/yr | `.com`, good support |

**Recommended domain:** `hostels.mmu.ac.ug` (if your IT department can delegate it)

---

## 📞 Support

Mountains of the Moon University — ICT Department
Fort Portal City, Uganda
Email: ict@mmu.ac.ug
