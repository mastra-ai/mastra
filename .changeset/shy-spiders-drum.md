---
'@mastra/core': minor
---

Added staged execution-engine policy configuration and registered defaults, including precedence, lifetime locking, and wrapper isolation. Configuration naming and API remain provisional while the implementation stack is completed.

Native execution, output types, and recovery remain unchanged. Continue using the existing durable or evented wrappers for durable execution. Public documentation will follow in a separate final PR once naming and API settle.
