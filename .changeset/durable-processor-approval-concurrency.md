---
'@mastra/core': patch
---

Fixed durable agents running same-turn calls to a `requireApproval` (or suspending) tool in parallel when that tool was added by an input processor such as `ToolSearchProcessor`. Those calls now run one at a time, so a second approval no longer hangs after the first one is approved.
