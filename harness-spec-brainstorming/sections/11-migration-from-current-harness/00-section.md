## 11. Migration from current Harness

The current `Harness` implementation has external consumers we don't directly
control. Renaming it would surface as a "the import I had no longer exists"
failure on a `@mastra/core` upgrade — exactly the kind of surprise the migration
story should avoid until a real major version (`@mastra/core` v2) is on the
table.

So v1 ships **two implementations side-by-side, both exported as `Harness`**,
from different subpaths:

- **`@mastra/core/harness`** — the existing implementation, **unchanged**. Same
class, same methods, same name. Existing callers keep working with no edit at
all.
- **`@mastra/core/harness/v1`** — the new, session-oriented API described in
this spec. Also exported as `Harness`. New callers explicitly opt in to the new
behavior by changing the subpath.

```ts
// Existing code — unchanged. Still works after `@mastra/core` upgrades.
import { Harness } from '@mastra/core/harness';

// New code — opt in to the v1 API by changing the subpath.
import { Harness } from '@mastra/core/harness/v1';
```

Two consequences of this layout:

- **No surprise breakage.** A team that depends on `@mastra/core` and never
touches `Harness` directly cannot end up with the new shape unintentionally. The
v1 API is reachable only through the explicit `v1` subpath.
- **Both are fully functional.** Each subpath ships its own implementation with
no shared runtime; either can be used in production. There is no `@deprecated`
marker on the legacy export — it stays a first-class entry point until
`@mastra/core` v2.

At `@mastra/core` v2.0, the legacy implementation is removed and
`@mastra/core/harness` becomes the primary import for the v1 implementation. If
`@mastra/core/harness/v1` exists at v2.0, it remains a supported compatibility
alias for the full `@mastra/core` v2 major, with removal deferred to a later
major boundary. See §11.3 for the timeline summary.

During `@mastra/core` v1, the two `Harness` classes are not
assignment-compatible. Mixing them in the same file is allowed (TypeScript will
see two distinct types) but rare; aliasing is the usual pattern when both must
coexist:

```ts
import { Harness as LegacyHarness } from '@mastra/core/harness';
import { Harness as HarnessV1 }     from '@mastra/core/harness/v1';
```
