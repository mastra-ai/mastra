---
'@mastra/factory': patch
---

Fixed workspace failures vanishing from the chat transcript. A workspace that failed to clone or start only flipped an internal flag that nothing rendered, so the session simply looked stuck with no reason given. The failure now appears as an error notice in the transcript — the same message the terminal already printed — for both the `workspace_error` and the failing `workspace_status_changed` event.
