---
'@mastra/core': patch
---

Fixed a denial-of-service risk (GHSA-866g-f22w-33x8) in the AI SDK provider utilities bundled into @mastra/core. Buffered JSON response reads are now capped at 100MB, so a malicious or misconfigured model endpoint can no longer exhaust memory by returning an unbounded response body. The limit can be raised with the `AI_SDK_MAX_RESPONSE_BODY_BYTES` environment variable. No upstream patch exists for these version lines, so the fix is applied via pnpm patches to the vendored copies.
