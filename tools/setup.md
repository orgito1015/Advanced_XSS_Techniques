# Tools Setup Guide

## Overview

This guide covers installation and configuration of the primary tools used throughout this repository.

---

## 1. Burp Suite (with DOM Invader)

**Download:** [portswigger.net/burp/communitydownload](https://portswigger.net/burp/communitydownload)

```bash
# Install Burp CA certificate (required for HTTPS interception)
# 1. Start Burp, navigate to http://burpsuite in the embedded browser
# 2. Download CA certificate
# 3. Import into system/browser trust store:
sudo cp burp_ca.crt /usr/local/share/ca-certificates/burp_ca.crt
sudo update-ca-certificates

# Enable DOM Invader
# Burp → Settings → Tools → DOM Invader → Enable
```

---

## 2. Dalfox

```bash
# Install via Go
go install github.com/hahwul/dalfox/v2@latest

# Verify
dalfox version
```

---

## 3. XSStrike

```bash
git clone https://github.com/s0md3v/XSStrike.git
cd XSStrike
pip3 install -r requirements.txt

python3 xsstrike.py --help
```

---

## 4. Nuclei

```bash
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
nuclei -update-templates

# Verify
nuclei -version
```

---

## 5. XSSHunter (Self-Hosted)

```bash
git clone https://github.com/trufflesecurity/xsshunter-express
cd xsshunter-express
cp .env.example .env
# Edit .env: set HOSTNAME, ADMIN_PASSWORD, etc.
docker-compose up -d

# Access dashboard at http://localhost:8080
```

---

## 6. Playwright (DOM XSS Testing)

```bash
npm install playwright
npx playwright install chromium

# Verify
node -e "const {chromium} = require('playwright'); chromium.launch().then(b => { console.log('OK'); b.close(); })"
```

---

## References

- [Burp Suite Documentation](https://portswigger.net/burp/documentation)
- [Dalfox GitHub](https://github.com/hahwul/dalfox)
- [Nuclei GitHub](https://github.com/projectdiscovery/nuclei)
- [Playwright Documentation](https://playwright.dev/docs/intro)
