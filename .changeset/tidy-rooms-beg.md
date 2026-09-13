---
'@mastra/code-sdk': patch
---

`parseError` now classifies provider outages as `provider_unavailable` (retryable, 5s delay): a bare `Not Found` edge response, HTTP 502/503/504/529 (including a status carried on `error.cause`), and "bad gateway" / "service unavailable" / "overloaded" messages. Descriptive 404s keep their `model_not_found` / `unknown` classification. `server_error` and `unknown` results now carry `HTTP <status>` detail and the request URL.

```ts
import { parseError } from '@mastra/code-sdk/utils/errors';

const parsed = parseError(Object.assign(new Error('Not Found'), { statusCode: 404 }));
// parsed.type === 'provider_unavailable'
// parsed.message === 'Model provider unavailable. The provider may be down or unreachable right now.'
// parsed.detail === 'HTTP 404: Not Found'
```
