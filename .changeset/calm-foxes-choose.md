---
'@mastra/factory': patch
---

Factory sessions and work-item runs with no chosen default model now start on the default model of a provider you have connected (for example `anthropic/claude-fable-5` for Claude or `openai/gpt-5.6-sol` for ChatGPT) when the built-in default model has no credential. A default you or your Factory chose always wins, and nothing is written to storage.
