---
'@mastra/factory': patch
---

Fixed Factory runs starting in the wrong repository when a project links several repositories. Automatic runs now stop when the target cannot be determined instead of choosing the first repository.
