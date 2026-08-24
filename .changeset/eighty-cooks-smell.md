---
'@mastra/factory': patch
---

Fixed automated runs for manually created board cards. Moving a manual card into Planning or Building no longer fails with 'Factory skill invocation requires a supported issue or pull request identifier'. Manual cards now start on a stable `factory/item-<id>` branch, even without a provider identity.
