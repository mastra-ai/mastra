---
'@mastra/factory': patch
---

Fixed sandbox settings becoming impossible to save when a previously stored value is no longer allowed (for example, a memory size above the new 8 GB limit). The outdated value is dropped and the provider default applies instead.
