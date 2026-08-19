---
'@mastra/factory': patch
---

Fixed Linear intake so issues only land in the Factory project their Linear project is routed to. Previously, opening any board pulled in every selected Linear project's open issues and auto-triaged them there, repeating for each Factory project you viewed.

**Routing Linear projects**

In Settings › Intake, each selected Linear project now picks the Factory it feeds. A project left unrouted no longer feeds any board, and boards only show the Linear intake feed for projects routed to them. Organizations with a single Factory keep working with no configuration.

**Deleted cards stay deleted**

Removing an intake card now also clears the stored routing decision behind it, so it no longer reappears on the next intake poll.

Fixes #21614
