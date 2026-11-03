---
'@mastra/factory': patch
---

Fixed a race where two simultaneous requests filing a card for the same external source (for example the same Linear or GitHub issue) could delete the card or fail with a server error. The second request returned the card as reused, but the first request then removed it. The card is now kept, enters its first phase normally, and still lands where its intake route says. A card is only removed after a refused filing when nothing else has touched it since.
