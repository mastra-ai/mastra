---
'@mastra/factory': patch
---

Factory review verdicts are now published by `factory_publish_review` instead of composed by the reviewing agent and shelled out to `gh pr review`.

The review and re-review skills supply the review as data — findings, verification, prior-pass and existing-review dispositions, adversarial check, requested changes, assumptions, open questions. The tool renders the body, submits the verdict on the pull request, and appends the runtime attribution it reads at publish time.

**What this fixes**

- Reviews published without the `Review runtime: <model>, reasoning setting: <level>` footer, because the model did not copy it.
- A re-review in a session that switched model publishing the _previous_ pass's model, because the runtime was read once at the start of the thread.

**Approval gates are now enforced, not requested**

An approve without an adversarial check, or with no executed verification and no reason why, is rejected by the tool's schema. A request-changes verdict with no requested change is rejected too.

**Self-authored pull requests keep their handoff**

GitHub refuses a review verdict on a pull request its own token opened. The verdict then lands as a pull request comment, the channel the rule that wakes the authoring agent reads — a comment review would be classified as `commented` and dropped.
