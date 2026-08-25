---
'@mastra/playground-ui': minor
---

Added an experimental conversation review suite to Studio, gated behind a feature flag. Traces gain a readable Review mode alongside the technical Advanced timeline: the case input, the agent response, and a plain-language step summary, with raw message data collapsed behind a disclosure. Reviewers can rate a response, add notes, and highlight text to leave attributed inline annotations, all stored through the existing feedback API. A new Threads surface groups an agent's turns into reviewable conversations with review status, shareable links, and JSON export. Enable it with the traceReview=on URL parameter or the VITE_TRACE_REVIEW build flag.
