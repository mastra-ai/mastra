---
'@mastra/playground-ui': patch
---

Fixed approving or declining a tool that requires approval inside a sub-agent delegation in Studio. Clicking **Approve** on the nested tool card previously sent the child's tool-call id, which the suspended parent run did not recognize, and failed with `could not find suspended run`. The approval controls now submit the tool-call id recorded in the approval entry, so the delegation resumes and the child tool runs. Fixes [#24065](https://github.com/mastra-ai/mastra/issues/24065).
