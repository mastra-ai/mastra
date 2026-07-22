---
'@mastra/factory': patch
---

Move the `MastraFactory` assembly root into `@mastra/factory`. `factory-entry.ts` now lives at the package root export (`@mastra/factory`), alongside the extracted `workspace`, `spa-static`, `server-error`, and `sandbox/reattach` helpers. Factory skills ship with the package and are copied into deploy output via the consuming app's build script.
