---
'@mastra/server': minor
---

Added a `model` field to the `POST /datasets/:datasetId/experiments` body to run an experiment against an agent with an overridden model. Accepts a router id string (e.g. `"openai/gpt-4o"`) or a provider config object (`{ id, url?, apiKey?, headers? }`). Only valid for agent targets and requires `start: true`; create-only requests with a `model` return `400`.
