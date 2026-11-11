---
'@mastra/factory': patch
---

Opening a Factory board no longer runs the GitHub rules on every issue and pull request list refresh. With several boards open over many linked repositories, those passes read the whole project every 30 seconds per tab and slowed down the whole server. Webhooks and the background sweep now handle intake: the sweep also files cards for open pull requests whose `opened` webhook never arrived, and linking a repository through the platform GitHub integration now imports its open issues and pull requests once.
