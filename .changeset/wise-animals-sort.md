---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed `/think` warning that Groq, xAI, DeepSeek, Gemini and other models "may not support reasoning effort" even though Mastra Code sends them the level. The warning now only appears when the level really isn't sent, such as on a custom local provider, and says so.
