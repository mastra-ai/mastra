---
'mastracode': minor
---

Added `/model` to change the model for the current mode. Mastra Code prompts for a provider API key when the selected model needs one, and cancelling the prompt leaves the mode unchanged. Changes persist across sessions, and changing a model in a built-in pack creates the `Custom` pack. `/models` switches model packs, with `/packs` available as an alias.

```text
/model
/packs
```
