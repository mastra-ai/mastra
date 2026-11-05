---
'@mastra/playground-ui': patch
---

Knowledge explorer notes now show a linked page's title instead of its `[[scope#path]]` ref, with the ref on hover, in a page's Notes and Mentioned in lists and the graph's mention popup. Mentions and body links to pages nested under pages the explorer hasn't loaded (such as imported Notion pages) now link too, using the page the server resolved the note's mention to, or the page the host fetched by the link's ref.

Long unbroken refs, page names and scope addresses in Knowledge notes now wrap or truncate inside their card instead of running past it and scrolling the page sideways.
