---
'@mastra/code-sdk': patch
---

Subscription providers (Anthropic, OpenAI Codex, GitHub Copilot, xAI, Kimi For Coding) now say "<Provider> sign-in expired." when a saved sign-in can no longer be renewed, matching the **Sign-in expired** status in Settings. Before, Anthropic said "Not logged in to Anthropic." and the others said "Failed to refresh the <Provider> token." "Not logged in to <Provider>." is now only shown when no sign-in is saved.
