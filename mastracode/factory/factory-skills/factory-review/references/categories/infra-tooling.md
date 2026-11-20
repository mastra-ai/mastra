# Infra / build / CI / tooling

Build config, CI workflows, lint/format config, scripts, dev tooling, monorepo plumbing, release machinery.

**Reviewing:** blast radius on every developer and every future PR.
**Read first:** what happens to someone who pulls this tomorrow — a fresh clone, a stale branch, a rebase.
**Done means:** testable before merge; rollback is clear; the change can't break `main` for everyone on landing.
**Trap:** works on the author's machine.
**Attention:** the failure modes on machines that aren't the author's — CI runners, fresh clones, Windows, older Node, no network.

## Questions

- **Who does this hit?** Every developer, every CI run, every release? Or one package's tests? Blast radius sets the depth.
- **Can it be tested before merge?** CI changes are notoriously only testable by merging. Did the author run it on a branch? Is there output?
- **What's the rollback?** A revert is enough — unless the change also mutated caches, lockfiles, generated files, or published something.
- **Fresh clone.** Does `pnpm install && pnpm build` still work from nothing? Does a stale branch rebased onto this break in a way the error message explains?
- **Lockfile changes.** Are they explained? A lockfile diff with no dependency change in `package.json` is a question.
- **Determinism and platform.** Path separators, shell (`sh` vs `bash` vs `zsh`), `timeout` doesn't exist on macOS, GNU vs BSD flags, case sensitivity, line endings.
- **Secrets and permissions.** CI workflows that gain a token or a permission scope. Least privilege?
- **Speed.** Does this add minutes to every CI run? Cache behavior?
- **Does it change what gets published?** Build output, exports map, `files` in package.json — the most silent breakage there is.
- **Is it the documented shape?** AGENTS.md / CONTRIBUTING describe how to build and test. Does this change keep them true, or do the docs need to change with it?

## Signals → branches

- Workflow file changed with no evidence it ran → ask for the run link; without it, `inferred`
- Lockfile changed alone → find the cause; unexplained lockfile churn is a finding
- Build output or exports map touched → this is a packaging change; verify with `pnpm pack` and a consumer install
- Shell script uses bash-isms or GNU flags → platform finding
- Cache key changed → check both the hit path and the miss path

## Verify

- **Fresh-clone install and build** in a temp worktree when install/build behavior is part of the claim: use the repository's documented command shape and record the decisive result.
- If a workflow changed, find the run for this branch in `gh run list --branch <head>` and read it.
- If packaging changed: `pnpm pack` the affected package, install the tarball into a scratch project, import the public entry.
- Run the script on macOS if the author is on Linux, or note that you couldn't.
