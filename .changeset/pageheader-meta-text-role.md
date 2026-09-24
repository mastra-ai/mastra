---
'@mastra/playground-ui': patch
---

`PageHeader.Meta` now renders plain text as muted meta text, so metadata next to a page title no longer competes with the title. Badges and other components that set their own text style are unchanged. The medium `Badge` now sets its own letter spacing, so it looks the same inside styled text as anywhere else.
