---
'@mastra/playground-ui': patch
---

JSON in code editors, trace span payloads (Input, Output, Metadata, Attributes), dataset items, data detail panels and tripwire metadata can now be collapsed and expanded with the square toggle next to each object or array. The collapsed placeholder matches both the light and dark themes. Search and version diff highlighting on dataset items keep working on the collapsible view.

`CodeEditor` accepts a new `extensions` prop to add extra CodeMirror extensions after the built-in ones.
