---
'@mastra/memory': patch
---

Made provider-backed grouped token counting opt-in in Observational Memory's low-level `TokenCounter`.

**What changed**

- Added an `enableProviderTokenCounting` flag to `TokenCounter`, defaulting provider-backed grouped counting to off.
- Kept `countMessagesAsync()` on the local `tokenx` path unless provider counting is explicitly enabled.
- Added unit coverage for the default-off, enabled, deduped, and fallback behaviors.
- Added a skipped-by-default live OpenAI test gated behind `OPENAI_API_KEY` and `RUN_OPENAI_LIVE_TESTS=true`.

**Why**
This preserves the cheap local thresholding path by default while still allowing exact provider-backed grouped measurements where they are worth the extra network call.
