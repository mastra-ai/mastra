---
'@mastra/playground-ui': patch
---

Search terms typed into the trace search field are now highlighted where the matches actually are: on the span names in the timeline tree, and throughout the span side panel, so a match is easy to spot inside a large payload.

Regions opt in to highlighting rather than opting out, so the chrome around a trace — the panel header, the trace metadata, the tab labels, the span type legend — is never painted, and nothing added later has to remember to exclude itself. Highlighting starts from the second character: a single letter matches almost everywhere and paints noise rather than results.

It uses the CSS Custom Highlight API, so no wrapper element is injected: the text stays exactly as rendered, and selection and copy/paste are unaffected. Browsers without the API simply show no highlight.
