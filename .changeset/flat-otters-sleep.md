---
'@mastra/playground': patch
---

fix(playground): allow esbuild postinstall in kitchen-sink workspace

esbuild 0.27.2 requires its postinstall script to install the platform-specific binary. When blocked, esbuild is non-functional and the dev server silently fails, causing all e2e-kitchen-sink tests to fail with ERR_CONNECTION_REFUSED.
