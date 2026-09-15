# @mastra/connect

## 0.1.0-alpha.0

### Minor Changes

- Added `@mastra/connect`, a new package that turns Mastra platform integration connections into agent tools without exposing provider credentials to your app. Tools execute through the platform connection proxy, which injects credentials and refreshes tokens. ([#23087](https://github.com/mastra-ai/mastra/pull/23087))

  **Use every shipped provider connected to a project**

  ```ts
  import { Agent } from '@mastra/core/agent';
  import { connect } from '@mastra/connect';

  const agent = new Agent({
    name: 'ops',
    instructions: 'You manage our workspaces.',
    model: 'openai/gpt-5-mini',
    tools: connect(),
  });
  ```

  `connect()` returns a live resolver compatible with an agent's dynamic `tools` argument. This release establishes the connection runtime and provider-generation pipeline; generated provider modules are shipped separately, and the resolver returns an empty tool record until the installed package includes one. Once providers are present, it discovers matching project connections, merges their tools into one flat record, and refreshes its cached snapshot without requiring a server restart. Its resolver type remains compatible across linked or locally built packages that resolve a different `@mastra/core` installation.

  Use the `integrations` option to allowlist providers, restrict tool names, or select a connection when a project has more than one. Per-provider resolution failures, including ambiguous connections and connections that need reauthentication, are warned and skipped so one provider doesn't disable the other tools. Call `invalidate()` or `refresh()` to control the resolver cache manually.

  **Fetch a raw credential for custom interactions**

  ```ts
  import { credential } from '@mastra/connect';

  const credentialValue = await credential('c_yourconnectionid');
  ```

  Use `credential()` when a provider SDK requires direct credentials instead of the platform proxy.

### Patch Changes

- Updated dependencies [[`0f4d9cf`](https://github.com/mastra-ai/mastra/commit/0f4d9cf79b49b6dc6a484a0b2d1cf381eb2343a6), [`50e2658`](https://github.com/mastra-ai/mastra/commit/50e2658cdcdc55a14abde08610a8e2b12fdf67a4), [`8510a6d`](https://github.com/mastra-ai/mastra/commit/8510a6d38b9d211af7d94b7860ab182ce55c39d1), [`5eba942`](https://github.com/mastra-ai/mastra/commit/5eba9420330b3f116810891ae14888f7f256cd4f), [`648dd4f`](https://github.com/mastra-ai/mastra/commit/648dd4f4c4cd330013c0a98f50ffac77fe2ad632), [`3fc8c2d`](https://github.com/mastra-ai/mastra/commit/3fc8c2d35f724c3648150b29e50cf61a9360b274), [`ddb3639`](https://github.com/mastra-ai/mastra/commit/ddb3639e3de41f3fe33f68f81c2e5850ff1280b6), [`502ca89`](https://github.com/mastra-ai/mastra/commit/502ca8904848e77d44622669f2728171d36ad6ca), [`953be88`](https://github.com/mastra-ai/mastra/commit/953be88befd9cdb789b4cfc16680121c663a631b), [`6d20620`](https://github.com/mastra-ai/mastra/commit/6d206205f781cfa2598c2a55123a336909e039b4), [`d55aa61`](https://github.com/mastra-ai/mastra/commit/d55aa616b3e88015c3b74342c75bd510c7e764df), [`4573c23`](https://github.com/mastra-ai/mastra/commit/4573c231c108e7d796eab12b8e9b2094f8cc4d47)]:
  - @mastra/core@1.67.0-alpha.5
