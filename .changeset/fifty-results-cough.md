---
'mastracode': patch
---

Improved `/think` and the Agent Client Protocol (ACP) reasoning option to offer only the thinking levels the selected model runs. For example, Claude Haiku 4.5 no longer offers Max, which sent the same thinking budget as Extra high, and models that cannot think, like Claude 3.5 Haiku or Gemini 2.0 Flash, offer only Off. When you switch to a model that cannot run the saved level, the ACP option now saves the level that model runs instead of always falling back to Extra high.
