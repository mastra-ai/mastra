---
'@mastra/factory': minor
'mastra': patch
---

Factory reviews can now report their test results as a `Factory Review / tests` check on the pull request's head commit. On GitHub this is a check run, and on GitLab it is a commit status. The review agent posts an in-progress check when it starts its test plan and a final pass or fail result when the tests finish.

This is off by default. To turn it on for a project, open **Automation settings** on the board and switch on **Publish review test checks**. While it is off, the test report comment is still posted.

After the tests finish, the review agent also posts a separate **Factory test report** comment on the pull request. The comment recaps what was tested, gives each command's result, and links to the check.
