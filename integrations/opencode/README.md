# @mastra/opencode

`@mastra/opencode` brings Mastra Observational Memory to OpenCode sessions. It condenses long conversation histories into structured observations, helping coding sessions retain important context without repeatedly sending the full transcript to the model.

## Installation

```bash
npm install @mastra/opencode
```

## Usage

Re-export the plugin from an OpenCode plugin file:

```typescript title=".opencode/plugins/mastra.ts"
import { MastraPlugin } from '@mastra/opencode';

export default MastraPlugin;
```

Optionally configure the observation model, compaction thresholds, and local SQLite storage path:

```json title=".opencode/mastra.json"
{
  "model": "google/gemini-2.5-flash",
  "observation": { "messageTokens": 20000 },
  "reflection": { "observationTokens": 90000 },
  "storagePath": ".opencode/memory/observations.db"
}
```

## Documentation

- [Observational Memory](https://mastra.ai/docs/memory/observational-memory)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/opencode/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
