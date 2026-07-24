---
"@internal/playground": patch
---

Fixed Studio allowing agents to reference unpublished (draft) prompt blocks that silently resolve to an empty prompt at runtime. The agent editor now shows a draft badge and warning on referenced blocks, the prompt block picker flags drafts, and saving or publishing is blocked when an agent's instructions would resolve to an empty prompt because every referenced block is unpublished.
