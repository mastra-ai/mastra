---
'@mastra/deployer': patch
---

Fixed `mastra build` on pnpm v11 when dependencies use postinstall scripts.

The deployer now isolates `.mastra/output` so pnpm does not attach it to the parent workspace during install.

**What changes for you**
- Build installs no longer rely on the old implicit build-script bypass.
- If you need specific build scripts, opt them in from `.mastra/output` using your pnpm build-allow settings.

Closes [#16613](https://github.com/mastra-ai/mastra/issues/16613).
