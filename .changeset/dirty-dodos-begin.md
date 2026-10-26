---
'@mastra/factory': minor
'mastra': patch
---

Pull requests now land on the Work board alongside issues: a pull request enters Triage, and a trusted one moves on to Review automatically. A card links its issue and every pull request Factory opens for it, so merging or closing that pull request moves the card. The Review board is gone; at boot, Factory moves existing Review cards, label routes and repository bindings to Work and stores each project's Work board. Set MASTRA_FACTORY_BOARDS_MIGRATION=dry-run to log what would change without writing, or =off to skip it.
