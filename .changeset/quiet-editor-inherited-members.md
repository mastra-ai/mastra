---
'@mastra/editor': patch
---

Prompt block templates no longer resolve inherited `Object.prototype` members. Previously `renderTemplate` read placeholders like `{{constructor}}`, `{{toString}}` and `{{valueOf}}` as context data, injecting native-code text (e.g. `function Object() { [native code] }`) into stored-agent instructions and skipping any declared fallback. Path resolution now only follows own properties, so an inherited member is treated as unresolved — left in place when there is no fallback, and replaced by the fallback when one is provided — while a context key that deliberately shadows a built-in name (e.g. `{ toString: 'shadowed' }`) still resolves. Fixes #23447.
