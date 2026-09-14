# @mastra/opencode

`@mastra/opencode` brings Mastra Observational Memory to OpenCode sessions. It condenses long conversation histories into structured observations so coding sessions retain important context without repeatedly sending the entire transcript to the model.

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

Optionally add project-level configuration:

```json title=".opencode/mastra.json"
{
  "model": "google/gemini-2.5-flash",
  "observation": { "messageTokens": 20000 },
  "reflection": { "observationTokens": 90000 },
  "storagePath": ".opencode/memory/observations.db"
}
```

## Documentation

The plugin converts OpenCode user and assistant messages, including text, tool calls, files, images, and reasoning, into Mastra's message format. Before each model request it observes new messages when the configured token threshold is reached, removes history already represented by observations, and injects the optimized observation context into the system prompt.

Configuration is read from `.opencode/mastra.json`. It accepts Mastra `ObservationalMemoryOptions` such as the observer model, observation and reflection thresholds, scope, and shared token budget. `storagePath` controls the local SQLite database and defaults to `.opencode/memory/observations.db`.

The plugin resolves model credentials lazily from OpenCode's provider store. Existing environment variables take precedence, so OpenCode credentials only fill missing provider keys. Observation data is stored with `LibSQLStore` inside the project and remains available when the OpenCode session is resumed.

OpenCode toast notifications report observation and reflection progress. The plugin also registers diagnostic tools for inspecting memory status and stored observations, which helps explain when the next compaction cycle will run and what context has already been retained.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/opencode/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
