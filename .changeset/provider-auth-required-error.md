---
'@mastra/code-sdk': minor
---

Fixed credential failures that told every interface to run `/login`, a command only the terminal UI has. A provider fetch without a usable credential now throws `ProviderAuthRequiredError`, which states the fact and leaves the remedy to the host running the agent.

```ts
import { ProviderAuthRequiredError } from '@mastra/code-sdk/auth/provider-auth-error';

try {
  await run();
} catch (error) {
  // Before: the message hardcoded "Run /login first."
  // Now: match the error and point the user at whatever sign-in path your host offers.
  if (error instanceof ProviderAuthRequiredError) showSignIn();
}
```

The error name is stable across serialization, so a client that only receives `{ name, message }` over the wire can match it too.
