---
'@mastra/factory': patch
---

Organization admins can now change the model and thinking level of a card session the Factory owns, using the Factory's models and organization keys. The choice applies to that session only; the Factory default is unchanged. Before, nobody could change it. The session response now also says why a session can't change owner (a card, a Slack thread, or a side session), so the UI can explain a missing takeover.
