---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed cross-agent thread ownership so a thread you open in a new mastracode instance is no longer held by an instance that merely visited it earlier.

Instances keep every thread they have loaded advertised so saved peers stay reachable. Before, the instance that loaded a thread first kept it forever: opening that thread in a second instance silently failed to advertise it, peers saw a stale title, and signals routed to the old instance. Now, when another instance asks to own a thread that is not your current one, your instance yields it. A thread you are actively looking at is never yielded.

The status line shows `open elsewhere` when your current thread is owned by another live mastracode process, with a one-line notice explaining that peer signals route there. Nothing is blocked; you can keep working on the thread.
