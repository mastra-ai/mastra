---
'@mastra/react': patch
---

Fixed workflow watch results to use the workflow's canonical final result when the stream provides one, instead of inferring the result from the last step's output. This makes results accurate for workflows whose final output differs from their last step (for example, mapped or aggregated outputs).
