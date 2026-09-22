---
'@mastra/factory': patch
---

Fixed GitHub sessions not being subscribed to pull requests they opened through the shared `source_control_create_change_request` tool. Comments and closes on those pull requests now reach the session, and the transcript shows the pull request link.
