---
'@mastra/core': patch
---

**Added boot-time warning for unknown `HarnessConfig` keys.** The Harness constructor now walks the top-level keys on the supplied config and emits a structured `console.warn` for any key not on the documented set (`modes`, `sessions`, `workspace`, etc., plus the `mastra` / `agents` / `storage` discriminants). Typo'd or stale config keys surface loudly instead of being silently ignored.

This is warn-only — the catch-all `[key: string]: unknown` index signature on `HarnessConfigCommon` is kept for back-compat. A future release will lift the warn to a hard error once downstream consumers have had a window to migrate.
