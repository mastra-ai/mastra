---
'@mastra/core': patch
---

Fixed channel agents being unable to read text attachments such as `.txt`, CSV, JSON, YAML or log files shared in Slack. Previously the agent only received the file's private Slack URL, which can't be opened without Slack credentials. The file is now downloaded through the adapter's authenticated fetch and its contents (up to 128 KB) are given to the agent as text. Fixes #28854.
