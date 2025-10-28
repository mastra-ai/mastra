---
'@mastra/memory': major
---

Optimize default memory settings for semantic recall based on longmemeval data

- Increased default topK from 2 to 4 for greater accuracy improvement
- Lowered default messageRange from {before: 2, after: 2} to {before: 1, after: 1}
- This provides ~8% accuracy gain while only increasing max messages from 10 to 12 (20% increase)
- Updated documentation to reflect new defaults
- Fixed playground UI to correctly display the new default values
- These changes only affect users who enable semantic recall without specifying custom values
