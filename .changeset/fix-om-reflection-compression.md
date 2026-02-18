---
'@mastra/memory': patch
---

fix(memory): improve reflection compression reliability

- Refactor reflection retry logic to escalate through compression levels 0-3 (previously capped at 2)
- Add level 3 "critical compression" guidance for cases where prior levels fail
- Reduce default compression target from 50% to 25% reduction (sliceTokenEstimate * 0.75)
- Fix tokensBuffered marker to report actual slice size instead of total observation tokens
