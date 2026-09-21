# Schema / storage / serialized state / wire format

Anything that changes what's written to disk, a database, a cache, a message on the wire, or a persisted config shape.

**Reviewing:** irreversibility and the upgrade path.
**Read first:** what's already on disk / in flight — the _old_ shape and who writes and reads it. Which package versions can coexist.
**Done means:** old data readable by new code; a rollback story exists; asymmetric package versions handled; the changeset level is `major` if any reader or writer must change.
**Trap:** "it works on a fresh install."
**Attention:** the migration and the readers, not the new shape. The new shape is usually fine; the transition isn't.

## Questions

- **Walk the upgrade.** A user on the previous version with existing data updates. What happens on first read? First write? What if they downgrade after writing with the new version?
- **Is it reversible?** Code reverts are free. Schema migrations, data transforms, and changed wire formats aren't. If this ships wrong, what's the rollback — and does rollback lose data? Irreversible changes get an order of magnitude more scrutiny and usually a flag.
- **Asymmetric package versions.** Packages are upgraded independently by users. `@mastra/core` at N+1 next to `@mastra/memory` at N — which side writes the new shape, which reads it, and what does the un-upgraded side do with data it doesn't recognize? Is the contract guarded (version field, optional fields, feature detection) or assumed?
- **Where does the code live?** Is the change placed in the package that owns the format, or in a consumer that will drift from it?
- **Old readers of the new shape.** Every reader of the format, in every package: grep for the field names, the table, the key. Each is a caller.
- **New readers of the old shape.** Does the new code tolerate rows/files written before this PR? Missing fields, old enum values, previous nesting?
- **Migration mechanics.** Is there a migration? Is it idempotent? Does it run automatically or need an operator? What happens if it's interrupted?
- **Is the semver right?** Any change a reader or writer must accommodate is `major`.
- **What's the failure mode?** When new code meets unexpected old data, does it error loudly with an actionable message, or silently coerce?
- **Determinism.** Serialization order, timezone, locale, number precision.
- **Performance at real size.** Migration over 50 rows vs 50 million; index changes on real tables.

## Signals → branches

- No migration and a changed shape → walk the read path for old data by hand; expect a finding
- "Backward compatible" claimed → find the test that reads old-shape data; if absent, it's an inferred claim
- Changeset is `patch` or `minor` → check whether any reader in another package must change; if yes, request the correct level before merge
- Field renamed rather than added → every external reader breaks; deep caller grep across packages
- Fresh-install tests only → run against a fixture written by the previous version

## Verify

- **Write old-shape data with the base, read it with the branch.** Use a fixture from the base writer and record the material compatibility result.
- Grep every reader/writer of the format across all packages: `archaeology.md` → Callers.
- Confirm the changeset level.
- If a migration exists, run it twice on the same fixture (idempotence) and interrupt it once if the mechanism allows.
- Check the package boundary: which package's version bump carries the change, and what the other package's current published version expects.
