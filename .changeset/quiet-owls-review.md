---
'@mastra/factory': minor
'mastra': patch
---

Work items now get an independent self-review before their pull or merge request opens. After Building, the builder pushes the branch and moves the card to Review without opening a PR. A separate review agent tests and reviews the branch there with the `factory-self-review` skill, using the same bar as PR review. If it requests changes, the card goes back to Building with the findings. If it approves, the card stays in Review and the builder opens the PR from the approved head, with the test report in the body.

Factory enforces this on the server: a Work-bound session cannot open a change request until self-review has approved the exact branch head being proposed. After three request-changes rounds, the card parks in Intake for a person to decide; agents cannot move it until someone does. Cards that already have an open PR keep their current flow.

Self-review is off by default. Turn it on per project with the "Self-review before pull requests" switch in Automation settings. While it is off, the builder opens the PR directly from Building, as before.
