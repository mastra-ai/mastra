---
'@mastra/memory': patch
---

Fixed Observational Memory relative dates being off by a day when memory is read on a server in a different time zone from the one that wrote it. For example, an event from 8 days ago showed as "7 days ago". Fixed "1 week later" showing as "6 days later" across a daylight-saving change. A planned action dated for the current day is no longer marked as likely already happened.
