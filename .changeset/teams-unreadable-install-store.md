---
'@mastra/teams': patch
---

Fixed a stored bot credential that can no longer be decrypted (for example after the encryption key changed) crashing the runtime at boot and blocking disconnect. Unreadable installations are now skipped with an actionable error, and disconnecting the agent deletes the record so it can be re-provisioned.
