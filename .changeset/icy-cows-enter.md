---
'@mastra/playground-ui': patch
---

Improved icon line weight so lucide icons look consistent across Studio. Icons drew a 1px line inside buttons and the `Icon` wrapper but a heavier one everywhere else (sidebar, inputs, tables). Every lucide icon now takes its weight from its size: 1.25px at 12 and 14px, 1.5px at 16px, 1.75px at 20px and up. Custom product icons and brand logos are unchanged.
