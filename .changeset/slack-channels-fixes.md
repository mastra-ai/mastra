---
'@mastra/slack': patch
---

- `SlackProvider.connect()` now merges with existing channel adapters instead of replacing them, preserving adapters the agent author already configured (e.g. Discord).
- Slack interactive payloads (button clicks, modal submissions) no longer return `400 Malformed JSON body`. The provider only JSON-parses the body for the events callback path and forwards form-urlencoded payloads to the adapter's webhook handler unchanged.
- Bumped `chat` to `^4.29.0`.
