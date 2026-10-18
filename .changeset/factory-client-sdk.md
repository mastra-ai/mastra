---
'@mastra/code-sdk': minor
---

Added a Factory client for driving a remote Factory session. `RemoteSession` and `RemoteController` mirror a Factory session's state over its event stream and forward messages, approvals, and mode/model switches over HTTP. Platform helpers sign in to Mastra Platform and discover the organizations, projects, and environments to connect to.

```ts
import { createFactoryClient } from '@mastra/code-sdk/factory/client';
import { RemoteSession } from '@mastra/code-sdk/factory/remote-session';
import { getPlatformSession } from '@mastra/code-sdk/platform/index';

const session = await getPlatformSession();
const client = createFactoryClient({ url: 'https://my-factory.factory.mastra.cloud', session });
```

Requests that fail with an expired Platform token refresh it once and retry.
