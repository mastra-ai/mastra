---
name: playground-snapshot-release
description: Compatibility entry for the retired Playground UI snapshot release. Snapshots are no longer published. Use when a request says playground snapshot, snapshot release, publish a snapshot, or ship a snapshot, and when getting a mastra-ai/mastra change (`@mastra/playground-ui` and its workspace dependencies) into the platform frontend through the published `alpha` dist-tag.
---

<overview>
Snapshot publication is retired. A change reaches the platform frontend only through the `alpha` dist-tag that the scheduled alpha release publishes from `main`. This skill keeps its old name so existing routers still resolve it. It checks whether a change is in a published alpha and what a bump would need. It authorizes no release, push, PR, dependency change, or deploy.
</overview>

<constraints>

- MUST NOT publish a snapshot, dispatch `publish_type=playground-snapshot`, publish from a custom branch or tag, or fall back to a snapshot because alpha is unavailable.
- MUST NOT resolve versions from `latest`; that is the stable channel.
- MUST NOT assume Mastra packages share one version or bump every `@mastra/*` package. Resolve each package the change needs on its own.
- MUST NOT dispatch workflows, open release or version PRs, or trigger bot pushes without specific approval for that action.
- MUST NOT hardcode a version or schedule from memory. Read the workflow files and the registry each time.
- Loading this skill or choosing a branch does not authorize publishing, pushing, PRs, tickets, deploys, merges, or dependency changes. A later bump follows the target repository's contribution rules, including review of UI changes and a covering ticket.

</constraints>

<context>

Why alpha only: the reported policy is to avoid mixing different versions of the same package (for example snapshot and alpha), which can install conflicting copies. Not every snapshot necessarily duplicates a package, and no failure is traced here. Private or object-storage delivery alone would not fix version graph inconsistency.

How alpha reaches npm, verified against `mastra-ai/mastra` `main`. Re-read these files before relying on them:

- `.github/workflows/cron-alpha-publish.yml` (workflow name Cron Alpha Version) runs on a cron and `workflow_dispatch`, on `main` only. It has no package filter input. It runs the full prebuild suite, then versions pending changesets in alpha pre mode. The bot commits `chore: version packages` and pushes `main`.
- `.github/workflows/npm-publish.yml` has a `prerelease` job. It reacts to that bot push or a manual `publish_type=prerelease` run, verifies alpha pre mode, runs a plain build, then runs `.github/scripts/publish-packages.mjs --tag alpha`. The publisher skips versions already on the registry and uploads only pending unpublished versions. A manual prerelease publishes already assigned versions and does not version new pending changesets.
- No current input limits an alpha to `@mastra/playground-ui`. The pipeline is repo-wide: build, tests and any pending changesets of other packages and their dependencies can be included. The publisher has an internal `--pnpm-filter-prod` option; it is not an approved way to run a scoped alpha, and changing the release pipeline needs separate approval.
- `.github/workflows/version-packages.yml` opens or updates the Changesets version PR on pushes to `main`, using the alpha tag and `changeset-cli version` in pre mode. It does not publish. Stable publication is a separate manual workflow.

Consequences:

- A feature merge does not guarantee an instant publish. The schedule and inputs change, so recheck the workflow files each time instead of trusting a remembered cron.
- A merge to `main` does not publish. The change is available only once a published alpha is proven to include it.
- Failing tests or no pending version bumps can prevent a fresh alpha. A run does not publish every package every time.
- An `alpha` tag in the registry is mutable. It does not update a consumer's pinned dependency.
- Do not assume consumer pins update automatically. Verify consumer updates in the authorized target repository.

</context>

<workflow>

## Routing a request

1. Snapshot requests (publish, release, or ship a snapshot, from any branch). Reject the snapshot route in one sentence, dispatch nothing, and continue with step 2 if the goal is getting a change into the platform frontend.
2. Confirm the source change has merged to `mastra-ai/mastra` `main`. If it has not, report that it must merge and wait for a normal alpha release. Do not publish from the branch.
3. List the packages the change touches and the platform frontend actually consumes. Skip the rest.
4. For each package, read the alpha version with read-only registry metadata, for example `npm view <package> dist-tags.alpha`, or `https://registry.npmjs.org/<package with / as %2f>/alpha`.
5. Verify the change is in that version. Map the version to the successful `cron-alpha-publish.yml` and `npm-publish.yml` run that published it (`gh run list`, `gh run view`), take that run's source commit or the package provenance, and confirm the commit contains the merge commit (ancestry, for example `git merge-base --is-ancestor`), not exact SHA equality. A null `gitHead` alone is not a blocker when the run, provenance, or package contents corroborate inclusion. Never invent proof.
6. If an alpha version was already assigned to the change but never published (its publish run failed or never ran), go to step 7. If no version has been assigned and no published alpha contains the change, go to step 8. If a published version exists but its source inclusion cannot be established from any evidence, report the evidence blocker and stop. Do not invent proof or start a new release as an automatic remedy. A registry that lags is not a reason to invent a version, retry on a timer, or publish a snapshot.
7. For an assigned but unpublished version, identify the assigned version and the failed publish run. Waiting or a new Cron Alpha Version run publishes nothing unless it creates a new version commit. Only after the user explicitly approves, dispatch the publish-only run: `gh workflow run npm-publish.yml --repo mastra-ai/mastra --ref main -f publish_type=prerelease`. Then verify the publication and that it includes the change (step 5). Report a failed run without retrying it automatically.
8. If no version has been assigned, first check that a pending changeset, or dependency propagation from one, will version the affected package. If none will, report that the change needs a changeset and that adding one needs separate authorization; do not offer waiting or dispatching. Otherwise either wait for the next scheduled run, or, only after the user explicitly approves starting a release, dispatch Cron Alpha Version on `main`. Do not execute it without that approval, and never use a snapshot or custom branch. With approval the command is `gh workflow run cron-alpha-publish.yml --repo mastra-ai/mastra --ref main`. Tell the user it runs the full suite and versions every pending changeset, so other packages and their dependencies may be included. A manual `publish_type=prerelease` run is not the versioning step. Report a failed run without retrying it automatically.

## Bumping the platform frontend

Only when the dependency change is separately authorized:

1. Pin the exact resolved version per package, never the `alpha` tag, and keep the lockfile consistent with the pins.
2. Keep scope minimal: no unrelated package or `admin-portal` updates. A compatibility update that the consumed packages' metadata or the task proves necessary is allowed. Do not force every Mastra package to one version.
3. Inspect the lockfile and resolved dependency graph with the project's native tools (for example `pnpm why` or `pnpm list`) for conflicting versions of the same `@mastra/*` package, especially mixed snapshot and alpha copies. Align consumer constraints on a compatible release where possible. No blanket upgrades, forced overrides or blind dedupe. If incompatible constraints or conflicting versions of one package remain, report and stop before publication; do not mask checks.
4. Run the project's own install and checks, then follow the Mastra UI review and Linear ticket gates before any PR.
5. Add a changeset where the repository policy requires one. Merging a changeset alone does not upgrade dependency consumers.

</workflow>

<format>

Report: packages checked, resolved alpha version per package, the run or SHA evidence that the change is included (or what is missing), and the one next action for Justin.

</format>
