---
'@mastra/code-sdk': minor
'mastracode': patch
'@mastra/core': patch
'@mastra/libsql': patch
---

Added native background-work lifecycle signaling and worker startup for Mastra Code agents. Read-only workspace tools and the Alexandria expert can opt into deferred or awaited background work, including over Mastra Code's Unix socket PubSub transport. Eligible tools remain foreground unless each call explicitly requests background execution. Deferred tools stay visible as persistent lifecycle rows, reconcile completion in place, preserve background provenance for the model and UI, and let the initiating assistant turn finish while work continues independently. Terminal tasks also persist a deduplicated latest-position completion card without duplicating authoritative tool results. These cards stay compact by default, expand with Ctrl+E to show bounded invocation and failure details, and specialized Alexandria rows now preserve background lifecycle provenance while reconciling their authoritative result in place. Mastra Code also shows a thread-scoped background activity indicator; Ctrl+G opens a read-only list of the current thread's tasks, D cancels the selected running task, and Alt+G clears its finished activity. Cancelled tasks reconcile their original tool row and persist a compact cancellation card for thread history. LibSQL background-task updates now correctly persist primitive JSON results such as plain-text tool output.
