---
'mastra': minor
'@mastra/code-sdk': patch
---

Added a thinking level picker next to the model in the Factory session status line. Pick how much a session thinks without typing `/think`; a new chat keeps the level you pick before the first message. When you switch to a model that cannot run the chosen level, the session moves to the strongest level that model supports.
