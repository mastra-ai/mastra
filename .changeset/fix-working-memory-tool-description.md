---
"@mastra/memory": patch
---

Fixed working memory tool description to accurately reflect merge behavior. The previous description incorrectly stated "Set a field to null to remove it" but null values are stripped by validation before reaching the merge logic. The updated description clarifies: omit fields to preserve existing data, and pass complete arrays or omit them since arrays are replaced entirely.
