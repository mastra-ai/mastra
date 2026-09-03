---
'@mastra/platform-workspace': patch
---

Repository templates now pin to the last default-branch head resolved for the same clone URL when the lookup fails, instead of dropping the repo steps and booting the base image.
