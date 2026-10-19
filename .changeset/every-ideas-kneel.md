---
'@mastra/factory': minor
---

Treat linked Slack conversations as User Sessions, with interactive User Session tools authorized as the linked sender, including other participants in an organization-visible session. Private sessions remain owner-only.

Before: a linked teammate replying in a Slack session could not use User Session management tools without acting as the session owner. After: they can ask, for example, “Switch my other session to openai/gpt-6-luna,” and `factory_switch_session_model` checks their own session ownership rather than the Slack session owner's.
