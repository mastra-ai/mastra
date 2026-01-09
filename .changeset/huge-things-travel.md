---
'@mastra/playground-ui': patch
---

fix(playground-ui): prevent temperature and topP conflict for Anthropic Claude 4.5+ models

- Remove temperature and topP from default model settings to prevent Anthropic API errors
- Show warning banner when Claude 4.5+ models have both temperature and topP set
- Users can manually clear one value to resolve the conflict

Fixes #11760