---
'@mastra/factory': patch
---

Channel-backed runs (Slack) get an `attach_file` tool that uploads a file from the session workspace — a report, export, or image the agent produced — straight into the thread it is replying in, instead of pointing the sender at a sandbox path. The tool is offered whenever the run's thread maps to a chat thread, including runs woken by a signal (a subagent finishing, a schedule firing) rather than an inbound message, which is where a long job usually ends with a file to hand back. Files over 50 MB are refused.

Uploading needs the `files:write` bot scope. Factory brings its own Slack app, so add `files:write` under OAuth & Permissions → Bot Token Scopes and reinstall the app; without it, `attach_file` fails with a message naming the missing scope.
