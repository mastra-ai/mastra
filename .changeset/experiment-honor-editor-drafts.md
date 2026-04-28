---
'@mastra/core': patch
---

Fixed experiments silently running against the code-defined agent when the user picked "Current" (or no version) in the agent version dropdown. Experiments now honor the Editor's current draft so they reflect the latest unpublished instructions, model, and tool changes.

Pin an explicit version via `agentVersion` in the experiment request to opt out.
