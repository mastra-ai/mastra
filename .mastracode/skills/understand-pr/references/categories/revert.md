# Revert

**Reviewing:** that it's clean, and that the reason is recorded.
**Read first:** the `git revert` diff vs. the actual diff — are they the same?
**Done means:** pure inverse of the original commit(s); the reason for reverting is linked (issue, incident, failing run); anything the original PR fixed is either re-broken knowingly or handled.
**Trap:** a manual "revert" that isn't one — partial, or with extra changes mixed in.
**Attention:** the delta between this diff and a true `git revert`. Zero delta means a fast review. Any delta is the entire review.

## Questions

- **Is it a true inverse?** Generate `git revert <sha>` in a scratch worktree and diff against the PR. Any difference is a finding — either a hand edit or a conflict resolution that needs to be explained.
- **Why?** What broke? Is there an issue, an incident, a failing CI run linked? A revert with no stated reason is a behavior change with no stated reason.
- **What did the original PR fix, and is that now re-broken?** Read the original PR. If it fixed a bug, the revert reintroduces it. Is that acceptable, and is there a plan?
- **Did anything land on top of the original?** Commits since the original that depend on it. Reverting the base leaves them dangling.
- **Is this the smallest revert?** Reverting a whole PR when one commit was the problem. Or reverting one commit when the whole PR was.
- **Changeset.** A revert that undoes a released change needs a changeset; a revert of an unreleased change may need the original changeset removed.
- **Will it be re-landed?** If so, is there a tracking issue, and does this PR say so?

## Signals → branches

- Diff differs from `git revert` output → each difference is a question; conflict resolutions need explanation
- No reason linked → request the reason before merge; ask what broke
- Original PR fixed a user-reported bug → the revert reintroduces it; the briefing says so explicitly
- Commits since the original touch the same files → check each for dependency on the reverted change

## Verify

- `git revert --no-commit <sha>` in a worktree at the base; `git diff` it against the PR branch. Delta into the notes.
- `gh pr view <original>` — read what it fixed and why.
- `git log <original-sha>..<base> -- <files>` for anything that landed on top.
- `gh pr checks` on the revert branch — the revert should make CI green if a red CI was the reason.
