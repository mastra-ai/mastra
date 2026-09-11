---
'@mastra/core': minor
---

`ToolDisplayFn` (function-form `toolDisplay`) now owns the full approval lifecycle. Two new `ToolDisplayEvent` kinds — `approved` and `denied` — are dispatched when the user clicks Approve or Deny on a tool-approval card, alongside the existing `running`/`result`/`error`/`approval` kinds. A renderer that returned the original approval card can now return a `{ kind: 'post', message }` to replace it with its own resolved-state rendering (e.g. a localized "Approved ✓" or "Denied ✗ by Alice" message), or `undefined` to opt out of the edit entirely. The framework's hardcoded `formatToolApproved` / `formatToolDenied` is preserved as the fallback for adapters that did not configure a function-form `toolDisplay`, so existing `'cards'` / `'text'` configurations are unchanged.
