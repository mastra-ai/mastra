---
'@mastra/factory': patch
---

Factory startup now logs when it is moving existing sessions to their new memory owners, and reports progress every 10 seconds. On a large or remote database this one-time step can take minutes before the server starts listening; previously it printed nothing, so the dev server looked stuck.
