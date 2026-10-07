---
'mastracode': patch
---

`/think` and the Agent Client Protocol (ACP) reasoning option now offer only the thinking levels the selected model runs. Claude Haiku 4.5 no longer offers Max, which sent the same thinking budget as Extra high. Models that cannot think, such as Claude 3.5 Haiku, Gemini 2.0 Flash or GPT-4o, offer only Off. Models that can only turn thinking on or off, such as GLM-4.6, offer Off and High. `/think` marks the level your saved setting runs at as current.

Switching models in ACP keeps your saved level. The reasoning option shows the level the new model runs, and switching back restores the saved level: Extra high on Claude Opus 4.7 runs as High on Claude Sonnet 4.6, and is Extra high again when you switch back.
