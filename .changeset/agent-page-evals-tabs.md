---
'@mastra/playground': patch
---

Reorganized the agent page in Studio: the Evaluate tab is now Evals, Agent traces is now Traces, and the Overview side panel is now Config. Review moved from a top-level tab to a tab inside Evals (old `/review` links redirect there), Run options now sits on the Evals sub-tab row next to Experiments/Datasets/Scorers, and the Editor tab is hidden entirely when `@mastra/editor` is not configured.
