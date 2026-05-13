---
'mastra': patch
---

Re-prompt the Mastra Observability question when the browser sign-in flow fails or is cancelled in `mastra init` / `create-mastra`, instead of leaving the CLI stuck. Picking "No" on the retry is a clean way to continue without observability.
