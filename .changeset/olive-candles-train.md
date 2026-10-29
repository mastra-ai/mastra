---
'@mastra/factory': patch
---

The memory settings preview now shows the Auto memory model a run will actually use, instead of one that needs a credential the run cannot reach. Accounts whose runs authenticate with the organization's credentials no longer see a model that only their personal Google key can reach, and the other way round.

A chat's preview follows the policy its own runs follow: a thread bound to a work-item run previews the Factory's credentials, and a session shared with a teammate previews the credentials of the person who owns it, not those of whoever is reading the page.

Rejects an observational memory threshold of 2000 tokens or fewer with a 400 that names the 2000-token floor, rather than saving a value that aborts memory on the next run.
