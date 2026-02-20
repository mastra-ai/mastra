---
'@mastra/playground-ui': patch
---

Fixed agent publish flow to no longer auto-save a draft. Publish now only activates the latest saved version. Save and Publish buttons are disabled when there are no changes or no unpublished draft, respectively.

Memory page improvements:
- Renamed "Last Messages" to "Message History" and added a toggle switch for consistency with other memory options.
- Moved Observational Memory to the top of the memory list.
- Observational Memory and Message History are now mutually exclusive — enabling one disables the other.
