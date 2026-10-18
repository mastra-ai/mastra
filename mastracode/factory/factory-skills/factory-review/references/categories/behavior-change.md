# Behavior change (no new API)

A default, an ordering, a threshold, a format, a timing — something existing users observe changes, without a new surface.

**Reviewing:** impact on everyone who relied on the old behavior.
**Read first:** the callers and consumers of the changed thing — on the base, before the diff.
**Done means:** every affected caller is accounted for; the changeset level matches (a changed default is breaking); a changelog line exists that a user would understand.
**Trap:** labeled `patch`; nobody grepped the callers.
**Attention:** the consumers, not the change. The change is usually small; the blast radius isn't.

## Questions

- **Who relied on the old behavior?** Grep every consumer — in the repo, in `examples/`, in docs, in issues that mention the API. The author fixed it for their case.
- **Was the old behavior a decision or an accident?** `blame` the lines, open the originating PR, read why. If it was a decision, the PR must argue with it, not replace it. If the author doesn't know it was a decision, they haven't.
- **What happens to existing users on upgrade?** Walk it: a user on the previous version with existing config/code/data updates. What silently changes? Silent behavior changes are worse than errors — nothing tells the user.
- **Is the changeset level honest?** A `patch` that changes a default is a breaking change wearing a disguise.
- **What would the changelog line say?** If a user reading it wouldn't know whether they're affected, it's not written yet.
- **Does the description match the code?** Behavior changes are the most common thing smuggled into PRs labeled "fix" or "refactor."
- **Is there a compatibility path?** A flag, a deprecation window, an opt-in — or is it a hard cut? If hard, is that justified?
- **Cross-package.** If the changed behavior is observed across a package boundary, what does the other side see when only one of them upgrades?
- **In-flight work.** Other open PRs that depend on the old behavior.

## Signals → branches

- Category was triaged as "bug fix" but the diff changes a default/order/threshold → re-categorize; the description undersells scope — finding
- Changeset says `patch` → check whether any consumer's observable output changes; if yes, request the correct level before merge
- Originating PR explains the old behavior → deep history; the PR must engage with that reasoning
- No caller grep in the description → do it; every hit is a question

## Verify

- **Run it, before and after.** Write a minimal script that exercises the changed behavior through the public surface. Run on base (old behavior) and on the branch (new), then record the decisive difference.
- Grep callers/consumers on the branch: `archaeology.md` → Callers.
- `git blame -L` the changed lines on the base; open the originating PR.
- `ls .changeset/` and read the level.
- `gh pr list --search` for open PRs touching the same files.
