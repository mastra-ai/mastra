---
'@mastra/factory': patch
---

Repository-backed Slack sessions can now recover from a failed `gh` authentication attempt without restarting the session. Refresh GitHub access, then retry the failed command:

```text
github_refresh_token({})
```
