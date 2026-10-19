---
'@mastra/factory': minor
---

Treat linked Slack conversations as User Sessions, with interactive User Session tools available when the authenticated sender owns the session.

Before: a linked session owner asking their Slack session to manage another session could not use User Session management tools. After: the owner can ask, for example, “Switch my other session to openai/gpt-6-luna,” and the Slack session can invoke `factory_switch_session_model`. Replies from other linked participants do not receive owner-acting management tools.
