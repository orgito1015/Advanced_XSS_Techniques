# 🔐 Advanced XSS Techniques

> A comprehensive research repository on advanced Cross-Site Scripting techniques, evasion methods, exploit chains, and defenses. For educational and authorized security research only.

---

## ⚠️ Disclaimer

This repository is intended **strictly for educational purposes and authorized penetration testing**. Do not use any techniques described here against systems you do not own or have explicit written permission to test. Unauthorized use may violate laws including the Computer Fraud and Abuse Act (CFAA) and similar legislation worldwide.

---

## 📚 Table of Contents

- [Overview](#overview)
- [Repository Structure](#repository-structure)
- [Techniques Covered](#techniques-covered)
- [Quick Start](#quick-start)
- [Payloads Reference](#payloads-reference)
- [Tools](#tools)
- [Defense Strategies](#defense-strategies)
- [Contributing](#contributing)
- [References](#references)

---

## Overview

Cross-Site Scripting (XSS) remains one of the most impactful vulnerability classes in modern web applications. While basic XSS is well-documented, this repository focuses on:

- **Advanced evasion** of WAFs, sanitizers, and filters
- **DOM-based XSS** taint analysis and sink exploitation
- **Mutation XSS (mXSS)** via browser parser differentials
- **CSP bypass** techniques and misconfigurations
- **Exploit chaining**: XSS → CSRF, Prototype Pollution → XSS, XSS + CORS
- **Universal XSS (UXSS)** browser-level vulnerabilities

---

## Repository Structure

```
advanced-xss-techniques/
├── README.md
├── techniques/
│   ├── 01-reflected-stored.md
│   ├── 02-dom-based.md
│   ├── 03-mutation-xss.md
│   ├── 04-csp-bypass.md
│   └── 05-uxss.md
├── payloads/
│   ├── polyglots.txt
│   ├── filter-bypass.txt
│   ├── dom-sinks.txt
│   ├── csp-bypass.txt
│   └── exfiltration.js
├── bypasses/
│   ├── waf-bypass.md
│   ├── csp-bypass.md
│   └── sanitizer-bypass.md
├── tools/
│   ├── setup.md
│   └── comparison.md
├── labs/
│   ├── lab-01-dom-xss.md
│   ├── lab-02-csp-bypass.md
│   └── lab-03-mutation-xss.md
└── defense/
    └── mitigation.md
```

---

## Techniques Covered

| # | Technique | Difficulty | Impact |
|---|-----------|------------|--------|
| 01 | Reflected XSS + WAF Evasion | ⭐⭐ Medium | High |
| 02 | DOM-based XSS (Source → Sink) | ⭐⭐⭐ Hard | High |
| 03 | Mutation XSS (mXSS) | ⭐⭐⭐⭐ Expert | Critical |
| 04 | CSP Bypass via JSONP/Gadgets | ⭐⭐⭐ Hard | Critical |
| 05 | Prototype Pollution → XSS | ⭐⭐⭐⭐ Expert | Critical |
| 06 | Universal XSS (UXSS) | ⭐⭐⭐⭐⭐ Elite | Critical |
| 07 | XSS + CORS Exfiltration | ⭐⭐⭐ Hard | High |
| 08 | Template Injection → XSS | ⭐⭐⭐ Hard | High |

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/advanced-xss-techniques.git
cd advanced-xss-techniques

# Set up a local lab environment (Docker recommended)
docker run -p 8080:80 webgoat/webgoat

# Browse techniques
cat techniques/01-reflected-stored.md
```

---

## Payloads Reference

See the [`payloads/`](./payloads/) directory for categorized payload lists. A quick sampler:

```html
<!-- SVG-based polyglot -->
<svg/onload=alert(1)>

<!-- Encoding chain bypass -->
<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>

<!-- DOM XSS via hash -->
location.hash.slice(1) → innerHTML

<!-- mXSS via namespace confusion -->
<svg><p><style><g title="</style><img src=x onerror=alert(1)>">
```

---

## Tools

See [`tools/comparison.md`](./tools/comparison.md) for a detailed comparison. Summary:

| Tool | Best For | Installation |
|------|----------|-------------|
| DOM Invader | DOM XSS tracing | Burp Suite BApp Store |
| Dalfox | Automated scanning | `go install github.com/hahwul/dalfox/v2@latest` |
| XSStrike | Intelligent fuzzing | `pip install xsstrike` |
| XSSHunter | Blind XSS | [xsshunter.trufflesecurity.com](https://xsshunter.trufflesecurity.com) |

---

## Defense Strategies

See [`defense/mitigation.md`](./defense/mitigation.md) for full details. Key controls:

- **Trusted Types API** — enforces type-safe DOM mutations
- **Strict CSP** — `script-src 'nonce-{random}' 'strict-dynamic'`
- **DOMPurify** — with `FORCE_BODY` and allowlist configuration
- **Context-aware output encoding** — HTML, JS, URL, CSS contexts

---

## Contributing

Pull requests are welcome for:
- New bypass techniques (with CVE references where applicable)
- Additional payload variants
- Lab exercises and CTF writeups
- Defense improvements and corrections

Please ensure all contributions are for educational use only.

---

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [PortSwigger XSS Learning Path](https://portswigger.net/web-security/cross-site-scripting)
- [Cure53 DOMPurify](https://github.com/cure53/DOMPurify)
- [Trusted Types W3C Spec](https://w3c.github.io/trusted-types/dist/spec/)
- [Google's XSS Game](https://xss-game.appspot.com/)
- [mXSS Research — Heyes & Roth](https://cure53.de/fp170.pdf)

---

<p align="center">Made for the security research community · Use responsibly</p>
