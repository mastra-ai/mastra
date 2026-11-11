---
'@mastra/factory': patch
---

Fixed slow GitHub board loads in Factory. Listing a project's issues and pull requests no longer runs Factory rules on every board poll, so boards stay fast with many repositories and open tabs. A background check now runs every five minutes and creates Review cards for open pull requests whose opened webhook never arrived, checking the 600 newest per repository, and restores the open pull request on a card that lost track of it. Set `MASTRACODE_GITHUB_PR_DISCOVERY_INTERVAL_MS` (or `MASTRACODE_PLATFORM_GITHUB_PR_DISCOVERY_INTERVAL_MS` on Mastra Platform) to change its cadence. Linking a repository through Mastra Platform now imports its open issues and pull requests like a direct GitHub App connection does.
