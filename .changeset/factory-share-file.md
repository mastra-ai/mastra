---
'@mastra/factory': patch
---

Channel-triggered runs (Slack) get a `share_file` tool that uploads a file from the session workspace — a report, export, or image the agent produced — straight into the thread it is replying in, instead of pointing the sender at a sandbox path. The tool is only offered when the run has a chat thread to post to; files over 50 MB are refused.

Uploading needs the `files:write` bot scope. Factory brings its own Slack app, so add `files:write` under OAuth & Permissions → Bot Token Scopes and reinstall the app; without it, `share_file` fails with a message naming the missing scope.
