---
'@mastra/playground-ui': patch
---

Fixed the icon of a field error sitting below its text: `FieldError` now centers it on the first line at any text size. A long unbroken value in the message (a variable name, a URL) wraps instead of stretching the field past its container.
