---
'@mastra/factory': patch
---

Approving a held Factory run with `factory_resolve_proposal`, or retrying a failed one with `factory_retry_decision`, now makes the session follow the run's card, as moving the card already did. Before, a Slack session that approved a card's review could promise to post the result and then never hear how the review ended. Both results now include the card's `url`.
