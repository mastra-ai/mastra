---
'@mastra/observability': patch
'@mastra/core': patch
---

Added `apiKey`, `clientSecret`, `accessToken`, and `refreshToken` to the default keys stripped during span serialization. Any object that exposes one of these fields in a span input, output, attribute, or metadata now has the value dropped before the span leaves the process. This is defense-in-depth; classes carrying credentials should also implement `serializeForSpan()`.
