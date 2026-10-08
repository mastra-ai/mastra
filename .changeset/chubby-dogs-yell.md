---
'mastra': minor
---

Added a thinking level picker next to the model in the Factory session status line. Pick how much a session thinks without typing `/think`; a new chat keeps the level you pick before the first message. The picker offers only the levels the selected model runs. When you switch to a model that cannot run the chosen level, the picker shows the level that model runs and keeps your choice for when you switch back.

The picker says whether the level follows the mode or global default or is set for this session, and **Use default** returns the session, or a new chat, to the default. When the thinking level can't be loaded, the picker says so instead of looking like it is still loading.
