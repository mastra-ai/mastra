---
'@mastra/factory': patch
---

Fixed automated runs for manually created board cards. Moving a manual card into Planning or Building used to fail with 'Factory skill invocation requires a supported issue or pull request identifier' and left the card stuck with a failed-run badge. Those runs now start like any other card. The run-branch grammar is one shared function used by both the server's autonomous runs and the board's session opening, so every card converges on a single checkout per item.
