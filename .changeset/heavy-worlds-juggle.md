---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed account switching and removal across multiple running Mastra Code instances. Each instance now uses the latest accounts, including in `/login`.

- Requests using automatic account routing retry on a remaining account when another instance removes the account they were using.
- Requests routed to a specific account stop instead of switching to a different account when that account is removed. Applying that account no longer shows a notice on every prompt, but failover notices still appear.
