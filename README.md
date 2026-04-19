# 🔐 Advanced XSS Techniques

> A comprehensive research repository on advanced Cross-Site Scripting techniques, evasion methods, exploit chains, and defenses. For educational and authorized security research only.

---

## ⚠️ Disclaimer

This repository is intended **strictly for educational purposes and authorized penetration testing**. Do not use any techniques described here against systems you do not own or have explicit written permission to test. Unauthorized use may violate laws including the Computer Fraud and Abuse Act (CFAA), the Computer Misuse Act (CMA), and similar legislation worldwide.

---

## 📚 Table of Contents

- [How to Use This Repo](#how-to-use-this-repo)
- [Repository Structure](#repository-structure)
- [Techniques Covered](#techniques-covered)
- [Payloads Reference](#payloads-reference)
- [Labs](#labs)
- [Tools](#tools)
- [Defense Strategies](#defense-strategies)
- [Contributing](#contributing)
- [Legal](#legal)
- [Changelog](#changelog)
- [References](#references)

---

## How to Use This Repo

This repository is organized around a deliberate learning and testing workflow:

1. **Learn** — Read the technique files in `techniques/` from 01 to 07. Each covers a specific XSS class with payloads, examples, and detection notes.
2. **Bypass** — Consult `bypasses/` for WAF, sanitizer, and CSP bypass methodology when the application has defenses in place.
3. **Lab** — Work through the exercises in `labs/` to practice each technique in an isolated, exploitable environment.
4. **Test** — Use payloads from `payloads/` during authorized assessments. Reference `tools/comparison.md` for tool selection.
5. **Report** — Use the technique files as reference material when writing vulnerability reports. Link to the CVEs and research papers in the `## References` sections.

**Recommended reading order:**

```
techniques/01 → techniques/02 → labs/lab-01 →
techniques/03 → labs/lab-03 →
techniques/04 → labs/lab-02 →
techniques/05 → techniques/06 → techniques/07 →
bypasses/waf-bypass → bypasses/sanitizer-bypass →
defense/mitigation
```

---

## Repository Structure

```
advanced-xss-techniques/
├── README.md
├── techniques/
│   ├── 01-reflected-stored.md      # Reflected, stored, second-order XSS + evasion
│   ├── 02-dom-based.md             # Sources, sinks, taint analysis, DOM clobbering
│   ├── 03-mutation-xss.md          # mXSS: serialization loops, namespace confusion
│   ├── 04-csp-bypass.md            # CSP audit, JSONP, gadgets, base-tag, nonce attacks
│   ├── 05-uxss.md                  # Universal XSS: browser bugs, extension UXSS
│   ├── 06-prototype-pollution-xss.md  # Prototype pollution chains → XSS
│   └── 07-xss-chaining.md          # XSS + CSRF, CORS, clickjacking, dangling markup
├── payloads/
│   ├── polyglots.txt               # Multi-context polyglot payloads
│   ├── filter-bypass.txt           # Categorized WAF/filter bypass payloads
│   ├── dom-sinks.txt               # Per-sink vulnerable patterns + payloads
│   ├── csp-bypass.txt              # JSONP, gadgets, base-tag, nonce exfil payloads
│   ├── blind-xss.txt               # OOB payloads for admin panels, logs, email, PDF
│   └── exfiltration.js             # Cookie theft, keylogger, CSRF token, API exfil
├── bypasses/
│   ├── waf-bypass.md               # Cloudflare, AWS WAF, ModSecurity bypass techniques
│   ├── sanitizer-bypass.md         # DOMPurify, html-sanitizer, Bleach bypass history
│   └── csp-bypass.md               # Quick reference → techniques/04-csp-bypass.md
├── tools/
│   ├── setup.md                    # Installation guide for all tools
│   └── comparison.md               # Tool comparison including nuclei templates
├── labs/
│   ├── lab-01-dom-xss.md           # DOM XSS lab: SPA router → innerHTML
│   ├── lab-02-csp-bypass.md        # CSP bypass lab: JSONP on whitelisted domain
│   └── lab-03-mutation-xss.md      # mXSS lab: DOMPurify 2.2.2 noembed bypass
└── defense/
    └── mitigation.md               # Output encoding, CSP, Trusted Types, SRI, cookies
```

---

## Techniques Covered

| # | Technique | Difficulty | Impact |
|---|-----------|------------|--------|
| 01 | [Reflected & Stored XSS + WAF Evasion](techniques/01-reflected-stored.md) | ⭐⭐ Medium | High |
| 02 | [DOM-Based XSS (Source → Sink + DOM Clobbering)](techniques/02-dom-based.md) | ⭐⭐⭐ Hard | High |
| 03 | [Mutation XSS (mXSS)](techniques/03-mutation-xss.md) | ⭐⭐⭐⭐ Expert | Critical |
| 04 | [CSP Bypass via JSONP/Gadgets](techniques/04-csp-bypass.md) | ⭐⭐⭐ Hard | Critical |
| 05 | [Universal XSS (UXSS)](techniques/05-uxss.md) | ⭐⭐⭐⭐⭐ Elite | Critical |
| 06 | [Prototype Pollution → XSS](techniques/06-prototype-pollution-xss.md) | ⭐⭐⭐⭐ Expert | Critical |
| 07 | [XSS Chaining (CSRF, CORS, Clickjacking)](techniques/07-xss-chaining.md) | ⭐⭐⭐ Hard | High |

---

## Payloads Reference

See the [`payloads/`](./payloads/) directory for categorized payload lists. A quick sampler:

```html
<!-- SVG-based polyglot -->
<svg/onload=alert(1)>

<!-- Encoding chain bypass -->
<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>

<!-- DOM XSS via hash (place in URL fragment) -->
<img src=x onerror=alert(origin)>

<!-- mXSS via noembed mutation (DOMPurify < 2.2.3) -->
<noembed><img src="</noembed><img src=x onerror=alert(1)>">
```

| Payload File | Contents |
|-------------|----------|
| [`polyglots.txt`](payloads/polyglots.txt) | Multi-context polyglots |
| [`filter-bypass.txt`](payloads/filter-bypass.txt) | Case, whitespace, encoding, protocol bypasses |
| [`dom-sinks.txt`](payloads/dom-sinks.txt) | Per-sink vulnerable patterns |
| [`csp-bypass.txt`](payloads/csp-bypass.txt) | JSONP, gadgets, base-tag, CSS nonce exfil |
| [`blind-xss.txt`](payloads/blind-xss.txt) | OOB payloads for admin panels, logs, email, PDF |
| [`exfiltration.js`](payloads/exfiltration.js) | Post-exploitation: cookies, keylogger, CSRF, screenshots |

---

## Labs

Self-contained, reproducible exercises with Docker setup options:

| Lab | Technique | Difficulty |
|-----|-----------|------------|
| [Lab 01 — DOM XSS](labs/lab-01-dom-xss.md) | DOM XSS via `location.hash` → `innerHTML` | Beginner |
| [Lab 02 — CSP Bypass](labs/lab-02-csp-bypass.md) | JSONP bypass on whitelisted domain | Intermediate |
| [Lab 03 — Mutation XSS](labs/lab-03-mutation-xss.md) | mXSS against DOMPurify 2.2.2 | Advanced |

---

## Tools

See [`tools/comparison.md`](./tools/comparison.md) for full details including nuclei templates.

| Tool | Best For | Installation |
|------|----------|-------------|
| DOM Invader | DOM XSS tracing | Burp Suite BApp Store |
| Dalfox | Automated scanning | `go install github.com/hahwul/dalfox/v2@latest` |
| XSStrike | Intelligent fuzzing | `pip3 install xsstrike` |
| XSSHunter | Blind XSS | [xsshunter.trufflesecurity.com](https://xsshunter.trufflesecurity.com) |
| nuclei | Bulk template scanning | `go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest` |

---

## Defense Strategies

See [`defense/mitigation.md`](./defense/mitigation.md) for full details. Key controls:

- **Output encoding** — context-aware, applied at the rendering site
- **Strict CSP** — `script-src 'nonce-{random}' 'strict-dynamic'` with `base-uri 'none'`
- **Trusted Types API** — enforces type-safe DOM mutations
- **DOMPurify** — with `RETURN_DOM_FRAGMENT: true` to avoid re-parse loop
- **Cookie flags** — `HttpOnly; Secure; SameSite=Lax` on all session cookies
- **Subresource Integrity (SRI)** — on all third-party scripts and stylesheets

---

## Contributing

Pull requests are welcome for:
- New bypass techniques (with CVE references where applicable)
- Additional payload variants
- Lab exercises and CTF writeups
- Defense improvements and corrections

All contributions must be for educational use only and include proper references.

---

## Legal

**Authorized Use Only**

All techniques, payloads, and tools in this repository are provided for educational purposes and for use in authorized security assessments only. "Authorized" means you have explicit written permission from the system owner or organization responsible for the target system before conducting any testing.

**Applicable Laws**

Unauthorized access to computer systems is a criminal offense in most jurisdictions:
- United States: Computer Fraud and Abuse Act (18 U.S.C. § 1030)
- United Kingdom: Computer Misuse Act 1990
- European Union: Directive 2013/40/EU on attacks against information systems
- Australia: Criminal Code Act 1995, Part 10.7

Even passive reconnaissance against systems you do not own may constitute a criminal offense under some jurisdictions.

**No Warranty**

This repository is provided "as is" without warranty of any kind. The authors and contributors are not responsible for any misuse, damage, or legal consequences arising from use of this material.

**Responsible Disclosure**

If you discover a vulnerability using techniques from this repository, follow responsible disclosure practices:
1. Do not publicly disclose until the vendor has issued a patch.
2. Contact the vendor via their security disclosure process (security.txt, HackerOne, BugCrowd, or direct email to security@).
3. Allow a reasonable remediation timeline (industry standard: 90 days, aligned with Google Project Zero policy).
4. Report browser-level and extension-level vulnerabilities to the respective vendor, not to web application owners.

**Scope of Use**

Permitted uses:
- Educational reading and research
- Authorized penetration testing engagements (written authorization required)
- CTF competitions
- Bug bounty programs (within the defined scope of the program)
- Internal security training within your organization

Not permitted:
- Testing systems you do not own without explicit written permission
- Selling exploits developed with this material to parties who will use them illegally
- Any use that violates applicable laws or regulations

---

## Changelog

### 2024-04 — Initial Release

- Added `techniques/01-07` covering reflected/stored, DOM-based, mXSS, CSP bypass, UXSS, prototype pollution, and XSS chaining
- Added `payloads/` directory: polyglots, filter-bypass, dom-sinks, csp-bypass, blind-xss, exfiltration
- Added `bypasses/` directory: WAF bypass (Cloudflare, AWS, ModSecurity), sanitizer bypass (DOMPurify, Bleach), CSP bypass index
- Added `labs/01-03`: DOM XSS, CSP bypass via JSONP, mXSS against DOMPurify
- Added `defense/mitigation.md` with SRI, cookie flags, Trusted Types coverage
- Added `tools/` directory with nuclei templates section

---

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [PortSwigger XSS Learning Path](https://portswigger.net/web-security/cross-site-scripting)
- [Cure53 DOMPurify](https://github.com/cure53/DOMPurify)
- [Trusted Types W3C Spec](https://w3c.github.io/trusted-types/dist/spec/)
- [mXSS Research — Heyes & Roth (Cure53)](https://cure53.de/fp170.pdf)
- [DOM Clobbering Strikes Back — Gareth Heyes](https://portswigger.net/research/dom-clobbering-strikes-back)
- [Bypassing CSP with Script Gadgets — Lekies et al.](https://research.google/pubs/pub45542/)
- [Client-Side Prototype Pollution — BlackFan](https://github.com/BlackFan/client-side-prototype-pollution)

---

<p align="center">Made for the security research community · Use responsibly</p>
