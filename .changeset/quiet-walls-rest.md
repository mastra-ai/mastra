---
'mastracode': patch
---

Updated MastraCode to use provider-aware Observational Memory idle activation.

MastraCode now sets `activateAfterIdle: "auto"`, shows an idle-time counter above the input after one minute of inactivity, and combines back-to-back OM activation markers into a single line.
