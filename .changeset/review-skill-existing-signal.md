---
'@mastra/factory': patch
---

Factory review verdicts are stricter and grounded in the full review record:

- The reviewer reads existing reviews first — bot and human — and every substantive prior finding is confirmed, addressed, or refuted with evidence. Confirmed unaddressed major findings block approval.
- Approval is earned: any concrete change the author should make before merge means "request changes", borderline calls tie-break toward "request changes", and real defects can't be relabeled non-blocking to protect an approval.
- The reviewer runs the changed packages' tests and typecheck itself instead of trusting green CI, and every approval must survive an adversarial self-check.
- PRs with merge conflicts still get a full review but are never approved and never have their conflicts resolved by the reviewer.

Reviews arrive on the pull request itself, published via `gh pr review --approve` or `gh pr review --request-changes` before the review pass completes.
