# Defense & Mitigation Strategies

## Overview

Effective XSS defense requires multiple layered controls. No single mechanism is sufficient on its own.

---

## Layer 1: Output Encoding (Primary Defense)

Always encode user-supplied data for the correct context before rendering.

| Context | Example | Encoding Required |
|---------|---------|------------------|
| HTML Body | `<div>USER</div>` | HTML entity encode |
| HTML Attribute | `<input value="USER">` | HTML attribute encode |
| JavaScript | `var x = 'USER';` | JavaScript string encode |
| URL Parameter | `?q=USER` | URL percent encode |
| CSS Value | `color: USER` | CSS encode |

### Safe libraries by language

```python
# Python — use Jinja2 auto-escaping (on by default)
from markupsafe import escape
safe = escape(user_input)
```

```javascript
// Node.js — use he or DOMPurify on server
const he = require('he');
const safe = he.encode(userInput);
```

```java
// Java — OWASP Java Encoder
import org.owasp.encoder.Encode;
String safe = Encode.forHtml(userInput);
```

---

## Layer 2: Content Security Policy

Strict nonce-based CSP prevents injected scripts from executing:

```http
Content-Security-Policy:
  default-src 'none';
  script-src 'nonce-{PER_REQUEST_RANDOM}' 'strict-dynamic';
  style-src 'nonce-{PER_REQUEST_RANDOM}';
  img-src 'self' data:;
  connect-src 'self';
  base-uri 'none';
  form-action 'self';
  frame-ancestors 'none';
  object-src 'none';
  require-trusted-types-for 'script';
```

**Nonce generation (Node.js):**

```javascript
const crypto = require('crypto');
const nonce = crypto.randomBytes(16).toString('base64');
res.setHeader('Content-Security-Policy', `script-src 'nonce-${nonce}' 'strict-dynamic'; base-uri 'none'; object-src 'none';`);
```

---

## Layer 3: Trusted Types API

Trusted Types enforces type-safe assignments to dangerous DOM sinks. Browsers refuse to accept a plain string where a `TrustedHTML`, `TrustedScript`, or `TrustedScriptURL` is required.

```javascript
// Register a default policy
if (window.trustedTypes && trustedTypes.createPolicy) {
  trustedTypes.createPolicy('default', {
    createHTML: (string) => DOMPurify.sanitize(string, { RETURN_TRUSTED_TYPE: true }),
    createScriptURL: (string) => {
      if (string.startsWith('https://trusted-cdn.com/')) return string;
      throw new Error('Untrusted script URL: ' + string);
    },
    createScript: () => { throw new Error('Script creation not allowed'); }
  });
}
```

Enable enforcement via CSP:

```
require-trusted-types-for 'script';
trusted-types default;
```

---

## Layer 4: HTML Sanitization (DOMPurify)

When rich HTML input is required, sanitize with a well-maintained library:

```javascript
import DOMPurify from 'dompurify';

// Strict allowlist configuration
const clean = DOMPurify.sanitize(dirtyHTML, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true,
  RETURN_DOM_FRAGMENT: true
});

// Assign the DocumentFragment directly — never convert back to string
element.appendChild(clean);
```

Keep DOMPurify updated. Refer to [`bypasses/sanitizer-bypass.md`](../bypasses/sanitizer-bypass.md) for known bypass history and version guidance.

---

## Layer 5: Secure Coding Patterns

```javascript
// NEVER use these with untrusted data:
element.innerHTML = userInput;      // BAD
document.write(userInput);          // BAD
eval(userInput);                    // BAD
setTimeout(userInput, 0);          // BAD (string form)
element.src = userInput;           // BAD (unvalidated URL)

// SAFE alternatives:
element.textContent = userInput;   // Text only — no HTML parsing
element.setAttribute('data-x', x); // Attribute — not src/href
element.src = new URL(input, location.origin).href; // Validates URL structure
```

---

