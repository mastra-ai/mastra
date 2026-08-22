---
'@mastra/factory': patch
---

Fixed automated runs for manually created board cards. Moving a manual card into Planning or Building used to fail with 'Factory skill invocation requires a supported issue or pull request identifier' and left the card stuck with a failed-run badge. Those runs now start like any other card, on an id-derived branch matching the one the board already uses to open a manual card's session.
