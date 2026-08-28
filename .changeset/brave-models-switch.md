---
'mastracode': minor
---

Added `/model` to change the model for the current mode. Mastra Code prompts for a provider API key when the selected model needs one, and cancelling the prompt leaves the mode unchanged. Changes persist across sessions. Built-in packs keep their identity and accept same-provider overrides, while custom packs continue to support mixed providers. Modified built-in packs are labeled in `/models` and can be activated with their overrides or reset to their original models. `/models` switches model packs and ranks ahead of `/model` in command lists, with `/packs` available as an alias.

```text
/model
/packs
```
