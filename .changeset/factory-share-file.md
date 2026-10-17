---
'@mastra/factory': patch
---

Channel-triggered runs (Slack) get a `share_file` tool that uploads a file from the session workspace — a report, export, or image the agent produced — straight into the thread it is replying in, instead of pointing the sender at a sandbox path. The tool is only offered when the run has a chat thread to post to; files over 50 MB are refused.
