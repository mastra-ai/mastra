---
'@mastra/factory': patch
---

The supervisor health check no longer reports failed decisions and proposals waiting on a person as findings. The board and the attention inbox already carry both, so every one of them showed up twice in the inbox. The supervisor agent reads them with `factory_list_attention`; rows already stored for these kinds resolve on the next health tick.
