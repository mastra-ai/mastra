---
'@mastra/memory': patch
---

Fixed agents with observational memory losing the user's message and unread tool results partway through a turn. When observation ran between steps of a turn, it removed everything it had observed from the prompt, including the request the agent was working on and tool results the model had not read yet. The agent could then loop on tool calls or answer only part of the request. The current turn's input messages and the latest step's output now stay in the prompt until the turn ends. Results the model has already read are still compacted.
