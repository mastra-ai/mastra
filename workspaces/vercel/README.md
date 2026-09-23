# @mastra/vercel

Vercel workspace sandbox providers for Mastra.

This package exposes two Vercel-backed sandbox implementations:

## Installation

```bash
npm install @mastra/vercel
```

## Usage

```typescript
import { MastraEditor } from '@mastra/core/editor';
import { vercelSandboxProvider, vercelServerlessSandboxProvider } from '@mastra/vercel';

const editor = new MastraEditor({
  sandboxes: [vercelSandboxProvider, vercelServerlessSandboxProvider],
});
```

## Documentation

- [Vercel Sandbox integration guide](https://mastra.ai/integrations/sandboxes/vercel)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/vercel/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
