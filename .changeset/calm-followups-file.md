---
'@mastra/factory': patch
---

Fixed slow incident.io boards in Factory. Opening a board no longer creates cards while the page loads. New incident.io follow-ups in a source bound to a project now get their card from the background sweep (every 5 minutes by default), whether or not anyone has the board open. Setting `MASTRACODE_INCIDENT_IO_RECONCILE_ENABLED=false` now also stops new follow-ups from getting cards.
