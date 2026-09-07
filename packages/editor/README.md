# @mastra/editor

The data and provider layer behind Mastra Studio editing experiences. It manages agents, prompts, scorers, MCP servers, workspaces, skills, and favorites across code and storage sources.

## Installation

```bash
npm install @mastra/editor
```

## Usage

Pass the editor to your Mastra instance to enable Studio editing, versioning, prompt blocks, and agent code overrides.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraEditor } from '@mastra/editor';

export const mastra = new Mastra({
  editor: new MastraEditor(),
});
```

## Documentation

- [@mastra/editor documentation](https://mastra.ai/reference/editor/mastra-editor)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/editor/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
