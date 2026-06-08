# @mastra/openai

## 0.1.0-alpha.1

### Minor Changes

- Added `@mastra/openai`, a new package for using OpenAI Agents SDK agents in Mastra. ([#17525](https://github.com/mastra-ai/mastra/pull/17525))

  `OpenAISDKAgent` lets you register an OpenAI Agents SDK agent with Mastra, call it with Mastra-compatible `generate()` and `stream()` methods, and keep usage and tracing data connected to the Mastra run.

  ```ts
  import { OpenAISDKAgent } from '@mastra/openai';

  export const openaiAgent = new OpenAISDKAgent({
    id: 'openai-sdk-agent',
    name: 'OpenAI SDK Agent',
    description: 'Use OpenAI Agents SDK through Mastra.',
    sdkOptions: {
      name: 'Repository assistant',
      instructions: 'Answer clearly and cite the relevant files.',
      model: '__GATEWAY_OPENAI_MODEL_BASE__',
    },
  });
  ```

  Use `sdkOptions` when you want Mastra to create the OpenAI SDK agent. Pass `agent` when your app already creates and owns the SDK agent.

### Patch Changes

- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f)]:
  - @mastra/core@1.42.0-alpha.0

## 0.1.0-alpha.0

### Initial release

- Added `OpenAISDKAgent` for registering OpenAI Agents SDK agents with Mastra.
