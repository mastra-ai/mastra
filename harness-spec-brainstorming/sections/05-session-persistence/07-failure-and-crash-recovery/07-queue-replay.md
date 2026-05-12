### 5.7g Queue Replay

**Queue replay.** Items in `pendingQueue` are durable. The head item is removed
*after* its turn completes successfully. Before `signal.accepted`, recovery may
retry admission at least once, but it uses the same `admissionId` /
`admissionHash` so an admission that was accepted just before a crash returns
the original `runId` / `signalId`. After `signal.accepted`, the queued item is
post-admission recovery work: hydrate the same persisted content, attachments,
request context, and overrides only to reconcile or observe the accepted run,
not to create another accepted signal. Serializable per-turn overrides stored on
the queued item replay with the same values only when the original signal was
not accepted; §4.3 owns the override semantics. A queued item does not persist
`agentId`; before acceptance, drain resolves the effective mode through the
current `HarnessMode.agentId` binding and writes the selected `agentId` into
`currentRun` before calling the agent. If the selected mode or agent cannot be
resolved, the queue receipt moves through the normal retry/dead-letter
admission-failure path rather than running a fallback agent. There is no
`addTools` field to replay; see §4.3 and §5.1.
