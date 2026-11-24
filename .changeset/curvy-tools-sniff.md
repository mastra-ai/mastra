---
'@mastra/connect': patch
---

Connect sessions now include `apiBaseUrl`, the Nango host the platform issued the session for. `POST /connect/:provider/sessions` returns it so browsers can reach a self-hosted Nango; it is `null` when the platform does not report one.
