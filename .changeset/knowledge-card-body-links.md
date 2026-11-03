---
'@mastra/playground-ui': patch
---

Knowledge tool cards in chat now show `[[scope#path]]` links in a page body as links to the page, instead of the raw `[[...]]` text. A link opens when the tool result resolves it (the page itself, or a ref a note in the result mentions); any other ref shows as plain text.
