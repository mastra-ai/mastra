# @mastra/platform-workspace

Mastra Platform workspace sandbox and filesystem providers. Use `@mastra/platform-workspace` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/platform-workspace
```

## Usage

```typescript
import { PlatformApiError } from '@mastra/platform-workspace';

try {
  await fs.readFile('/missing.txt');
} catch (err) {
  if (err instanceof PlatformApiError) {
    if (err.code === 'not_found') {
      // handle missing file
    } else if (err.code === 'authentication_error') {
      // refresh token
    }
    console.error(err.status, err.code, err.proxyMessage, err.body);
  }
}
```

## Documentation

- [@mastra/platform-workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/platform-workspace/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
