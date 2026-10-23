---
'@mastra/factory': patch
---

**Review:** Factory's GitHub review agent now updates its own earlier review and test report on a pull request instead of posting new ones on every pass. A verdict that keeps the same state (still "request changes", still "approve", or a comment-form verdict) is edited in place; only a verdict that flips state posts a new review, because GitHub cannot change a submitted review's state.

Editing a request-changes verdict still wakes the agent that authored the branch, so in-place updates do not break the repair loop. Factory also now reads verdicts that sit below the Platform `> Opened by @user` attribution line; before, a request-changes verdict posted as a PR comment never reached the authoring agent.
