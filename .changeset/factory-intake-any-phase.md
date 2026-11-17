---
'@mastra/factory': patch
---

Intake rules that file new cards can now target any non-terminal phase of their board, not just phases the board's first phase can move to. The `unreachable_phase` refusal is gone: a rule on, say, "Pull request opened" can file cards straight into a PR review phase even when the board's first phase doesn't move there, and the rule builder's phase picker offers every phase but the finished ones. Stored rules that previously fell back to the board's first phase because of this check now file into the phase they name — whether the card arrives from a provider or is created by hand without naming a board — and a phase with `autoStart` starts its run on arrival as usual. Terminal phases still refuse filing, arrival rules still stay on their own board, and a card that can't work in a phase (an issue without a pull request aimed at PR review) is still skipped.
