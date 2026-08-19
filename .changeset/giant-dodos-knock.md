---
'@mastra/factory': patch
---

Trimmed what the Factory UI fetches while it polls.

Session and workspace activity dots in the sidebar now read the controller's shared active-run registry instead of listing threads once per user session, so a sidebar with ten sessions makes one request every five seconds instead of eleven.

Work item responses also stop carrying `factoryRuleMaterializationKey`, an internal upsert token the rule dispatcher stamps on the cards it materializes. No client read it, and on a large board it was the single heaviest metadata field.
