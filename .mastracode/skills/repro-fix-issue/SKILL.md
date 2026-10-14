---
name: repro-fix-issue
description: Reproduce a Mastra GitHub bug with a real-scenario end-to-end case in the durable-repro suite, validate the issue and any existing PR red/green, harden the fix, and land it. Use when burning down bug issues, verifying a fix PR against real behavior, or deciding whether an issue is already fixed on main.
---

# Repro → Validate → Fix

Prove every bug with a realistic scenario before trusting any fix. Unit tests in a PR show the mechanism. The suite case shows a user would actually hit the bug, and that it's gone.

## 0. Setup (once per worktree)

- Suite lives at `examples/durable-repro` (git-excluded, not committed). If it's missing, rsync it from another worktree, excluding `node_modules .runs results .mastra *.db`, then run `pnpm i --ignore-workspace`.
- Run cases with `pnpm suite --case <id-prefix>` (also `--issue <n>`, `--area <a>`, `--list`).
- The suite links workspace packages, so **rebuild the package you change** before running. Check the package's script: core uses `pnpm build:lib`, observability uses `pnpm build` (tsdown), memory uses `pnpm build:lib`. A failed build silently leaves the old dist, so always check the exit code.

## 1. Pick and scope

- Prefer easy bugs first: a clear repro in the issue, a single package, a likely small fix (one file or function), no design questions, and no open PR already being driven. Leave large or ambiguous issues for later.
- Read the issue and **form your own theory of the cause before reading any PR** (see `understand-issue`).
- Find existing PRs: `gh pr list --state all --search "<n>"`. For umbrella issues, check which sections already merged, so you only work on what's left.
- Check main first: `git fetch origin` and look at `git log origin/main -- <file>`. Issues are often already fixed by unrelated work (e.g. #26483 was fixed by #25906).
- Skip, and say why, when the issue needs a cross-adapter storage API change, an open team design decision, or (per user preference) changes in the durable-agent or agent loop.

## 2. Write the scenario case (red)

- Put it in `suite/cases/<area>.ts`, exporting `cases: Case[]`. Register it in `cases/index.ts` (`CASES` array), and add `<n>|case|<area>|<title>` to the raw list in `catalogue.ts`. Add a new area to the `Area` type if needed.
- Model **the user's real situation**, not the internal function. Examples: batch-charging orders with one card declined; a support workflow with a nested triage workflow; two tenants' background tasks; a serverless handler calling `flush()`.
- Use `world(agents, extra)` from `../parity` for a Mastra instance with LibSQL. Use scripted models (`MastraLanguageModelV2Mock` with `doGenerate` / `doStream`) so runs are deterministic. Use subclasses or slow promises (`sleep`, gates) to expose ordering and race bugs.
- Make each assertion a `check(name, pass, JSON.stringify(evidence))` that states user-visible harm. Include a **control** (default engine, OpenAI baseline, or top-level step) that passes on main.
- Run it on main. It **must fail for the reported reason**. If it passes, the bug may already be fixed: verify with real backends (e.g. a Docker MySQL) before closing.

## 3. Validate the fix (green)

- Apply the PR without checking out its base: `git fetch origin pull/<n>/head:pr-<n>`, then `git diff $(git merge-base origin/main pr-<n>) pr-<n> -- <src paths> | git apply`. Leave out changesets. Stacked or stale PRs may need a manual port.
- Rebuild, then rerun the case (it must pass) and the package's unit tests for the area.
- Red/green the PR's own tests too: revert only the source and confirm they fail.

## 4. Harden

Don't stop at "the PR works". Probe what the PR says it doesn't cover, plus CodeRabbit and other bot findings:
- id collisions, nested or unregistered entities, ownerless or cross-instance paths, empty-string ids, errors swallowed without logging, assertions that would also pass on wrong behavior (add `toHaveBeenCalledTimes`).
- Write a failing test for each real gap, fix it properly (no workarounds), and push to the PR branch when it isn't a fork (`isCrossRepository: false`).
- Note adjacent bugs you find (e.g. the evented engine skipping step scorers) as separate follow-ups. Don't expand scope.

## 5. Land

- CI failures: compare against the PR's base date. Stale bases are common (lockfile, `changeset pre exit`). Merge `origin/main` in a temporary worktree (`git worktree add /tmp/pr<n> pr-<n>`, merge, push to the head ref), then remove it.
- If there's no PR, branch `fix/<slug>`, add a changeset (read `.mastracode/commands/changeset.md`), commit with the co-author line, and run `gh pr create`.
- Approve with `gh pr review --approve`, including the scenario and red/green numbers (see `gh-review`). If an issue turns out to be already fixed, close the issue and any superseded PR with a comment citing the fixing commit and how you verified it.
- Revert the local patches (`git checkout -- <paths>`, then rebuild) so the worktree stays on main. Keep the suite case as a regression guard.

## Report back

Keep it short: issue → scenario → red evidence → green evidence → PR state and CI → follow-ups.
