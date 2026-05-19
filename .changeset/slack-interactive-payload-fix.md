---
'@mastra/slack': patch
---

Fix Slack interactive payloads (button clicks, modal submissions) returning `400 Malformed JSON body`. The provider now only attempts to JSON-parse the request body when the content-type is `application/json` (the events callback path), and forwards form-urlencoded payloads to the adapter's webhook handler unchanged.
