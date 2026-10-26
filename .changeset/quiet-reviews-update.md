---
'@mastra/factory': patch
---

**Review:** Factory's GitHub review agent now updates its own earlier review and test report on a pull request when it can, instead of posting new ones on every pass, so pull requests no longer fill up with stale Factory reviews. It still posts a new verdict when the verdict flips state (GitHub cannot change a submitted review's state), when an approval was given on an older commit, or when GitHub refuses the edit.

Editing a request-changes verdict still wakes the agent that authored the branch, so in-place updates do not break the repair loop. Factory also now reads verdicts that sit below the Platform `> Opened by @user` attribution line; before, a request-changes verdict posted as a PR comment never reached the authoring agent.
