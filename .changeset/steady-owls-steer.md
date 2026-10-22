---
'@mastra/factory': patch
---

Only a shared session's owner can change its model or thinking level now. A teammate steering the session sees the model and thinking level disabled, with a tooltip naming who can change them, and `/model` or `/think` answers with the same line. The server enforces the same rule: `POST …/sessions/:sessionId/model`, and a `PUT …/state` that sets `thinkingLevel`, answer 403 for anyone but the owner, including through a second session bound to the owner's thread. The single-session read reports it as `capabilities.switchModel`. Teammates can still send messages and steer the session as before.
