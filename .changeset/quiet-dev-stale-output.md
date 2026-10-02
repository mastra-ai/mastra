---
'mastra': patch
---

Fixed `mastra dev` crashing on startup with "Stripping types is currently unsupported for files under node_modules" when `.mastra/output` still contained a previous `mastra build`. The dev server now clears the output directory before reading your server config, so dependencies resolve from your project instead of from stale build output.
