---
'@mastra/memory': patch
---

Trigger subconscious curation from volume and staleness, at every point in the turn that commits knowledge.

Previously the curator only ran on a count of committed observation runs, and only from the
synchronous observe path. A short conversation — one that captured knowledge and ended without ever
crossing an observation threshold again — could leave that knowledge uncurated indefinitely.

Two new options on `Subconscious`, both **off by default**:

```ts
new Subconscious({
  curationThreshold: 25, // run once 25 uncurated knowledge records have accumulated
  curationMaxAgeMs: 30 * 60_000, // ...or once the last curation is 30 minutes stale
});
```

Curation is now evaluated at step-0 activation, later-step activation, the synchronous observe
path, and the end of the turn.

**Nothing is scheduled.** `curationMaxAgeMs` is an opportunistic age threshold, not a timer and not
a background job: it is only consulted when the lifecycle is already evaluating, and it additionally
requires at least one uncurated record. An idle resource never triggers curation, and configuring
`curationMaxAgeMs` alone does nothing until new knowledge arrives — if you want curation to happen
on a quiet resource, call `Memory.runCuration` yourself.

Retry state is persisted on the observational memory record, so a curator that fails backs off
(1 minute, doubling, capped at 1 hour) and **stays backed off across a restart** instead of being
retried once per turn. A curator that reports `skipped` leaves the backoff untouched.

Known limitation: two live instances sharing one storage can still both decide to curate. There is
no atomic claim for this state today, and the curation cursor remains the real serializer — the
loser of a race re-processes records rather than corrupting them.

### Migrating from `curationCadence`

`curationCadence` is deprecated but still honoured as the volume trigger, and it warns once per
process. `curationThreshold` takes precedence when both are set.

**The unit changed.** `curationCadence` counted *committed observation runs*; `curationThreshold`
counts *uncurated knowledge records* since the last curation. One observation run can commit
several knowledge records or none at all, so carrying the same number across is not the same
cadence — a deployment that ran the curator every 5 observation runs will generally curate
*more* often at `curationThreshold: 5`. Start by raising the number, then tune against how much
knowledge your capture agent actually commits per run.
