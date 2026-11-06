---
'@mastra/factory': patch
---

Work Intake settings now respond at once. Adding or removing a source shows the change right away and saves in the background. The source drawer lists what you added, each with a Remove button, above the sources you can still add. A save no longer locks the rest of the page: changes save in the order you make them, and a change the server refuses is undone with the reason. If the server goes down mid-edit, the page and drawer stay open so you can retry.

incident.io now says when it couldn't load follow-up sources instead of showing an empty list. `GET /web/intake/sources` accepts `?integrationId=` to list one integration's sources without waiting on the others.
