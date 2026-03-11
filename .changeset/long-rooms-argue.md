---
'@mastra/schema-compat': patch
---

Fixed Zod v4 schema conversion when `zod/v4` compat layer from Zod 3.25.x is used. Schemas like `ask_user` and other harness tools were not being properly converted to JSON Schema when `~standard.jsonSchema` was absent, causing `type: "None"` errors from the Anthropic API.
