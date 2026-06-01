---
'@internal/playground': patch
---

Agent Builder back-fill is now reliable across starter cards and freeform prompts. Previously the builder could stall after setting the name and description, leave the truncated starter prompt as the agent's name, spam `set-agent-model` with empty payloads, or hit the per-step token cap before reaching `set-agent-instructions`.

The form snapshot passed to the builder LLM now renders each field alongside a per-field setter directive ("already set" vs "call setter once") so the LLM knows exactly which setters to call and which to skip. A new placeholder-name check compares the current name against the truncated starter prompt; while the name is still that placeholder the snapshot tells the LLM to call `set-agent-name` with a real, outcome-anchored name. The starter user message is plumbed through `conversation-panel.tsx` so the snapshot has the context it needs.

Verified across 6 controlled trials (4 starter cards + 2 freeform prompts) on a fresh database: every agent landed a real name, description, and instructions, and stopped cleanly with no model-setter spam.
