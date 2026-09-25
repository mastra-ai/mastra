---
'@mastra/inngest': patch
---

Fixed resuming the second of several tool approvals from one agent turn by its `toolCallId` on Inngest durable agents. Approving the next pending tool call right after its approval request arrived used to fail with `no suspended tool call with id`. The resume now waits briefly for the new approval to be saved. Fixes [#25158](https://github.com/mastra-ai/mastra/issues/25158).
