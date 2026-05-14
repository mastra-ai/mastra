# Harness Issue Tracker

This folder splits architecture and implementation-decision claims into one file
per issue.

Directory layout:

- `open/` contains active claims that still need reverification and resolution.
- `close/` contains claims moved out of `open/` after they are tackled, rejected,
  or intentionally deferred with a recorded source-of-truth section update.

Rules:

- Treat each open issue as a task to improve the `sections/` source of truth.
  The issue is not the spec; it is the reason, evidence, and closure trail for a
  section change, rejection, or deferral.
- Treat `sections/` as the source of truth for Harness v1. Before opening or
  changing an issue, search all relevant `sections/**/*.md` files and verify the
  concern has not already been tackled, deferred, or rejected.
- Doubt the claim before tracking it. Question its relevance, pertinence, and
  materiality for Harness v1: identify the invariant it protects, the section or
  code path it would change, and why the issue matters for architecture, logic,
  durability, concurrency, security, permissions, approvals, replay, or API
  behavior.
- Doubt the proposed solution too. Before editing `sections/`, ask whether the
  fix is overthought, too broad, or introduces a parallel concept. Prefer the
  smallest section change that resolves the invariant or records a deliberate
  deferral.
- Inspect the current Mastra codebase paths that own the behavior before adding
  or changing an issue. Do not rely on the spec alone when current code can
  confirm, weaken, or disprove a claim.
- Do not create a new issue when an existing open or close issue covers the same
  root flaw. Add evidence or reverify notes to the existing issue instead.
- Always inspect both `open/` and `close/` before adding, moving, or editing an
  issue. Decide whether the finding belongs as a new open issue, an update to an
  existing issue, a relationship entry, or a closed/regression-guard note.
- Every issue must include exact file references, why the current design is
  flawed, the better direction, why that direction is architecturally better, and
  what must be reverified before edits.
- Every issue must include a `Related Issues` section. List overlapping,
  prerequisite, dependent, or commonly-confused claims there. Use `None yet` only
  after checking both `open/` and `close/`.
- Before resolving an issue, inspect related section concepts and related issues
  for overlap. If an existing concept owns the behavior, update that canonical
  owner and add cross-references instead of duplicating the concept in another
  section.
- Treat relationships as required maintenance. When an issue is opened, closed,
  reclassified, merged, split, or materially edited, update its relationships and
  any directly related issue files so the graph stays useful.
- The "Why this is better" section must explain the logic and the relevant
  durability, concurrency, security, or API-contract tradeoff. It should also
  make clear why the alternative implied by current code or current spec text is
  weaker.
- Keep `examples/`, `reference/`, and `sections/12-usage-examples/` out of scope
  unless the user explicitly asks for them.
- Keep issue numbers stable. When an issue is resolved, move the file from
  `open/` to `close/` without renaming the number, update `Status`, update
  `Tags`, preserve/update `Related Issues`, and add a short resolution note that
  cites the section or code change.

Status values:

- `open`: verified enough to track, not yet fixed.
- `needs-reverify`: plausible but requires another source/code check before edit.
- `tackled`: spec or implementation has been updated and checked.
- `deferred`: intentionally out of v1 scope with a recorded safe fallback.
- `rejected`: claim was reviewed and intentionally discarded.

Tag convention:

- Open files must include `Tags: open`.
- `needs-reverify` files stay under `open/` and include `Tags: open,
  needs-reverify`.
- Closed files must include `Tags: close` plus the resolution status, such as
  `close, tackled`, `close, deferred`, or `close, rejected`.

Path reference convention:

- `sections/...`, `issues/...`, and `IMPLEMENTATION_READINESS.md` are relative to
  this Harness spec directory.
- `../packages/...`, `../mastracode/...`, and similar parent paths are relative
  to this Harness spec directory and point into the current Mastra codebase.
