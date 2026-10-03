---
'@mastra/core': patch
---

Fixed DurableAgent traces splitting into two root spans after a resume or crash recovery. The resumed or recovered agent run span is now nested under the original agent run span, so the trace stays a single tree. Its start time, status, and token/cost totals now cover the whole run rather than only the part after the resume.
