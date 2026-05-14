### 5.7f Durable Work Read Model

**Durable work read model.** `SessionListItem.durableWork` and
`SessionSnapshot.durableWork` summarize the source-specific recovery rows above
for first-party clients after reload, restart, or SSE replay gaps. They do not
own recovery and do not create a generic work table: queue receipts, wakeup rows,
channel inbox/action/outbox rows, inbox response receipts, goal continuation
receipts, accepted-signal result evidence, and qualified reconstructable
background-task rows remain authoritative. A summary row can report whether the
UI should expect automatic recovery, the next retry time, or an expired retained
operation, but clients still settle message/queue promises through the result
lookup routes and use channel diagnostics or scoped background-task routes for
detailed source-specific inspection.
