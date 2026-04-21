---
'mastra': minor
'create-mastra': minor
---

Add "Enable Mastra Observe?" prompt to `create-mastra` and `mastra init`.

When the user opts in, a `MASTRA_CLOUD_ACCESS_TOKEN` placeholder is appended to `.env` along with instructions for minting a token at [cloud.mastra.ai](https://cloud.mastra.ai). The generated project already registers a `CloudExporter`, so pasting the token is all that is needed to start sending traces to the hosted Mastra Studio.

Both commands also accept `--observe` / `--no-observe` flags for non-interactive use.
