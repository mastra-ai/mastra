---
'@mastra/factory': patch
---

Improved Factory PR reviews and re-reviews. The reviewer now writes its own design for the problem before opening the diff and judges whether the PR's approach and scope are justified, not only whether the implementation works. Before every verdict it checks its own requested changes: why each belongs in this PR, what happens if the author follows them exactly, and whether each verification probe could actually detect the failure it claims to rule out. Requested changes in the posted review are now written as direct, evidence-backed change requests with no optional tiers.
