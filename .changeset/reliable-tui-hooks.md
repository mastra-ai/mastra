---
"mastracode": patch
---

Fixed Mastra Code TUI hook triggering so `Stop` runs on every `agent_end` reason (`complete`, `aborted`, `error`) and `UserPromptSubmit` runs before sending non-command user prompts with block handling.
