---
'@mastra/playground-ui': patch
---

fix(playground-ui): prevent temperature and topP conflict for Anthropic Claude 4.5+ models

- Remove temperature and topP from default model settings to prevent Anthropic API errors
- Add mutual exclusion in UI for Claude 4.5+ models: setting temperature clears topP and vice versa
- Show info banner explaining the restriction when using Claude 4.5+ models
- Claude 3.5 and earlier models, as well as OpenAI/Google models, are unaffected

Fixes #11760
