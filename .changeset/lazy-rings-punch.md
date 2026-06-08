---
'@mastra/core': patch
---

Added OTel span instrumentation for the hardcoded 10-second rate-limit backpressure sleep, making it visible in traces as a 'rate-limit-sleep' span with remainingTokens and delayMs metadata
