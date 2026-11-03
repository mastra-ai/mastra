---
'@mastra/core': patch
---

Fill pinned Knowledge listings level by level within their token budget. A listing with `depth` 2 or 3 now shows every child that fits first, then grandchildren, and so on, instead of stopping at a fixed 50 entries in sibling order. Each entry still prints under its parent, and a listing that is cut still ends with `…and more; knowledge_list from: "<ref>"`.
