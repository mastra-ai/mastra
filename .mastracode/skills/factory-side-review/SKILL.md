---
name: factory-side-review
description: Run an independent Factory side-session review of a pull request, post the verdict to GitHub against the reviewed commit, and hand it back to the author session. Use when a side session is started to review a PR, when re-reviewing after the author pushes, or when an author session receives a review verdict.
---

# Factory side review

A side review is a fresh session that did not write the change. Its job is to try to break the PR's main claim, post what it found on the PR, and tell the author session. Use `understand-pr` for the investigation and `gh-review` for the voice; this skill covers the parts specific to Factory side reviews.

## 1. Inputs

The starting prompt must give:

- PR number and repository
- author session ID (the worker that will act on the verdict)
- the origin session (whoever started the review) — reports go there automatically

If the author session ID is missing, find it from the PR body or branch name (`factory/item-<id>` maps to a work item; ask the origin otherwise). Do not start without a PR number.

## 2. Review

Record the head SHA first: `gh pr view <n> --json headRefOid,author,isDraft,state`. Every claim in the verdict is about that SHA.

Do not take the author's proof on trust. At minimum:

1. **Revert check.** Remove the fix and run the PR's new tests yourself. They must fail.
2. **Targeted mutation.** Pick the PR's central claim and break it a different way (e.g. resolve from the caller instead of the target, delete a cleanup instead of the guard, add a delay before the asserted step). If the tests still pass, the tests do not pin the claim — that is a required change.
3. **Real path.** Confirm the tests drive the production entry point, not a helper called with a hand-built context. Delete the fix line at the real call site and check the tests notice.
4. Run the changed packages' tests, `tsc`, and lint. Note failures that also fail on the base commit as pre-existing, with the base SHA.

Make no source edits, pushes, merges, label changes, or board moves. Throwaway edits for revert checks and mutations are fine; restore the tree (`git diff` empty) before posting.

Write the full report to `.mastracode/scratch/reviews/<owner>-<repo>-<n>.md`, appending one section per reviewed SHA.

## 3. Post to GitHub

Posting the verdict is part of the review; it does not need a separate go-ahead. Everything else in `gh-review` (voice, no optional items, pointer + change + reason) applies.

Immediately before posting, re-read the head. If it moved past the reviewed SHA, review the new commits first; never post a verdict for a SHA that is not the head without saying so.

Factory PRs are usually authored by `mastra-platform[bot]`, the same account that posts, and GitHub refuses approve/request-changes on your own PR. So:

- **Posting account ≠ PR author:** `gh pr review <n> --approve` or `--request-changes`, inline comments via the REST reviews endpoint (see `gh-review`).
- **Posting account = PR author:** submit the same body as a review with `event: "COMMENT"` through `gh api repos/<owner>/<repo>/pulls/<n>/reviews -X POST`, inline comments included. A human approval is still needed to merge; say so in the report to the origin.

Body format (first line is fixed so humans and tools can parse it):

```
Factory side review: APPROVE at <full head SHA>
```

or `REQUEST CHANGES at <sha>`, then:

- one or two sentences on the central conclusion
- numbered required changes, each `path:line` — change — reason (request changes only)
- `Verified:` the revert check, the mutation, and what each did (e.g. "removing the target-scope lookup: 1 failed / 41 passed")
- `Pre-existing:` failures that also fail on base, with base SHA
- `Not verified:` what you did not run

Do not resolve review threads; the author resolves them after replying. Do not reply to bot reviewers (CodeRabbit etc.) on the author's behalf.

After posting, subscribe to the PR (`github_subscribe_pr`) if the tool exists, so new commits reach you.

## 4. Hand back to the author

Send the author session the verdict with `factory_signal_session`:

```
Review of PR #<n> at <sha>: <APPROVE|REQUEST CHANGES>. <review URL>
Required changes: <numbered list, or "none">
Reply to each thread, push to the same PR, and signal me (<your session ID>) with the new head.
```

Use priority `high` for request changes, `medium` for approve.

If `factory_signal_session` is not available or refuses the target, send the same text to the origin with `factory_message_origin` (status `done`) and include the author session ID, so the origin relays it. Say in the message that the direct signal failed and quote the error.

Then finish with `factory_message_origin` status `done`: verdict, SHA, review URL, report path, and whether the author was signalled directly.

## 5. Re-review

When the author signals a new head (or a PR subscription delivers new commits), the previous verdict is stale. Review only the delta plus anything it touches, rerun the revert check and the mutation that failed before, post a new review with the new SHA, and signal the author again. Repeat until APPROVE.

## 6. Author side

When an author session receives a verdict:

1. Fix each required change, with a test that fails without the fix.
2. Reply on each review thread with the commit that addresses it (`Fixed in <sha>: ...`), then resolve the thread. Reply but do not resolve threads you disagree with; state why.
3. Push to the same PR branch and update the PR body's Proof / Unverified / Risk.
4. Signal the reviewer session with the new head SHA. If that fails, report to your origin with the reviewer session ID.

Never merge on a side-review APPROVE alone; merging stays with a human.
