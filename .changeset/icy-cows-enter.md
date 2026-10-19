---
'@mastra/playground-ui': patch
---

Improved icon line weight so lucide icons look consistent across Studio. Icons drew a 1px line inside buttons and the `Icon` wrapper but a heavier one everywhere else (sidebar, inputs, tables). Every lucide icon now draws its line from one `--icon-stroke-width` token: 1.5px at 16px, a little lighter for smaller icons and heavier for larger ones. Custom product icons and brand logos are unchanged.
