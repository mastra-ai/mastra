---
'mastracode': minor
---

Added a new /adversarial-review slash command that reviews a pull request in a fresh headless Mastra Code instance, optionally with a different model than your current session. Run `/adversarial-review [pr-number] [model-id]` — the PR number defaults to the current branch's PR and the model defaults to your configured model. The review runs on a fresh thread with no context from your current session and the result is rendered in the chat when it completes.
