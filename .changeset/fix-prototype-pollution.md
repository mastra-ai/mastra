---
"@mastra/core": patch
"@mastra/server": patch
---

Fix prototype pollution in `setNestedValue` (`@mastra/core/utils`) and `generateOpenAPIDocument` (`@mastra/server`).

`setNestedValue` now rejects dot-path segments named `__proto__`, `constructor`, or `prototype`, preventing attacker-controlled field paths passed to `selectFields` from polluting `Object.prototype`. `generateOpenAPIDocument` builds its `paths` map with `Object.create(null)` so a route path of `__proto__` cannot poison the prototype chain.
