---
'@mastra/core': patch
---

Fixed `@mastra/core` processor structured output so `jsonPromptInjection: false` leaves the primary model prompt unchanged. `inline` and `system` now add schema guidance at the configured prompt location.
