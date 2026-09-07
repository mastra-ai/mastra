---
'@mastra/server': patch
---

Fixed A2A send and stream memory persistence by using the task context and honoring authenticated resource IDs. Keep task memory identity stable across follow-up requests and reject conflicting authenticated identities.
