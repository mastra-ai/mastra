---
'@mastra/core': patch
---

Fixed a thread failing on every turn when an attachment in its history can no longer be downloaded (for example a deleted file that now returns 404, or a stored data URL that can't be decoded). Error processors and fallback models still get the first chance to recover. If none of them do, the agent answers with the attachment replaced by an `[Attachment unavailable: <name>]` placeholder and logs a warning, instead of failing the turn.

The attachment is recorded as unavailable on its stored message (`metadata.mastra.unavailableAttachments`), so later turns show the same placeholder without trying to download it again. The attachment itself stays in history.

Attachments are also downloaded at most once per run, instead of once per step, when the model can't take their URLs directly. See #23705.
