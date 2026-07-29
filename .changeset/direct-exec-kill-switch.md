---
'@mastra/platform-workspace': patch
---

Fixed sandbox command execution to stop retrying the direct connection after it fails once. Previously, every command on an affected sandbox paid for a failed connection attempt before falling back; now the sandbox switches to the fallback path permanently and commands run without the extra delay. Added a diagnostic warning with connection failure details to help identify the underlying cause.
