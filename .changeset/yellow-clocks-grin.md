---
'@mastra/agentcore': minor
---

Added AWS Bedrock AgentCore Runtime sandbox support.

You can now run Workspace commands in AWS Bedrock AgentCore Runtime through a sandbox provider.

```ts
import { AgentCoreRuntimeSandbox } from '@mastra/agentcore';

const sandbox = new AgentCoreRuntimeSandbox({
  region: 'us-west-2',
  agentRuntimeArn: process.env.AGENTCORE_RUNTIME_ARN!,
});

const result = await sandbox.executeCommand('node', ['--version']);
```
