---
'@mastra/core': patch
---

Channel replies now post all text from one model step as a single message, for every adapter (Slack, Discord, Teams, Telegram, iMessage, WhatsApp and custom adapters). Before this, each text block went out as its own message. That split answers apart when a model sends several blocks per step, for example Anthropic web search, which sends one block per citation.

Text is joined exactly like the agent's `text` output, with no separator added. In the default (non-streaming) mode, text now posts when the step finishes or before a tool call, not at the end of each block. Streaming adapters only change with `toolDisplay: 'hidden'`.
