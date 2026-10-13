---
'@mastra/playground-ui': patch
---

Fixed `PageHeader` shifting between pages. The title row is now 32px tall with the title in the same position whether or not the header has an icon or `PageHeader.Action`, so moving between pages no longer moves the title. `PageLayout` also reserves the scrollbar gutter in its scroll area, so a narrow, centered column no longer shifts sideways when a page starts to scroll.
