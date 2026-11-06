---
'@mastra/factory': patch
---

Improved Factory response times:

- A session following many cards now reads them in one batch per step, instead of four queries per card.
- The phase signal, `factory_inspect_work_item`, `factory_list_work_items`, `factory_list_attention` and `#123` lookups no longer copy every card of the board on each call.
- Filing a card without a parent no longer reads every card in the project.
- When model credential storage fails to start (for example, a missing encryption key), Factory retries it every 15 seconds instead of on every request and model call.
