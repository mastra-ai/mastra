---
'@mastra/factory': patch
---

Fixed slow GitHub board loads in Factory. Listing a project's issues and pull requests no longer runs Factory rules on every board poll, so boards stay fast with many repositories and open tabs. A background sweep now creates Review cards for open pull requests whose opened webhook never arrived, and linking a repository through Mastra Platform now imports its open issues and pull requests like a direct GitHub App connection does.
