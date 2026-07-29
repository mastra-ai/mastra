---
'@mastra/code-sdk': patch
---

Fixed sandbox file tools (view, write, edit, list) failing with "Path not found" in Factory sessions when called with absolute paths inside the session working directory. File tools now also work on macOS-hosted local sandboxes, not just Linux VMs.
