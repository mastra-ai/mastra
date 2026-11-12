---
'@mastra/factory': patch
---

Fixed a type error in the environment build schedule view after schedules gained one-off runs without a cron expression. A schedule without a cron expression now reports `cron: null`.
