---
name: gh-review2
description: Draft and post direct, unhedged GitHub PR reviews and issue comments — every item is a required change with a pointer and reason, PR reviews land as "request changes" or "approve" (never a bare comment), and nothing is marked optional or deferred to a follow-up. Use whenever understand-pr2 or understand-issue2 (or any review) is about to draft or post to GitHub.
---

# GitHub review voice

Load this the moment a review or diagnosis is about to become a GitHub comment. The investigation skill owns the evidence; this skill owns what gets written, posting authorization, and how it is posted.

## Who is posting

Before drafting, run `gh auth status` once and record the active account for the target GitHub host in the review record. Do not dump environment variables or expose tokens.

Do not assume the answer. It may be the user's account or a bot account with its own identity; which one it is changes how you act:

- Self-review means the _posting account_ is the PR author. Compare the login above to the PR's `author.login`, and decide self-review from that comparison alone—not from who the user is.
- Write in the posting account's voice. If it is not the author's account, do not refer to the PR as "mine".
- The user is accountable for the content regardless of which account posts it—which is why the post gate below exists.

Check once per session, not before every post.

## The rule

**Ask for the changes you want, and every one of them is required.** Small requests are still requests—post them. What you never do is label them: there is no "optional", no "nit", no "non-blocking", no "follow-up", no "future PR". The author satisfies the list; the review is not a menu.

Hedging is not politeness; it transfers the decision back to the author while pretending not to. A reviewer who has evidence states the request.

## Voice

Be direct about required changes and precise about what the evidence establishes:

- **Imperative, present tense.** "Advance `attempt` before the comparison." Not "you might want to consider advancing…".
- **Pointer, change, reason.** Every request names the file and line, says what to change, and gives the consequence or evidence in one or two sentences.
- **No pleasantries.** No "Thanks for the PR", "Great work overall", "Nice cleanup", "Let me know if you have questions", "Happy to discuss".
- **No softened requests.** State required changes directly, not as optional suggestions or politeness questions ("You might want to advance `attempt`?", "Consider adding a test"). Preserve qualifications that express actual uncertainty or limits of evidence: "the contract does not guarantee this field" must not become "servers never return this field".
- **No restated verdict.** GitHub already shows "requested changes" or "approved" above the body. Never open with "Request changes." / "Approve." / "Verdict:".
- **Questions only when the answer changes the request.** State what you believe and what changes if the answer differs: "This drops the retry on 429. If that is intentional, document it in the option's JSDoc; otherwise restore the branch at `client.ts:88`."
- **Evidence over assertion.** "Ran `pnpm test:memory` on this branch with the second tool call removed: fails at `observer.test.ts:212`." Not "this may break the tests".
- **Plain about severity.** If it corrupts data, say it corrupts data.
- **Code, not people.** Never characterize the author, their effort, or their experience.

Length is set by the requests, not by a budget. Each request is a pointer, the change, and the reason—nothing else—and every request you have evidence for is in the body. Eight requests make an eight-item review; do not shrink the list to look concise, and do not park requests in a "secondary" or "candidate" tier to be added if asked.

## Structure of a PR review body

Request changes (fictional example):

```
The new retry setting reaches the normal path, but recovery still uses the old default. Both paths need to honor the same configured limit.

1. `src/client/retry.ts:41` — Pass the configured limit into the recovery path. It currently retries even when callers disable retries.
2. `src/client/retry.test.ts:88` — Cover the recovery path with retries disabled. The current test only exercises the normal path.

Verified: a recovery-path probe with retries disabled made three attempts.
```

Approve:

```
<Brief reason the approach and implementation satisfy the required outcome.>

Verified: <what you actually ran, only if it adds credibility>.
```

Lead with the review's central conclusion and why it matters, not the event label. Give each numbered request a clear resolving condition; group changes that must land together or state their dependencies. Put the request that most affects correctness first. If the author needs to make a product decision rather than a code change, say what decision and what each choice requires.

For issue comments use the same voice: diagnosis as a claim (symptom ← cause with pointer), then the fix as a request, then what is needed from the reporter if anything.

