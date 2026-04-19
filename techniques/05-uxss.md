# 05 — Universal XSS (UXSS)

## Overview

Universal XSS (UXSS) is a class of vulnerability in the browser itself — or in a privileged component running at the browser level (extensions, native bindings, protocol handlers) — that allows JavaScript execution on any origin, bypassing the Same-Origin Policy. Unlike regular XSS, the bug is not in a web application; the web application is the victim, not the cause.

UXSS gives an attacker the same access as a same-origin script on *every* web page the victim visits, not just the target site.

---

## 1. UXSS vs. Regular XSS

| Property | Regular XSS | UXSS |
|----------|------------|------|
| Bug location | Web application code | Browser or privileged component |
| Origin scope | Single origin (`victim.com`) | All origins |
| Attack surface | Injection point in app | Browser/extension API surface |
| Fix | App developer patches | Browser/extension vendor patches |
| Impact | Session hijack on one site | Credential theft across all sites |
| Disclosure | Report to app owner | Report to browser/extension vendor |

---

## 2. Browser Extension UXSS

Extensions run in a privileged context (the extension's background page or content scripts) and can inject HTML/JavaScript into any tab. A vulnerable extension that accepts attacker-controlled input and injects it into a page without sanitization is a UXSS vector.

### Pattern: Content Script HTML Injection

```javascript
// Extension content script — receives message from extension popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // VULNERABLE: msg.html is attacker-controlled if the extension
  // fetches it from a third-party URL or reads it from a page element
  document.body.innerHTML += msg.html;
});
```

An attacker who can control `msg.html` — for example by hosting a page that the extension fetches and injects — can execute JavaScript on *any* origin the user visits, because the content script runs in the context of the visited page.

### Pattern: Extension Opens Attacker-Controlled URL in Trusted Context

Some extensions open user-supplied URLs in a context that inherits the extension's `all_urls` permission or interacts with sensitive tabs.

```javascript
// Extension background script — opens URL in new tab
chrome.browserAction.onClicked.addListener(() => {
  const url = localStorage.getItem('savedUrl'); // attacker-controlled if set via XSS
  chrome.tabs.create({ url });
});
```

### Historical Example: Chrome Password Manager Extension

Several password manager browser extensions (Keeper Security — CVE-2017-15430 class issues) injected a UI overlay into all pages without proper isolation. An XSS in the injected overlay could reach the extension's privileged APIs and exfiltrate credentials from any site.

---

## 3. iframe src Manipulation and URL Scheme Handling

### javascript: Scheme in iframe src

Historical browsers (pre-2015) allowed `<iframe src="javascript:...">` to execute JavaScript in the parent page's context rather than a sandboxed context. This was a class of UXSS because the parent's origin was inherited.

Modern browsers (Chrome 56+, Firefox 58+) block `javascript:` scheme in `<iframe src>`. This vector is **[LEGACY]** on current browsers.

### blob: URL Inheritance (Historical)

```javascript
// In some older browsers, blob: URLs inherited the creator's origin
const b = URL.createObjectURL(new Blob(['<script>alert(document.cookie)</script>'], {type: 'text/html'}));
// Opening b in an iframe in certain older browsers could access the parent origin
// Modern browsers assign blob: URLs a unique opaque origin — this is fixed.
```

### data: URI Scheme (Historical — IE, old Chrome)

```html
<!-- IE 11 and old Chrome treated data: URIs as same-origin as the embedding page -->
<iframe src="data:text/html,<script>alert(parent.document.cookie)</script>">
```

Chrome 60+ and Firefox 67+ assign data: URIs an opaque origin. **[LEGACY]** on current browsers.

---

## 4. Real CVE References

### CVE-2021-30551 — Chrome Type Confusion in V8

A type confusion bug in Chrome's V8 JavaScript engine allowed attackers to execute arbitrary code by visiting a crafted web page. Once renderer code execution was achieved, a sandbox escape was combined to read files and cookies across all origins.

**Impact:** Full UXSS via renderer exploit. Affected Chrome < 91.0.4472.101.

**Lesson:** V8 engine bugs are the most impactful UXSS class because they require only a malicious web page — no extension, no user action beyond visiting a URL.

### CVE-2019-5786 — Chrome FileReader Use-After-Free

A use-after-free in Chrome's `FileReader` API allowed an attacker to achieve arbitrary code execution in the renderer process from a malicious web page. Combined with a sandbox escape, this constituted a full UXSS exploit chain.

**Impact:** Full remote code execution and cross-origin data access. Actively exploited in the wild (zero-day). Fixed in Chrome 72.0.3626.121.

**Lesson:** Web API implementation bugs in the renderer are a consistent source of UXSS class vulnerabilities.

---

## 5. Responsible Disclosure for UXSS

UXSS vulnerabilities have wider blast radius than application XSS. Disclosure should follow these principles:

**Who to report to:**
- Browser engine bugs: report to the browser vendor (Chrome Security at `security@chromium.org`, Firefox at Bugzilla with `[sec-]` prefix, Safari at `product-security@apple.com`).
- Extension bugs: report to the extension developer *and* to the browser vendor's extension store security team.
- Do not report to individual web application owners — the bug is not in their code.

**Timeline:**
- Standard coordinated disclosure is 90 days (Google Project Zero standard). Browser vendors generally patch faster due to severity.
- If a bug is actively exploited (zero-day), contact the vendor immediately via their security emergency channels.

**What not to do:**
- Do not publish working exploit code before the vendor has released a patch to end users (not just a commit in a public repository).
- Do not test UXSS against real user sessions. Use an isolated browser profile with no real credentials.
- Browser bug bounty programs (Chrome VRP, Firefox Security Bug Bounty) pay significant rewards for UXSS — use them rather than selling to brokers.

---

## References

- [Universal XSS via Popup — PortSwigger Research](https://portswigger.net/research/universal-xss-via-popup)
- [CVE-2021-30551 Chrome V8 Type Confusion](https://chromereleases.googleblog.com/2021/06/stable-channel-update-for-desktop.html)
- [CVE-2019-5786 Chrome FileReader UAF](https://chromereleases.googleblog.com/2019/03/stable-channel-update-for-desktop.html)
- [Chrome Security Architecture](https://chromium.googlesource.com/chromium/src/+/main/docs/security/README.md)
- [Browser Extension Security — Cure53 White Paper](https://cure53.de/browser-security-whitepaper.pdf)
