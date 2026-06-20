---
'@mastra/server': patch
---

The HTTP signal/message routes adapt to the agent's new `accepted` contract: they await `accepted` to derive the authoritative `runId` (falling back to the caller's `runId` or the stored signal id for `persist`/`discard`) while preserving the `{ accepted: true; runId: string }` wire shape. A setup/misconfig rejection tagged `ErrorCategory.USER` now maps to a `400` instead of a generic `500`.
