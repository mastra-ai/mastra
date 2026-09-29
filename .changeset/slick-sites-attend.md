---
'@mastra/playground-ui': minor
---

Added a `relative-long` preset to `formatDate` that describes a date in words at any distance, so a license or trial end date reads "in 4 weeks" instead of falling back to an absolute date after seven days.

```ts
import { formatDate } from '@mastra/playground-ui/utils/date-format';

formatDate(expiresAt, 'relative-time'); // "Oct 26"
formatDate(expiresAt, 'relative-long'); // "in 4 weeks"
```
