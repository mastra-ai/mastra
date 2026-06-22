---
'@internal/playground': patch
---

Fixed PDF attachments failing to preview in the Studio chat. When a PDF was attached, the `data:application/pdf;base64,` prefix was added twice, producing a malformed `data:application/pdf;base64,data:application/pdf;base64,...` URL that the browser could not open. PDFs now preview correctly.
