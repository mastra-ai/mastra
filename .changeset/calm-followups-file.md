---
'@mastra/factory': patch
---

incident.io boards in Factory no longer create cards while a list loads. Factory now checks incident.io every five minutes and files new follow-ups itself. It files only follow-ups from a source bound to a project. This happens with no board open. The `MASTRACODE_INCIDENT_IO_RECONCILE_ENABLED` setting is removed: the check always runs. To stop incident.io for one organization, turn it off in Settings › Work Intake.
