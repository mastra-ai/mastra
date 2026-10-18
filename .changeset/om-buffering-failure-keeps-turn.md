---
'@mastra/core': patch
---

Fixed agent runs stopping when background observational memory buffering fails. The failure is still reported as an `om_buffering_failed` event, and the turn keeps going. A failed synchronous observation still follows the configured failure policy.
