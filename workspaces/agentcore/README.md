# @mastra/agentcore

AWS Bedrock AgentCore Runtime sandbox provider for Mastra workspaces.

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

`AgentCoreRuntimeSandbox` uses `InvokeAgentRuntimeCommand` to run one-shot shell commands inside an existing AgentCore Runtime session. It does not provide background process management or filesystem mounts.

By default, `destroy()` does not stop the AgentCore Runtime session because sessions can be shared with other AgentCore invocations. Call `stopRuntimeSession()` explicitly, or set `stopSessionOnLifecycle: true`, when the sandbox owns the session and should clean it up.

AgentCore Code Interpreter is a separate AgentCore service and is not part of this runtime sandbox provider.
