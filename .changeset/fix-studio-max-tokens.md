---
'@mastra/playground-ui': patch
---

fix: maxTokens from Studio Advanced Settings now correctly limits model output

The `modelSettingsArgs` object was prematurely renaming `maxTokens` to `maxOutputTokens`. The React hook (`useChat`) destructures `maxTokens` from this object, so the rename caused it to receive `undefined`, and the value was silently dropped from the API request body.
