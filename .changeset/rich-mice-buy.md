---
'@mastra/playground-ui': patch
---

Fixed the `link` button variant so it is always a link. `Button variant="link"` now renders an `<a>` with an href even when no link element is passed, instead of a button that only looked like one. A disabled link keeps its href and is marked `aria-disabled`.
