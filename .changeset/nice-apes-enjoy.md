---
'@mastra/code-sdk': patch
'mastracode': patch
---

Thinking level lists now show only the levels each model actually runs. For example, `/think` offers Off to High on `openai/gpt-5` and `google/gemini-2.5-pro`, and Off, Low, Medium, High and Max on `anthropic/claude-sonnet-4-6`. OpenAI, Claude and Gemini models without reasoning offer only Off. Before, these models listed every level, and some picks were quietly changed to a different level, or sent as a reasoning effort the model rejects.

Switching models in an ACP client no longer overwrites the thinking level you chose. When the new model can't run that level, the closest one it supports is shown, and your choice comes back when you switch to a model that supports it.
