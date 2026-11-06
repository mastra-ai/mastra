---
'@mastra/playground-ui': patch
---

Improved Knowledge explorer notes. A note now shows a linked page's title instead of its `[[scope#path]]` ref, with the ref on hover. This applies to a page's Notes and Mentioned in lists and the graph's mention popup.

Fixed links to pages under parents the explorer hasn't loaded, such as imported Notion pages. Mentions and body links to these pages now link correctly.

Fixed long refs, page names and scope addresses running past their note card. They now wrap or truncate inside it.
