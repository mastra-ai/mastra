---
'@mastra/factory': patch
---

Documented that the built-in Work and Review boards no longer declare a transition policy. A custom board that wrapped `workBoard` or `reviewBoard` and called its `transitionPolicy` now fails every transition with `transitionPolicy is not a function`; drop that delegating call.
