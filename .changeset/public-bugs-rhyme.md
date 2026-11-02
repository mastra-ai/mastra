---
'@mastra/core': patch
---

Fixed `run.cancel()` leaving suspended nested workflow runs suspended after the parent was canceled. Nested runs, including foreach iterations, are now canceled with their parent on both the default and evented engines. Calling `cancel()` again on a run that is already canceled also cancels nested runs it left suspended. (#24780)
