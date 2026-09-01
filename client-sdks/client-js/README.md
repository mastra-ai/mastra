# @mastra/client-js

The official TypeScript library for the Mastra Client API. Install `@mastra/client-js` to use it in your Mastra application.

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
```

## Documentation

- [@mastra/client-js documentation](https://mastra.ai/reference/client-js/mastra-client)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/client-sdks/client-js/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
