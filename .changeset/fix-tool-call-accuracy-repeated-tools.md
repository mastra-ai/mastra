---
'@mastra/evals': patch
---

Fixed the code tool-call accuracy scorer returning 0 in non-strict mode when `expectedToolOrder` contains the same tool more than once (for example `search → inspect → search`). Each expected tool now matches a separate call, and extra calls between matches are still allowed.
