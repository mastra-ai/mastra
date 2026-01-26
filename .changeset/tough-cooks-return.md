---
'@mastra/core': patch
---

Fixed network mode not applying user-configured input/output processors (like token limiters) to the routing agent. This caused unbounded context growth during network iterations.

User-configured processors are now correctly passed to the routing agent, while memory-derived processors (which could interfere with routing logic) are excluded.

Fixes #12016
