# @mastra/client-js

`@mastra/client-js` is the typed JavaScript client for a running Mastra server. Use it from browser or server applications to call agents, workflows, tools, memory, and vector APIs without constructing HTTP requests directly.

## Installation

```bash
npm install @mastra/client-js
```

## Usage

Point the client at a running Mastra server.

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });
const agent = client.getAgent('assistant');

const response = await agent.generate('Summarize my open support tickets.');
console.log(response.text);
```

## Documentation

- [@mastra/client-js documentation](https://mastra.ai/reference/client-js/mastra-client)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/client-sdks/client-js/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
