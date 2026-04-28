---
'@internal/playground': patch
---

Fixed Review tab comments not persisting across page reload in the studio. Tags would survive a reload but typed comments would disappear, because the rehydrate path always reset the comment field to an empty string. Comments are now read back from the feedback store on load, matching how they are written when the textarea is blurred.
