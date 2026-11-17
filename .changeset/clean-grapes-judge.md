---
'@mastra/core': patch
---

Fixed durable and evented agent streams so completion and cleanup from an earlier execution preserve a newer or resumed run's status, live state, and replay history. Existing durable replay records remain readable after upgrading. Queued events retain their step ownership guard and publication options, including local-only replay exclusion, and registry cleanup handles publisher detachment failures. Stream cleanup stops the owning execution's producer and drains pending local publications before deleting replay history, preserving successors that take over during the drain. Denied cleanup attempts preserve run-record recovery after transient cache failures. Observer cleanup checks the captured execution fence so stale readers preserve resumed runs while current readers can release terminal state. Concurrent terminal events settle once after asynchronous replay filtering, and superseded terminal events preserve the reader's idle timeout.
