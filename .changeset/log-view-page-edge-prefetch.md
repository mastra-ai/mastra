---
'@mastra/playground-ui': patch
---

Fixed `LogView.List` sometimes needing a second scroll to load the next page. Rows that render taller than expected, such as stack traces, could push the loading row out of view just as the scroll reached the end. The list now starts loading the next page when its end is within one screen of view.
