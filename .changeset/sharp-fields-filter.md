---
'@mastra/connect': minor
---

Added `connectEventFields()`, `unknownConnectEventFields()` and `matchesConnectEventFields()` for filtering Connect events by payload field. Connect now lists the filterable fields of every event type that has payload types, so an agent can choose at runtime which events it wants, such as reviews on one pull request, and have unknown fields rejected.

```ts
import { matchesConnectEventFields, unknownConnectEventFields } from '@mastra/connect';

const filters = { 'repository.full_name': 'acme/app', 'pull_request.number': 12 };
unknownConnectEventFields('github', 'pull_request_review.submitted', filters); // []
matchesConnectEventFields(event.payload, filters); // true for reviews on acme/app#12
```
