# Category pages

One page per common PR category. After recording your own design and before opening the diff, load the pages relevant to the problem. As the actual change reveals additional categories, load those pages before reviewing their portions in depth. Do not skip relevant pages because the main skill seems sufficient. Use their review focus, traps, and approval criteria; reading is required, while checks are selected according to the change and its risks. Every page has the same shape:

- **Reviewing** — the _object_ under review. It's not the diff; it's a causal claim, an interface, an equivalence proof, a set of numbers. Same diff format, different thing under scrutiny.
- **Read first** — what to read before the diff. Reading the diff first is the wrong first move for almost every category.
- **Done means** — what has to be true for you to approve. This is the bar the category contributes.
- **Trap** — the characteristic way this category fools a reviewer. Knowing the trap is most of the page's value.
- **Attention** — where scrutiny goes. Some categories are 80% interface / 20% implementation; some the inverse.
- **Questions** — the activated subset of the question bank, written out.
- **Signals → branches** — when you see X, do Y. Opens only when the signal fires.
- **Verify** — useful ways to falsify the important claims. Recipes in `../archaeology.md`.

Consider every entry below against the behavior, compatibility boundaries, and failure modes the change touches, not just the PR's headline category. These pages contain broadly useful review knowledge; their names are not exclusive labels, and the triggers below are examples, not exclusions. If a page could plausibly help, err on the side of reading it. Reading more guidance does not require running every check it describes.

PRs are often mixed. Keep materially different conclusions separate. "Should be split" is a finding when mixing makes a portion harder to review than it would be alone; do not average distinct conclusions into one.

| Page                      | Reviewing                                         | When relevant                                                                                                                              |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `mechanical.md`           | That it's _only_ that                             | Renames, formatting, generated files, lockfiles, or version bumps whose noise could hide substantive changes.                              |
| `bug-fix.md`              | A causal claim                                    | Correctness fixes, regressions, defensive patches, or claims that an observed symptom is resolved.                                         |
| `behavior-change.md`      | Impact on everyone who relied on the old behavior | Changed defaults, ordering, thresholds, errors, retries, or other observable behavior—even with no API signature change.                   |
| `internal-capability.md`  | Architectural fit                                 | New internal mechanisms or integration with existing layers, hooks, registries, or lifecycle handling.                                     |
| `public-api.md`           | The interface                                     | New or changed public signatures, options, return types, errors, exports, or cross-package APIs.                                           |
| `refactor.md`             | An equivalence proof                              | Moved or restructured code, replaced implementations, or cleanup that claims to preserve behavior—even inside a feature or fix.            |
| `schema-storage.md`       | Irreversibility and the upgrade path              | Persisted data, migrations, wire/config formats, or compatibility between independently upgraded packages—even without a schema migration. |
| `performance.md`          | Numbers                                           | Performance claims, hot-path changes, caches, allocations, or work that grows with input size.                                             |
| `infra-tooling.md`        | Blast radius on every developer                   | Build/CI/scripts, install or release behavior, dependencies, published files, or package exports.                                          |
| `security.md`             | Completeness                                      | Untrusted input, permissions, secrets, filesystem/network trust boundaries, or vulnerability fixes—not just security-labeled PRs.          |
| `docs.md`                 | Truth                                             | Changed docs or examples, or API/behavior changes that could leave existing documentation false.                                           |
| `tests-only.md`           | Whether they'd catch anything                     | New, changed, weakened, or removed tests, mocks, fixtures, or shared test helpers—even alongside production changes.                       |
| `revert.md`               | That it's clean and the reason is recorded        | Full or partial reversions, manual undoing of earlier work, or rollback changes with dependent work still present.                         |
| `large-cross-cutting.md`  | Whether it should be one PR                       | Multiple concerns, packages, or architectural boundaries; mixed changes whose interactions or structure make review difficult.             |
| `experimental-flagged.md` | Isolation                                         | Experiments, feature flags, opt-in execution paths, or claims that disabling a feature leaves existing behavior untouched.                 |
