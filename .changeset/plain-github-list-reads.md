---
'@mastra/factory': patch
---

Opening a Factory board no longer runs the GitHub rules on every issue and pull request list refresh, so open boards no longer slow the server down. Webhooks and the background sweep now handle intake: the sweep also files cards for open pull requests whose `opened` webhook never arrived, and linking a repository through the platform GitHub integration now imports its open issues and pull requests once.
