---
'@mastra/playground-ui': patch
---

Improved trace search in Studio: when a span matches your search only through its metadata, attributes or error payload, its name in the timeline is now painted in a distinct color so you can see why the row is there without opening it. Spans matching by name keep the usual highlight.
