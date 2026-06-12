# @mastra/openai

## 0.1.0-alpha.2

### Minor Changes

- Added structured output support for Claude and OpenAI SDK agents using their provider-native structured output APIs. Cursor SDK agent calls now fail clearly when structuredOutput is requested because the Cursor TypeScript SDK does not expose a schema-constrained output API. SDK agents now implement provider-native resume through Mastra's existing resumeGenerate/resumeStream methods by accepting provider-specific resumeData with a message payload. Cursor SDK agent options now use the same clear source split as OpenAI: pass either a pre-created agent or SDK options for wrapper-created agents. ([#17580](https://github.com/mastra-ai/mastra/pull/17580))

  Example:

  ```ts
  await claudeAgent.resumeGenerate({
    message: 'Continue the task.',
    sessionId: 'claude-session-id',
  });

  await openAIAgent.resumeStream({
    message: 'Continue the task.',
    previousResponseId: 'resp_123',
  });

  const result = await openAIAgent.generate('Return the answer as JSON.', {
    structuredOutput: {
      schema: z.object({ answer: z.string() }),
    },
  });
  // result.object has shape { answer: string }
  ```

  Claude and OpenAI SDK agents support `structuredOutput` through their native SDK APIs. `CursorSDKAgent` throws a clear error when `structuredOutput` is requested because the Cursor TypeScript SDK does not expose schema-constrained output.

### Patch Changes

- Updated dependencies [[`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0-alpha.4

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
