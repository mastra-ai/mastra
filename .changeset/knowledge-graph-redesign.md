---
'@mastra/playground-ui': patch
'mastra': patch
---

The Knowledge graph now loads like the tree instead of drawing the first 250 pages at once. It starts from the scopes and their first level, lays pages out in rings around the focused page, and draws pages more than one step away as small dots you can hover to name and click to focus. Parents show how many children they have ("281", "1000+") and dots standing in for unloaded children load them on hover or click, with a "+N more" line when not all fit. Runs of three or more memory scopes of the same kind (such as thread scopes) collapse into one dot until clicked.

Lines between pages from notes and page bodies are off by default: the focused page shows its own links, out and in drawn differently, and each circle counts its hidden links ("↓3 ↑5"). An "All links" button draws every link between the pages shown.
