---
'@mastra/core': patch
---

Fixed `run.timeTravel()` into a `.branch()` with more than one condition. Everything after the branch was dropped: the run finished with an empty result and never ran the following steps, or, when a nested workflow suspended after the recovered step, the run stayed `suspended` with nothing left to resume and every later `resume()` failed. Steps after the branch now run with the branch's output, and the nested workflow resumes to completion.
