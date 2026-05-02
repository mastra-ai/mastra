---
'@mastra/slack': patch
---

Fixed Slack app creation failing when agent description exceeds 139 characters. The manifest description is now automatically truncated to prevent the Slack API from rejecting the request.
