# @mastra/mesa

Mesa filesystem provider for Mastra workspaces.

## Installation

```bash
npm install @mastra/core @mastra/mesa
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { MesaFilesystem } from '@mastra/mesa';

const workspace = new Workspace({
  filesystem: new MesaFilesystem({
    apiKey: process.env.MESA_API_KEY,
    org: 'acme',
    repos: [{ name: 'docs', bookmark: 'main' }],
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: '__GATEWAY_ANTHROPIC_MODEL_OPUS__',
  workspace,
});
```

Filesystem methods expect absolute paths rooted at the Mesa mount. Include the org slug and repo name:

```typescript
await workspace.filesystem.readFile('/acme/docs/README.md');
```

## License

Apache-2.0
