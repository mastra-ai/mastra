---
'@internal/factory': patch
---

Send Factory's own pull requests straight to Review.

A pull request entered Review only when its author passed a repository-collaborator
permission check. A GitHub App bot is never a collaborator, so every pull request
Factory opened itself scored as untrusted and parked in Intake, waiting on a human
click — the exact opposite of the intent, since those are the pull requests whose
provenance Factory knows best.

Factory authorship is now its own trust signal for pull requests: the branch came
from a Work run this Factory dispatched. Issues are deliberately unchanged, because
auto-triaging an issue Factory opened is a self-loop with no upside.
