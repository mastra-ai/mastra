---
'@mastra/observability': patch
---

Fixed Model cost metrics to use complete customer charges preserved from Gateway responses.

Requires a matching core update and a Gateway response carrying the customer-cost marker. Existing stored metrics are not recalculated.
