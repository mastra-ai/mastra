# New public API

**Reviewing:** the interface. The implementation can be fixed in a follow-up; the API can't be renamed once it ships.
**Read first:** the signature, then a call site you write by hand — before any implementation.
**Done means:** consistent with its three closest neighbors; extensible without breaking; documented; doesn't already exist under another name; you'd be happy to see the call site in someone's codebase forever.
**Trap:** reviewing the implementation carefully and the signature not at all.
**Attention:** 80% interface, 20% implementation.

## Questions

- **Line it up against three neighbors.** Pull the signatures of the three most similar public APIs. Compare: argument shape (positional vs options object), naming (`get`/`fetch`/`load`, `id` vs `Id`), return shape (value vs result object vs stream), error behavior (throws vs returns vs Result type), async-ness, how optional things are expressed. Any divergence needs a reason.
- **How will it be _called_, not how is it defined?** Write the call site. Does it read like the other call sites in a user's code? Would it look out of place in the docs next to its siblings?
- **The version-two problem.** Every public API gets extended. Can this one be extended without breaking? A positional boolean can't; an options object can. This is where "correct today, painful forever" gets caught.
- **Does it already exist under another name?** Search the public surface for the same capability. Duplicate APIs are the most expensive mistake because they're permanent.
- **Exports and types.** Is it exported from the same place its siblings are? Does it leak internal types into the public surface?
- **Does it use the right internals?** Find the sibling feature and read how _it_ does it. Same primitives, or a reinvented one — a second event bus, a second retry loop, a hand-rolled helper that exists three directories over? Reinvention is the #1 sign of not knowing the internals.
- **Trace one call end-to-end.** Pick the main entry point and follow it to the bottom. It should pass through the layers everything else passes through (auth, validation, logging, tracing, storage abstraction) rather than around them. A bypass is invisible in the diff because it's the _absence_ of a call.
- **What should it have hooked into?** Lifecycle hooks, middleware, processors, registries. New capability that doesn't register is invisible to observability, plugins, cleanup.
- **Docs and changeset.** A public surface change without docs is incomplete. The changeset level must match the contract change (`minor` for new surface; `major` if anything existing changes shape).
- **Is it over-built?** Options no caller sets, generics for one use, a config surface for a hypothetical. What does each option buy _today_?
- **Cross-package.** If the API spans packages, what does a consumer on an older version of the other package see?

## Signals → branches

- Signature diverges from all three neighbors → ask for the reason; absent one, request alignment with the neighbors
- Positional boolean or more than two positional args → version-two problem; request an options object
- Same capability found under another name → request removal of one before merge
- No call site in tests or docs → write one yourself and run it; if it's awkward to write, that's the finding
- Bypasses a layer the sibling goes through → request the same routing before merge; ask "which existing code did you model this on?" — a good answer names a file
- "Extensible" / "flexible" in the description → over-built check

## Verify

- **Write the call site and run it.** Tests are the author's claim; running it is your evidence. A scratch script importing from the package's public export, on the PR branch.
- Compare the signature against the closest public neighbors; record meaningful divergences and why they matter.
- `grep` the public surface (exports map, `index.ts`, docs) for the capability's nouns and verbs.
- Confirm export location matches siblings: `grep -n "<name>" packages/*/src/index.ts` and the `exports` map in `package.json`.
- Changeset present and at the right level: `ls .changeset/` on the branch, read it.
