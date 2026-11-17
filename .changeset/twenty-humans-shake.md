---
'@mastra/factory': minor
---

Factory no longer asks you to pick a repository before a card starts working. A card that names no repository starts in the Factory environment's first repository; the agent works out from the card which of the sandbox's repositories it belongs to, works there, and the card records that repository with the run's first push or pull request. Cards that already name a repository start there as before.

Because nothing is left to choose, a run start no longer fails with `repository_ambiguous` (its 409 response no longer carries `candidates`), and `factory_list_attention` no longer returns `needsRepository` or `linkedRepositories`.
