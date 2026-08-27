---
'mastracode': minor
---

Added `/model` to change the model for the current mode. Mastra Code prompts for a provider API key when the selected model needs one, and cancelling the prompt leaves the mode unchanged. Changes persist across sessions. Built-in packs keep their identity and accept same-provider overrides, while custom packs continue to support mixed providers. `/models` switches model packs, with `/packs` available as an alias and ranked ahead of `/model` in command lists.

```text
/model
/packs
```
