---
'@mastra/core': patch
---

Fixed `onFinish.text` including replies rejected by `processOutputStep` guardrails, including discarded retry attempts on durable agents. Earlier accepted step text is preserved. Fixes [COR-1464](https://linear.app/kepler-crm/issue/COR-1464/processoutputstep-abort-cover-evented-and-compare-all-three-engines).
