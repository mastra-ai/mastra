---
'mastra': patch
---

Improve the `mastra init` CLI.

Previously, when you ran `mastra init` in a directory without a `package.json` file you'd receive no output. Now the CLI shows an error with next steps. Additionally, `mastra init` now also installs `zod` if not present already.
