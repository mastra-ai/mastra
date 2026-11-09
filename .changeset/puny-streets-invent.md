---
'@mastra/factory': minor
'mastra': patch
---

Any board can now run the pull request loop. Factory finds each part of the loop from what a board's phases declare instead of from Work's phase names: the review phase that grants `factory_review_source` reviews pull requests, a review phase that only grants `factory_record_review_verdict` self-reviews the builder's branch, and the working phase that moves into it builds. Pull requests attach to cards on any such board, verdicts record there, and the Factory skills read the phase names from the card's own board.

**Breaking:** the exports that named Work's phases are removed (`PULL_REQUEST_REVIEW_PHASE`, `FACTORY_RULE_STAGES`, `FACTORY_ROLE_STAGES`, `isFactoryRuleStage`, `isFactoryRole`, `factoryLaneForRole` and related helpers). `FactoryRuleStage` and `FactoryRuleBoard` are now plain strings. Read a board's loop with `boardFlow(board)` from `@mastra/factory/boards` instead.
