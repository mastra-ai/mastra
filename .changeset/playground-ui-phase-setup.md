---
'@mastra/playground-ui': minor
'@mastra/client-js': patch
---

Factory's phase setup now lives in `@mastra/playground-ui`: `BoardPhaseSetup`, `BoardPhaseSetupHoverCard`, `BoardPhaseSetupCard`, `AutoStartSwitch`, `RuleRow` and `usePhaseArrivals`, plus the rule helpers they read (board drafts, board flow, rule lanes, rule targets and condition fields). `@mastra/client-js` exports the rule types `RuleCondition`, `RuleGroup`, `RuleOperator` and `RuleValue`.
