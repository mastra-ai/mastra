---
'mastra': patch
---

Fixed CSV and other text uploads filling the Studio chat transcript. Text uploads now have compact, named previews while remaining readable by the model, including after reload. Unsupported local binaries such as XLS/XLSX are rejected with guidance to export as CSV instead of sending garbled content.
