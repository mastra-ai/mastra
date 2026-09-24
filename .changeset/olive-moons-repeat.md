---
'@mastra/factory': patch
---

Slack no longer starts a chat-only session when a linked sender's Factory project has no repository connected. A thread that cannot get a repo-backed workspace is now refused outright instead of quietly running in no project on the built-in defaults. The same applies to a sender who cannot be placed at all — no Slack workspace on the message, no linked Factory account, or no project to route to. Deployments with no account linking, no projects, or no source-control integration registered are unaffected: a chat-only session is still the only shape a thread can take there.

Conversations that already exist are never affected, since the check only runs when a Slack thread is first created.
