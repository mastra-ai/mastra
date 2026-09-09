---
'@mastra/editor': patch
---

Fixed prompt block templates resolving inherited JavaScript properties instead of context data. A placeholder naming a built-in, such as `{{constructor}}` or `{{toString}}`, resolved to the value inherited from `Object.prototype` and interpolated text like `function Object() { [native code] }` into the rendered instructions. Because the inherited member read as defined, any fallback on that placeholder was skipped, so `{{constructor || 'none'}}` rendered the built-in rather than `none`. Template variables now resolve only against the context's own keys, and a placeholder with no matching key is left in place or falls back as documented. A context key that deliberately shadows a built-in name still resolves normally.
