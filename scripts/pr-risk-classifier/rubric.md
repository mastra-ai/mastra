# PR risk rubric

This file is the rubric the PR risk classifier gives the model. Edit it to tune ratings; the
classifier re-rates a PR whenever this file changes. Ratings describe **how much damage the
change could do to Mastra users if it is wrong**, not how big it is or how hard it was to write.

Rate the change from what the diff hunks actually do. File paths and blast radius (which package,
how many in-repo packages depend on it, who owns it) tell you how far a mistake would spread, but
they are evidence to weigh, never the verdict on their own. A comment or README edit inside
`packages/core` is still low risk. A three-line change to a retry or stream path in
`packages/core` that every agent goes through can be high risk.

## low

A reviewer can approve after a quick read. The change cannot alter behaviour users depend on, or
the possible impact is small, obvious and contained.

- Documentation, comments, JSDoc, README and changeset text.
- Tests, fixtures and recordings with no change to shipped code.
- Type-only changes that do not change a public signature (internal types, stricter local typing).
- Examples, templates and explorations that are not published as packages.
- A small, clearly correct bug fix in a leaf package (a single store, voice, auth, deployer,
  observability or channel provider with few or no in-repo dependents), with a test, that does
  not change its public API, persisted data or security behaviour.
- Internal repo tooling that does not run with secrets.

## medium

Needs a real review of the logic, but a mistake would be noticed quickly and affect a limited set
of users.

- Behaviour changes in a leaf package beyond a trivial fix: new options, changed defaults, new
  network calls, connection or transport handling.
- Additive public API in a shared package (new exports, new optional parameters) that leaves
  existing callers unchanged.
- Runtime dependency additions or version bumps, build and bundler configuration.
- CI workflows and GitHub Actions (always at least medium; these can run with secrets).
- Small, contained runtime fixes in shared framework packages (server, memory, deployer, cli,
  client SDKs) outside their hot paths.

## high

Needs careful review by an owner of the area. A mistake could silently break many users, lose
data or open a security hole.

- Hot paths in `@mastra/core` that nearly every user runs: the agent loop, model calls and
  streaming, retries and error processors, message list and memory, tool execution, the workflow
  engine, processors, storage base classes. Size does not matter here; a one-line change counts.
- Breaking or behaviour-changing public API in a widely used package (removed or renamed exports,
  changed defaults, changed return shapes).
- Storage schema changes, migrations, or anything that rewrites or reinterprets persisted data.
- Authentication, authorization, permission checks, secrets handling, sandboxing or
  input-validation boundaries.
- Concurrency, ordering, locking, cancellation and resume/suspend semantics in shared code.
- Workflows that run on `pull_request_target` or otherwise handle untrusted input with secrets.

## Tie-breakers

- When unsure between two levels, pick the higher one and say what would lower it.
- Tests that accompany a change lower confidence in a bug, not the blast radius; they can move a
  borderline change down one level but never take a hot-path core change below medium.
- The author's self-reported risk is context only. Rate the diff independently.
