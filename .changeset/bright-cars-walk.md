---
'@mastra/core': patch
---

Fixed model-backed processors (language detector, prompt injection detector, PII detector, system prompt scrubber, and moderation) dropping the request context. Their internal detection agents now receive the caller's RequestContext, so dynamic model resolvers and gateways can select models per request.
