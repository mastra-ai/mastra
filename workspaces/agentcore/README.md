# @mastra/agentcore

Execute commands in AWS Bedrock AgentCore Runtime sessions from Mastra workspaces, with session management, environment variables, and file operations.

## Installation

```bash
npm install @mastra/agentcore
```

## Usage

```typescript
import { Workspace } from '@mastra/core/workspace';
import { AgentCoreRuntimeSandbox } from '@mastra/agentcore';

const workspace = new Workspace({
  sandbox: new AgentCoreRuntimeSandbox({
    region: 'us-west-2',
    agentRuntimeArn: process.env.AGENTCORE_RUNTIME_ARN!,
    runtimeSessionId: '12345678-1234-1234-1234-123456789012',
  }),
});

const result = await workspace.sandbox?.executeCommand?.('npm', ['test'], {
  cwd: '/workspace',
  timeout: 300_000,
});
```

## Documentation

- [AgentCore](https://mastra.ai/integrations/sandboxes/agentcore)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/agentcore/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
