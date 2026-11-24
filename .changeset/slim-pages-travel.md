---
'@mastra/core': patch
---

The Knowledge tree and graph readers (`listKnowledgeTreeChildren`, `readKnowledgePageGraph`) now return page summaries: every page field except `body`, plus `bodyLinks`, the `[[ref]]`s the body links and how many times each. A graph of 200 long pages no longer sends 200 bodies on every refresh. Read a page with `readKnowledgePage` to get its body.