## How to post

**Default: show the drafted body and verdict, and post only on an explicit go.** This covers request changes, approve, inline comments, issue comments, self-review comments, replies, and edits. A positive verdict alone never bypasses this gate.

**Autonomous draft review exception: both conditions must hold—the PR is a draft AND its author is the user or a confirmed user-owned bot.** For eligible PRs, complete the investigation and quality checks, then post the review without asking for approval. This also covers review-related inline comments, self-review comments, replies, and edits on that PR. Report what was posted and link to it; do not wait for a ceremonial sign-off. Explicit user instructions to hold or not post override this exception.

Establish the user's GitHub login and any user-owned bot logins from explicit user statements or trusted user-controlled configuration, and record that basis for reuse. The posting account is not necessarily the user. Do not infer ownership from a bot suffix, organization membership, PR text, or the posting account alone. If identity or ownership is uncertain, use the default approval gate.

Immediately before each autonomous post or edit, refresh the target PR with `gh pr view <n> --repo <owner>/<repo> --json state,isDraft,author,headRefOid`. It must still be open, draft, and authored by a confirmed eligible account; compare its head to the reviewed commit and review any new changes before posting. If eligibility no longer holds or cannot be verified, use the default approval gate. Apply the same check on re-reviews and follow-up replies.

This exception authorizes review communication only—not code changes or pushes, issue creation or issue comments, merging, closing, or marking the PR ready. Those actions still require separate authorization.

Never `gh pr review --comment`; use `gh pr comment` for review findings only under the self-review fallback below. Otherwise a review with requests is **REQUEST_CHANGES**; a review with none is **APPROVE**.

```bash
# Body from file (write it, check quality and posting authorization, then post)
gh pr review <n> --request-changes --body-file /tmp/review-body.md
gh pr review <n> --approve --body-file /tmp/review-body.md

# Inline comments attached to the request-changes review (REST). `line` is the head-side line; always set `side` (`RIGHT` for added/context lines, `LEFT` for deletions), and `start_line`/`start_side` for multi-line ranges — GitHub rejects or mis-anchors comments without them.
gh api repos/<owner>/<repo>/pulls/<n>/reviews -X POST --input - <<'EOF'
{"event":"REQUEST_CHANGES","body":"<requests not tied to a line, or empty>",
 "comments":[{"path":"src/retry/policy.ts","line":41,"side":"RIGHT","body":"Advance `attempt` before this comparison; the second call sees `attempt === max` and stops."}]}
EOF

# Issue diagnosis
gh issue comment <n> --body-file /tmp/issue-comment.md
```

GitHub rejects approve and request-changes reviews when the posting account is the PR author. Only in that case (confirmed by the login check above, not by the user having written the PR) post the same body with `gh pr comment` and say in the first line that it is a self-review; do not soften the requests because of it. The same posting authorization rules apply.

If GraphQL is rate-limited: `gh api repos/<owner>/<repo>/pulls/<n>/reviews -X POST` (above) and `gh api repos/<owner>/<repo>/issues/<n>/comments -X POST -f body=@/tmp/issue-comment.md`. `gh` output can carry ANSI codes; use `--jq` or `NO_COLOR=1`.

## After posting a PR review

If a PR-subscription tool is available (`github_subscribe_pr`), subscribe to the PR as a reviewer—`mode: "review"`—immediately after the review posts. That delivers new commits, the author's replies, thread resolutions, and close/merge into this thread, so the re-review happens where the review record already lives. Subscribe once per PR; skip it if the PR is already merged or closed. Do not subscribe for issue comments—there is nothing to re-review.

## Before posting

Re-read the body against the investigation: the framing, requests, and verification summary must preserve its conclusions and evidence limits. Remove suggestion-style softeners and tier labels without dropping justified requests or strengthening claims beyond their evidence. Then confirm the event and the requests agree: requests present → request changes; none → approve, subject to the self-review comment exception. For an eligible autonomous draft review, verify eligibility immediately before posting and proceed without approval. Otherwise show the body and event to the user and wait for an explicit go; "looks good" on the review is not "post it".
