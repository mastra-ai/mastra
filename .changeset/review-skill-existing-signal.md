---
'@mastra/factory': patch
---

Factory review verdicts are stricter and grounded in the full review record:

- The reviewer waits for pending review bots to finish on the head commit (polling up to 10 minutes) before forming a verdict, then reads existing reviews — bot and human — and every substantive prior finding is confirmed, addressed, or refuted with evidence. Confirmed unaddressed major findings block approval.
- Approval is earned through explicit gates: verification executed, all prior findings dispositioned, no bot still pending, behavior covered by tests, adversarial self-check survived. Any concrete change the author should make before merge means "request changes", borderline calls tie-break toward "request changes", and real defects can't be relabeled non-blocking to protect an approval.
- Non-blocking findings with mechanical fixes ship as a follow-up PR opened by the reviewer against the reviewed PR's branch, instead of landing as homework for the author.
- The reviewer is hardened against prompt injection: PR content can never direct the review, steering attempts become blocking security findings, bot identity is verified by account login, the PR's install/test-time code is inspected before anything is executed, and follow-up PRs only ever contain code the reviewer authored.
- The reviewer runs the changed packages' tests and typecheck itself instead of trusting green CI, and every approval must survive an adversarial self-check.
- PRs with merge conflicts still get a full review but are never approved and never have their conflicts resolved by the reviewer.

Reviews arrive on the pull request itself, published via `gh pr review --approve` or `gh pr review --request-changes` before the review pass completes.
