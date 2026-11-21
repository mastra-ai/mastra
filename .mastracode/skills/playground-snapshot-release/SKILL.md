---
name: playground-snapshot-release
description: Get a mastra-ai/mastra change (`@mastra/playground-ui` and its workspace dependencies) into the platform frontend, either through a published `alpha` that already contains it or through a temporary snapshot that Platform later promotes to that alpha. Use when asked to release, publish, or ship a playground or studio UI snapshot, or to bump the platform frontend to a Mastra change.
---

<overview>
A snapshot is a temporary pin. Platform's `Promote Snapshot Pins` workflow (`.github/workflows/promote-snapshot-pins.yml`) replaces it with the first alpha whose npm provenance contains the merged source change, and opens a draft PR. It can only do that for snapshots listed in `frontend/mastra-snapshot-sources.json`. Loading this skill authorizes no publish, push, PR, ticket, dependency change, or deploy.
</overview>

<constraints>

- MUST use the alpha when published alphas of every needed package already contain the change, and MUST NOT publish a snapshot in that case. If any needed package lacks a qualifying alpha, either wait for it or publish one snapshot of the whole set and pin all needed packages to it. Never mix snapshot and alpha pins of one release, because the snapshot set already contains its own copies of the shared packages.
- MUST NOT dispatch any publish workflow without the user's explicit confirmation right before the dispatch. Publishing creates immutable npm versions.
- MUST NOT resolve versions from `latest`; that is the stable channel. Resolve each package on its own and never force Mastra packages to one version.
- MUST NOT retry a failed run, install, or publish on a timer. Report the failure.
- MUST NOT hardcode versions or schedules from memory. Read the workflow files and the registry each time.
- A Platform bump follows the target repository's rules: review of UI changes on localhost and a covering Linear ticket before any PR.

</constraints>

<context>

Why snapshots need promotion: mixing different versions of the same package, for example a snapshot and an alpha, can install conflicting copies. A snapshot that stays pinned keeps that risk, so it is promoted once an alpha includes the change.

How alpha reaches npm, verified against `mastra-ai/mastra` `main`. Re-read before relying on it:

- `.github/workflows/cron-alpha-publish.yml` (Cron Alpha Version) runs on a cron and `workflow_dispatch`, on `main` only, with no package filter. It runs the full suite, versions pending changesets in alpha pre mode, and pushes `chore: version packages`.
- `.github/workflows/npm-publish.yml` `prerelease` publishes with `--tag alpha` after that push or a manual `publish_type=prerelease` run. The publisher uploads only versions not yet on the registry. A manual prerelease does not version new changesets.
- The same workflow's `playground-snapshot` mode publishes `@mastra/playground-ui`, `@mastra/observability`, `@mastra/mcp-apps-components` and their workspace dependencies at `0.0.0-<tag>-<timestamp>`. It refuses `main`.

</context>

<workflow>

## 1. Pick the route

1. If the change has merged to `main`, check each needed package's `alpha` (`npm view <package> dist-tags.alpha`). Confirm the alpha's npm provenance (`https://registry.npmjs.org/-/npm/v1/attestations/<package>@<version>`) was built by `npm-publish.yml` on `refs/heads/main` from a commit that contains the merge commit (`gh api repos/mastra-ai/mastra/compare/<merge>...<commit>` returns `ahead` or `identical`). A null `gitHead` does not matter. If every package qualifies, skip to step 4 with those versions.
2. If it has merged but no alpha contains it, either wait, or with the user's explicit approval run `gh workflow run cron-alpha-publish.yml --repo mastra-ai/mastra --ref main`. That runs the full suite and versions every pending changeset. It releases nothing for a package that no pending changeset versions; report a missing changeset instead. Offer a snapshot as the faster path.
3. Otherwise publish a snapshot (step 2).

## 2. Publish the snapshot

1. Publish from the source PR's own branch in `mastra-ai/mastra`, with its final commits pushed. Promotion is automatic only when the snapshot commit equals the PR head when it merges; a snapshot from `main`, a custom branch, or an older head goes to manual review.
2. Resolve the commit from `mastra-ai/mastra` itself, not a fork: `head_sha=$(git ls-remote https://github.com/mastra-ai/mastra.git "refs/heads/$branch" | awk '{print $1}')`. Pick a short kebab-case tag that is not `latest`, `next`, `alpha`, `beta`, `rc` or `stable`.
3. Show the branch, SHA, PR, and tag, and ask for confirmation. The workflow has no SHA input and builds whatever its ref points to, so after confirmation push a one-off branch at exactly that commit and dispatch from it. Nobody else pushes to it, so the run publishes the confirmed commit and the branch name identifies the run:

   ```bash
   publish_ref="playground-snapshot/$tag-$(date +%Y%m%d%H%M%S)"
   git fetch https://github.com/mastra-ai/mastra.git "$head_sha"
   git push https://github.com/mastra-ai/mastra.git "$head_sha:refs/heads/$publish_ref"
   gh workflow run npm-publish.yml --repo mastra-ai/mastra --ref "$publish_ref" \
     -f publish_type=playground-snapshot -f tag="$tag"
   ```

4. Find the run with `gh run list --repo mastra-ai/mastra --workflow npm-publish.yml --branch "$publish_ref" --event workflow_dispatch --json databaseId,headSha,url`. Check its `headSha` equals `$head_sha`, then watch it with `gh run watch <id> --exit-status`.
5. Read the published versions from that run's log (`gh run view <id> --log | grep "Published @mastra/"`). The registry can lag behind the log.

## 3. Track it

In the Platform bump, add one entry to `frontend/mastra-snapshot-sources.json` listing every `@mastra/*` snapshot pin the bump adds, in any workspace package:

```json
{ "sourcePr": 12345, "linearIssue": "PLTFRM-1234", "packages": { "@mastra/playground-ui": "0.0.0-tag-20261120000000" } }
```

The promotion run fails, so someone is emailed, when a snapshot pin has no entry, an entry is invalid or stale, or a snapshot needs manual review.

## 4. Bump Platform

1. Pin exact versions in every workspace package that uses them, never a dist-tag, and update the version-keyed `@mastra/core` overrides in `pnpm-workspace.yaml` that name the old versions.
2. Run `pnpm install --lockfile-only`, then check with `pnpm why` or `pnpm list` that no `@mastra/*` package resolves to an extra or leftover version. Stop and report if one does. No blanket upgrades, forced overrides or blind dedupe.
3. Run the project's checks, get localhost review of any UI change, and open the PR only when the user authorizes it.

</workflow>

<format>

Report the route taken, each package and version, the provenance or run evidence, the tracking entry when a snapshot was pinned, and the one next action for the user.

</format>
