---
'@mastra/factory': minor
'@mastra/slack': patch
'@mastra/core': patch
---

Slack threads now only get the messages a session's agent chooses to send. The agent posts with a new `reply_in_thread` tool: a short note when it starts a longer job, a question it needs answered, and the outcome. Everything else stays in the session. It can also stay silent on purpose, or react to a message with `add_reaction`. To post the agent's full reply text again, set `adapterOptions: { textDisplay: 'show' }` on `SlackIntegration`.
