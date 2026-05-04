---
'@internal/playground': patch
---

Fixed Studio Prompt Blocks edit page so picking an older version in the version dropdown correctly updates the editor and sidebar to that version's content. Previously the URL switched to `?versionId=…` and the "previous version" notice appeared, but the editor pane and description stayed stuck on the latest version because a spurious editor `onChange` dirtied the form on first render and gated the form-reset effect.
