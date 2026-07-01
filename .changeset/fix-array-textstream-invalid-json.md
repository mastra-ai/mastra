---
'@mastra/core': patch
---

Fix array `textStream` emitting invalid JSON when the first streamed object chunk already contains elements. The JSON text transformer wrote a fully-closed array on the first non-empty chunk and then appended more elements plus another closing bracket, producing unparseable output. It now always streams incrementally, so the array `textStream` concatenates to a single valid JSON array. Closes #18758.
