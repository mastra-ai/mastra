---
'@mastra/factory': patch
---

Fixed GitHub authentication recovery in repository-backed Slack sessions. Reload the stored credential in the running sandbox, then retry the failed `gh` command:

```text
github_refresh_token({})
```
