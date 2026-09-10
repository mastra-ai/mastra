---
'@mastra/core': patch
---

Fixed tool input changing after suspension. Resume preserves validated values across ordinary, durable, automatic, and background execution. Inputs that cannot survive storage fail before suspension instead of silently changing.
