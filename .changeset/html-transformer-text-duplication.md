---
'@mastra/rag': patch
---

Fix `HTMLHeaderTransformer` and `HTMLSectionTransformer` repeating the text they extract. `getTextContent` took an element's `text` — which already holds every descendant's text — and then recursed into the children and appended it again, so each level of nesting added another copy. `<div><p>Hello <b>world</b></p></div>` came back as `Hello world Hello world Hello  world world`. It now recurses only, joining the children with a space, so the text appears once and neighbouring blocks stay apart.
