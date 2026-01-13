---
'@mastra/playground-ui': patch
---

fix(playground-ui): prevent temperature and topP conflict for Anthropic Claude 4.5+ models

- Auto-clear topP for Claude 4.5+ models when both temperature and topP are set
- Show warning banner when user manually sets both values for restricted models
- Non-restricted models (OpenAI, Google, Claude 3.5) keep both defaults

Fixes #11760