## Layer 6: HTTP Security Headers

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Layer 7: Cookie Security Flags

Even when XSS is present, cookie security flags limit the attacker's ability to steal or use session cookies.

| Flag | Effect | Recommendation |
|------|--------|---------------|
| `HttpOnly` | Cookie is inaccessible to JavaScript (`document.cookie`) | Set on all session cookies — prevents direct cookie theft via XSS |
| `Secure` | Cookie is only sent over HTTPS | Set on all cookies in production |
| `SameSite=Strict` | Cookie not sent on cross-site requests at all | Use for CSRF protection; may break OAuth/SAML flows |
| `SameSite=Lax` | Cookie sent on top-level navigations but not subresource requests | Default in Chrome 80+; better UX than Strict |
| `SameSite=None` | Cookie sent cross-site (requires `Secure`) | Only for intentionally cross-site cookies (e.g., embedded widgets) |

```http
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax; Path=/
```

**Impact on XSS:** `HttpOnly` prevents `document.cookie` theft. However, XSS can still:
- Make authenticated HTTP requests using the browser's automatic cookie attachment
- Read non-HttpOnly cookies, localStorage, sessionStorage
- Steal CSRF tokens from the DOM
- Keylog the user, screenshot the page

Cookie flags are a damage-reduction measure — they do not prevent XSS from being exploited.

---

## Layer 8: Subresource Integrity (SRI)

SRI ensures that third-party scripts and stylesheets have not been tampered with. The browser computes a cryptographic hash of the fetched resource and compares it to the expected hash in the `integrity` attribute. If they differ, the resource is blocked.

```html
<!-- script with SRI hash -->
<script
  src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"
  integrity="sha512-v2CJ7UaYy4JwqLDIrZUI/4hqeoQieOmAZNXBeQyjo21dadnwR+8ZaIJVT8EE2iyI61OV8e6M8PP2/4hpQINQ/g=="
  crossorigin="anonymous"
  referrerpolicy="no-referrer">
</script>

<!-- stylesheet with SRI hash -->
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
  integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN"
  crossorigin="anonymous">
```

**Generating SRI hashes:**

```bash
# Generate hash for a remote resource
curl -s https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js \
  | openssl dgst -sha512 -binary | openssl base64 -A
# Prefix result with sha512-

# Or use the online SRI Hash Generator: https://www.srihash.org/
```

**Limitations:**
- SRI protects against CDN compromise or MITM — it does not protect against XSS that executes before the script loads.
- Dynamic scripts created via `document.createElement('script')` do not check SRI unless the `integrity` attribute is explicitly set in JavaScript.
- Use `crossorigin="anonymous"` with SRI; without it, CORS preflight may fail for cross-origin resources.

**Tooling:** [`bundlewatch`](https://bundlewatch.io/), [`webpack-subresource-integrity`](https://github.com/waysact/webpack-subresource-integrity) automate SRI hash generation in build pipelines.

---

## Security Testing Checklist

- [ ] All output contexts use correct encoding
- [ ] CSP is present and evaluated (use [CSP Evaluator](https://csp-evaluator.withgoogle.com/))
- [ ] No `unsafe-inline` or `unsafe-eval` in script-src
- [ ] `base-uri` is set to `'none'` or `'self'`
- [ ] DOMPurify is up to date (check against [`bypasses/sanitizer-bypass.md`](../bypasses/sanitizer-bypass.md))
- [ ] Trusted Types enforced for script sinks
- [ ] DOM XSS tested with DOM Invader / Playwright
- [ ] SRI applied to all third-party scripts and stylesheets
- [ ] `HttpOnly`, `Secure`, and `SameSite` flags set on session cookies
- [ ] All HTTP security headers present (`X-Content-Type-Options`, `X-Frame-Options`, etc.)

---

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Trusted Types W3C Specification](https://w3c.github.io/trusted-types/)
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify)
- [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [MDN Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
