---
'@mastra/core': minor
---

Added OpenCode Console as a native model provider.

Use OpenCode Console models through Mastra's model router with a Console service-account key in `OPENCODE_CONSOLE_API_KEY`. Console is separate from OpenCode Zen and OpenCode Go. Native routes use Console Bearer authentication and preserve custom headers. Paid inference requires Console credit. Some free catalog models also need an `x-session-id` header.

Catalog discovery falls back after two seconds, so an unavailable Console catalog does not stall other providers. Generated examples use the current streaming and request-context APIs. Documentation distinguishes provisional inherited metadata from Console guarantees and limits media claims to the configured routes.

https://github.com/mastra-ai/mastra/issues/23264

```ts
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You are a helpful assistant',
  model: 'opencode-console/glm-5.3-flash',
});
```
