---
'@mastra/evals': patch
---

Fixed relaxed-order trajectory accuracy scoring so one misplaced step costs one step no matter where it moved. Before, an expected step that the agent ran late could leave every later in-order step unmatched and drop the score to near zero. Such runs now get a higher score.
