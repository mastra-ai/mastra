---
'@mastra/factory': minor
---

Treat linked Slack conversations as User Sessions, with the same interactive tools available to authenticated participants in the session's organization.

Before: a linked participant asking a Slack session to manage another session could not use User Session management tools. After: the participant can ask, for example, “Switch my other session to openai/gpt-6-luna,” and the Slack session can invoke `factory_switch_session_model` (subject to that tool's ownership checks).
