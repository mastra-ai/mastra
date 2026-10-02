# Experimental / behind a flag

**Reviewing:** isolation. The bar on polish is lower; the bar on containment is higher.
**Read first:** the flag boundary — where the flag is checked, and everything on the "off" side of it.
**Done means:** off by default; zero effect when off; removable without surgery; a plan for graduating or deleting it.
**Trap:** the flag leaks — "off" still changes something; "temporary" code that stays forever.
**Attention:** the off path. The on path is experimental by declaration; the off path is production.

## Questions

- **Is it actually off by default?** Find the default. Find every place the flag is read. Config, env var, constructor option — one of them defaulting to on is a leak.
- **Zero effect when off?** Trace the off path. New imports still load; new constructor args still validate; new fields still serialize. Any of these is an effect when off.
- **Where is the flag checked?** One place (good) or scattered through the codebase (each check is a place the flag can be forgotten)?
- **Is it removable?** When the experiment ends, can the flag and the off-path be deleted in one PR without touching unrelated code? If the flag check is woven into existing logic, it isn't.
- **Is there a plan?** Graduation criteria, an owner, a date, or an issue. "Temporary" without a plan is permanent.
- **Does the on path get the normal review?** Lower polish bar, not zero. Security and data-integrity questions still apply — an experiment that corrupts data is still corruption.
- **Public surface.** Does the flag itself become public API? If users can set it, removing it later is a breaking change.
- **Tests.** Both paths tested? The off path especially — it's what everyone runs.
- **Docs.** Is it documented as experimental, or documented as if stable?

## Signals → branches

- Flag read in more than ~3 places → request consolidation so the flag can be removed cleanly
- Off path has new imports / side effects at module load → leak; request isolation before merge
- Flag exposed in public config with no "experimental" marking → it's public API now; changeset and docs questions apply
- No tracking issue / no owner → request one, and ask for the removal plan
- Experiment touches storage or wire format → load `schema-storage.md` regardless of the flag; data written under the experiment outlives it

## Verify

- **Run the off path** on the branch with the flag unset; diff observable behavior against base. It should be identical; record any meaningful difference.
- Grep every read of the flag: `grep -rn "<flag name>"` on the branch — count and list.
- Confirm the default with a pointer.
- Tests: `grep -n "<flag>" <test files>` — both branches exercised?
