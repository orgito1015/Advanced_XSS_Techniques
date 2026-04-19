# Defense & Mitigation Strategies

## Overview

Effective XSS defense requires multiple layered controls. No single mechanism is sufficient.

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

Strict nonce-based CSP:

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
res.setHeader('Content-Security-Policy', `script-src 'nonce-${nonce}'`);
```

---

## Layer 3: Trusted Types API

Trusted Types is the strongest DOM XSS defense. It enforces type-safe assignments to dangerous sinks.

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

When rich HTML input is required:

```javascript
import DOMPurify from 'dompurify';

// Strict configuration
const clean = DOMPurify.sanitize(dirtyHTML, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true,
  RETURN_DOM_FRAGMENT: true
});

// Never bypass sanitization
// BAD: element.innerHTML = userInput;
// GOOD: element.appendChild(clean);
```

---

## Layer 5: Secure Coding Patterns

```javascript
// NEVER use these with untrusted data:
element.innerHTML = userInput;      // BAD
document.write(userInput);          // BAD
eval(userInput);                    // BAD
setTimeout(userInput, 0);          // BAD (string form)
element.src = userInput;           // BAD

// SAFE alternatives:
element.textContent = userInput;   // Text only — no HTML parsing
element.setAttribute('data-x', x); // Attribute — not src/href
element.src = new URL(input, location).href; // Validate URL
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

## Security Testing Checklist

- [ ] All output contexts use correct encoding
- [ ] CSP is present and evaluated (use [CSP Evaluator](https://csp-evaluator.withgoogle.com/))
- [ ] No `unsafe-inline` or `unsafe-eval` in script-src
- [ ] `base-uri` is set to `'none'` or `'self'`
- [ ] DOMPurify is up to date (check for known bypasses)
- [ ] Trusted Types enforced for script sinks
- [ ] DOM XSS tested with DOM Invader / Playwright
- [ ] Subresource Integrity (SRI) on all third-party scripts
- [ ] HttpOnly and Secure flags on session cookies

---

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Trusted Types W3C Specification](https://w3c.github.io/trusted-types/)
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify)
- [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/)
