---
'@mastra/factory': patch
'mastra': patch
---

Record Factory PR provenance in real time even when the GitHub verification fetch fails (e.g. a broken installation token), marking the row unverified instead of silently dropping it, so opened pull requests still auto-link to their work item; log provenance-recording failures instead of hiding them
