---
'mastracode': patch
---

`/think` and the Agent Client Protocol (ACP) reasoning option now offer only the thinking levels the selected model runs. Claude Haiku 4.5 no longer offers Max, which sent the same thinking budget as Extra high. Models that cannot think, such as Claude 3.5 Haiku or Gemini 2.0 Flash, offer only Off. `/think` marks the level your saved setting runs at as current.

When you switch to a model that cannot run the saved level, the ACP option saves the level that model runs. When you switch to a model that cannot think, it keeps your saved level for the next model.
