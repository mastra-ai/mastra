---
'@mastra/connect': patch
---

Fixed `anthropic_cancel_message_batch` failing after a successful cancel. Anthropic returns `null` for a batch's end time, archive time, and results URL until they exist, and the tool rejected those nulls even though the batch was cancelled. It now leaves those fields out of the result, as the other batch tools already do.
