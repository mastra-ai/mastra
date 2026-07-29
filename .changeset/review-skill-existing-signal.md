---
'@mastra/factory': patch
---

The factory-review skill now collects existing review signal before forming a verdict — submitted reviews, top-level comments, and unresolved inline threads from bots (CodeRabbit, scanners) and humans — and must disposition every substantive prior finding as confirmed, addressed, or refuted with evidence. Verdict calibration was tightened to stop lenient approvals: a severity rubric defines what is blocking (user-visible failures under any supported configuration, security holes, wrong package/API contracts, defects with cheap concrete fixes), any concrete change the author should make before merge forces a request-changes verdict, borderline calls tie-break toward request changes, and confirmed findings can no longer be laundered into assumptions or relabeled non-blocking to protect an approval.
