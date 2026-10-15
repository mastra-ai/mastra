---
'@mastra/factory': minor
---

Factory reviews can now report their test results as a `Factory Review / tests` check on the pull request's head commit. On GitHub this is a check run, and on GitLab it is a commit status. The review agent posts an in-progress check when it starts its test plan and a final pass or fail result when the tests finish.

This is on by default. To turn it off for a project, open **Automation settings** on the board and switch off **Publish review test checks**. The review agent then includes the results in its verdict comment instead.
