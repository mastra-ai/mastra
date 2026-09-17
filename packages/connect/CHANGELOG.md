# @mastra/connect

## 0.2.0-alpha.1

### Minor Changes

- Added Snowflake tools backed by Platform connections using the OAuth snowflake integration. Agents can run SQL statements (with async statement polling and cancellation) and browse warehouses, databases, schemas, tables, columns, views, stages, streams, tasks, roles, and users. The execute-statement tool runs any SQL the connection's Snowflake role permits, so scope the connected user to least privilege or restrict the toolset with allowTools. ([#24066](https://github.com/mastra-ai/mastra/pull/24066))

  ```ts
  import { connect } from '@mastra/connect';

  const tools = connect({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
    integrations: {
      snowflake: { allowTools: ['snowflake_execute_statement', 'snowflake_list_tables'] },
    },
  });
  ```

- Add a generated Jira provider with 37 tools covering issue lifecycle (create, update, transition, link), comments, worklogs, watchers, projects, users, and metadata lookups. The tool runtime now supports the template `updateMetadata` helper by caching derived connection facts (such as the Atlassian cloud ID) in memory for the lifetime of a toolset, so tools skip repeat discovery round-trips. ([#24066](https://github.com/mastra-ai/mastra/pull/24066))

### Patch Changes

- Updated dependencies [[`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`b2942c0`](https://github.com/mastra-ai/mastra/commit/b2942c0f3c99dd1edba9dc8c2c17bfa55c851ae8), [`99fab39`](https://github.com/mastra-ai/mastra/commit/99fab399c35952ae15427ea64845d4762e9ec144), [`d65d4d4`](https://github.com/mastra-ai/mastra/commit/d65d4d40a24a482d5b0ee83d9bab6042702ca1be), [`4fb5ae9`](https://github.com/mastra-ai/mastra/commit/4fb5ae9e2cba9b14ba6c5cef0894e49bccf6f607), [`e581e66`](https://github.com/mastra-ai/mastra/commit/e581e66e14bb1b2863698aecca7324fbf1ec4ff5), [`a3f8f05`](https://github.com/mastra-ai/mastra/commit/a3f8f05ecb60c52056c590325e3821ecfc85afe3), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`9cd9b4e`](https://github.com/mastra-ai/mastra/commit/9cd9b4eca69a3db0a0c415d0dcedf266cc7d5ec6), [`3589cde`](https://github.com/mastra-ai/mastra/commit/3589cde4ea8dd210df6b9a2355a3e568210965fc), [`783e48a`](https://github.com/mastra-ai/mastra/commit/783e48aba82489a085230f6b8539a9fb338c326b), [`07a81c8`](https://github.com/mastra-ai/mastra/commit/07a81c8be0cbdb5413ffa5c289d32765d80f4ea4), [`07ff1b8`](https://github.com/mastra-ai/mastra/commit/07ff1b8eafbd9c7786ef77decc6be3b63497cfd9), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45)]:
  - @mastra/core@1.68.0-alpha.3

## 0.2.0-alpha.0

### Minor Changes

- Added the generated Linear provider with 46 tools for issues, projects, cycles, teams, users, workflow states, comments, attachments, relations, and labels. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

  `connect()` now automatically exposes the Linear toolset when the project has a matching `linear` connection. Set `MASTRA_LINEAR_CONNECTION_ID` or pass `integrations.linear.connectionId` when the project has multiple Linear connections.

- Added automatic discovery of MCP-backed integrations from the Mastra Platform catalog. Connected MCP providers require no checked-in provider registration: `connect()` discovers their tools through Platform, keeps provider credentials outside the application process, and preserves Platform proxy analytics. Discovered MCP tools require tool approval unless the application lists them in `autoApproveTools`. ([#23996](https://github.com/mastra-ai/mastra/pull/23996))

  ```ts
  import { connect } from '@mastra/connect';

  const tools = connect({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
    integrations: {
      // An MCP-backed integration attached to the project; tools are discovered at runtime.
      neon: { autoApproveTools: ['neon_list_projects', 'neon_describe_project'] },
    },
  });
  ```

- Added broad Resend and incident.io tool coverage backed by Platform connections. Resend covers email operations and account resources such as domains, templates, audiences, contacts, broadcasts, and webhooks. incident.io covers incident response, alerts, on-call data, teams, users, postmortems, and catalog reads. ([#23631](https://github.com/mastra-ai/mastra/pull/23631))

  ```ts
  import { connect } from '@mastra/connect';

  const tools = connect({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
    integrations: {
      resend: { allowTools: ['resend_send_email', 'resend_get_email'] },
      'incident-io': { allowTools: ['incident_io_list_incidents'] },
    },
  });
  ```

- Added built-in Clerk and WorkOS providers with 42 and 40 tools respectively for identity, organization, directory, connection, invitation, membership, and domain administration. Provider tools can now forward repeated query parameters for multi-value filters. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Added built-in Anthropic, Notion, OpenAI, and Supabase providers. Generated tools can now read safe connection configuration and metadata through the platform proxy, enabling providers with connection-specific API hosts. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

### Patch Changes

- Fixed OpenAI image generation tools to send base64 images to models as multimodal image content instead of JSON text, preventing generated images from consuming the text context window. Updated the generated OpenAI tools to the current API parameters. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Removed warnings for providers that do not have project connections. Connect now silently skips unavailable providers while continuing to report actionable connection problems. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Validate `baseUrlOverride` on the connection-proxy client before it is forwarded as a request header. Only absolute HTTPS URLs without embedded credentials are accepted; unparseable values, non-HTTPS schemes, and userinfo-bearing URLs are rejected with `invalid_options` so a compromised connection config cannot redirect authenticated proxy traffic to an unintended origin. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Updated dependencies [[`81ccd7b`](https://github.com/mastra-ai/mastra/commit/81ccd7b93040952fe9c7168a2757c43a217f0a87), [`a46385d`](https://github.com/mastra-ai/mastra/commit/a46385dc1b773d1e1453627b1d62e7b6ebe93cf1), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`25d940a`](https://github.com/mastra-ai/mastra/commit/25d940add25504daebe65bc5cc02f268d6eba07c), [`d7f0579`](https://github.com/mastra-ai/mastra/commit/d7f0579a0445469430b9eadbf9c28ed3fa009839), [`b483910`](https://github.com/mastra-ai/mastra/commit/b48391034dee9a19396c1b3ec084ecf20faf550e), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`fa4c366`](https://github.com/mastra-ai/mastra/commit/fa4c3664c5446ae13d991204275883b2d7f00690), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`1670091`](https://github.com/mastra-ai/mastra/commit/16700919c35dadb9737dc7fe7e5feb67cc209494), [`b8e3ee5`](https://github.com/mastra-ai/mastra/commit/b8e3ee5da5cbc46b182ca75214acda667bac5205), [`d777788`](https://github.com/mastra-ai/mastra/commit/d7777889d72b4f37a3d50b830f8208c736ee0e7a), [`56680bf`](https://github.com/mastra-ai/mastra/commit/56680bfff71e7cdad71721b424b160bdd5de6e02), [`93a3425`](https://github.com/mastra-ai/mastra/commit/93a342569d592d0449eee7b4b4f7555dc001081b), [`b130872`](https://github.com/mastra-ai/mastra/commit/b130872508e95f17894c2ed4932d4952db0a2d3c), [`1853f3d`](https://github.com/mastra-ai/mastra/commit/1853f3d9331e3131930581556df781cca85f2d2d), [`fdb59c6`](https://github.com/mastra-ai/mastra/commit/fdb59c6a4c3d9aea19159886aac8d80602763f04)]:
  - @mastra/core@1.68.0-alpha.1
  - @mastra/mcp@1.18.1-alpha.0

## 0.1.0

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

- Updated dependencies [[`d9ef543`](https://github.com/mastra-ai/mastra/commit/d9ef54303b7f050f4e364701c3821fc61e7002f2), [`b96744d`](https://github.com/mastra-ai/mastra/commit/b96744daad8c6e181f03fdf38c732206ded428a2), [`ad5ac69`](https://github.com/mastra-ai/mastra/commit/ad5ac69bcd037bfb85c3399d8b39d9364931ad1b), [`e86be03`](https://github.com/mastra-ai/mastra/commit/e86be034c017fca7deae7d1ebb34d36413928cb8), [`492c0ae`](https://github.com/mastra-ai/mastra/commit/492c0aedcee3fde9555111a660b6c975c160a0db), [`0f4d9cf`](https://github.com/mastra-ai/mastra/commit/0f4d9cf79b49b6dc6a484a0b2d1cf381eb2343a6), [`50e2658`](https://github.com/mastra-ai/mastra/commit/50e2658cdcdc55a14abde08610a8e2b12fdf67a4), [`a0aa698`](https://github.com/mastra-ai/mastra/commit/a0aa698427db9730e39f0c9956d21b97307ab313), [`8510a6d`](https://github.com/mastra-ai/mastra/commit/8510a6d38b9d211af7d94b7860ab182ce55c39d1), [`ddbd352`](https://github.com/mastra-ai/mastra/commit/ddbd3527654a058ed413ae164a1246003dcc9030), [`5eba942`](https://github.com/mastra-ai/mastra/commit/5eba9420330b3f116810891ae14888f7f256cd4f), [`4112ecd`](https://github.com/mastra-ai/mastra/commit/4112ecdec76827384d3a7ab4e8db3ccf90ae7ed1), [`37065ad`](https://github.com/mastra-ai/mastra/commit/37065ad6cd3f74afd16417e8d4e0839c13beca40), [`648dd4f`](https://github.com/mastra-ai/mastra/commit/648dd4f4c4cd330013c0a98f50ffac77fe2ad632), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`617c1b3`](https://github.com/mastra-ai/mastra/commit/617c1b30e7e794bbb77feaced1848fde291fc240), [`1ce03b9`](https://github.com/mastra-ai/mastra/commit/1ce03b9c04c633e815bc21cb78c29f7f19851fb2), [`c3d00db`](https://github.com/mastra-ai/mastra/commit/c3d00db279a95c7dcba0f767704a2bb6544b7b29), [`df14b5d`](https://github.com/mastra-ai/mastra/commit/df14b5d12374137db86f92061f8714b28473672e), [`fff3361`](https://github.com/mastra-ai/mastra/commit/fff33614a3376676797cb9b5a5c5b090b026fa0e), [`422e798`](https://github.com/mastra-ai/mastra/commit/422e798ab1a4b14302c5b49fed2f6c818a82706e), [`3fc8c2d`](https://github.com/mastra-ai/mastra/commit/3fc8c2d35f724c3648150b29e50cf61a9360b274), [`ddb3639`](https://github.com/mastra-ai/mastra/commit/ddb3639e3de41f3fe33f68f81c2e5850ff1280b6), [`4b3f587`](https://github.com/mastra-ai/mastra/commit/4b3f587ceabb3f3697c4c1ad4fb154d58002ef7c), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`44c20c9`](https://github.com/mastra-ai/mastra/commit/44c20c9a40ba5ef153e1d5d0c413b825e1de42d7), [`502ca89`](https://github.com/mastra-ai/mastra/commit/502ca8904848e77d44622669f2728171d36ad6ca), [`953be88`](https://github.com/mastra-ai/mastra/commit/953be88befd9cdb789b4cfc16680121c663a631b), [`b95aabb`](https://github.com/mastra-ai/mastra/commit/b95aabba261a39b73430d95f3ed051634117d517), [`055057c`](https://github.com/mastra-ai/mastra/commit/055057ca2102e35008fe30871f7c8f422ae25ec2), [`7290151`](https://github.com/mastra-ai/mastra/commit/7290151bdb3bfe518653b0a66a19d6790925e4a0), [`2990bcc`](https://github.com/mastra-ai/mastra/commit/2990bccd1c648c8f8614da97fbb459819871f5bc), [`9bc7895`](https://github.com/mastra-ai/mastra/commit/9bc789591ad683f304c63bd01e554fbba2df9cf6), [`ffe16f1`](https://github.com/mastra-ai/mastra/commit/ffe16f17447449b7155f1f15992e3c9e5f6511ac), [`f466753`](https://github.com/mastra-ai/mastra/commit/f4667539a0c41ae4aa08a4ed380f374687db2592), [`04c11b3`](https://github.com/mastra-ai/mastra/commit/04c11b3cd698fa37af8fad466dc2bf6fa0d5494d), [`967ab17`](https://github.com/mastra-ai/mastra/commit/967ab179c9814e734af9c3395ff8ef795acbe06c), [`ad5ac69`](https://github.com/mastra-ai/mastra/commit/ad5ac69bcd037bfb85c3399d8b39d9364931ad1b), [`6d20620`](https://github.com/mastra-ai/mastra/commit/6d206205f781cfa2598c2a55123a336909e039b4), [`47868b2`](https://github.com/mastra-ai/mastra/commit/47868b2dde360b038d829c9f88e15061acf3efb5), [`fde3ca5`](https://github.com/mastra-ai/mastra/commit/fde3ca590f7d854ff33354eff4261b907bdacde4), [`3a1d253`](https://github.com/mastra-ai/mastra/commit/3a1d2537ad28754a164aedbf0dd94be224ccb0c3), [`0775cde`](https://github.com/mastra-ai/mastra/commit/0775cdee12b6ad2ad6b5c97874e6248db720224c), [`e3c3e5e`](https://github.com/mastra-ai/mastra/commit/e3c3e5e3e354e88207aa9747f9f0cd3352cea972), [`6902f94`](https://github.com/mastra-ai/mastra/commit/6902f940f1879955a90faa0a0ac871667b59d428), [`d55aa61`](https://github.com/mastra-ai/mastra/commit/d55aa616b3e88015c3b74342c75bd510c7e764df), [`7148bf5`](https://github.com/mastra-ai/mastra/commit/7148bf55b147e3fae90b3ba0c9517adb0af5f2a4), [`e83dfad`](https://github.com/mastra-ai/mastra/commit/e83dfade569ee5aea688de9f2bb8bf8db0a653a7), [`44057ea`](https://github.com/mastra-ai/mastra/commit/44057eac6fd048100574bf71c6dc095f769a6d63), [`d581249`](https://github.com/mastra-ai/mastra/commit/d581249a5bf97d32d73e0f1f30cd50ff108e2d67), [`2289456`](https://github.com/mastra-ai/mastra/commit/228945659b2003633e0ebb33e7e34cc2f6efbded), [`6bb122c`](https://github.com/mastra-ai/mastra/commit/6bb122c5147b612c0fe7f173f940933066c4cfcc), [`2c501bc`](https://github.com/mastra-ai/mastra/commit/2c501bc8f661b27a06842f1312221efa6125e580), [`990b47f`](https://github.com/mastra-ai/mastra/commit/990b47fa7370753967ea7ce83100a522f79ab328), [`90846f2`](https://github.com/mastra-ai/mastra/commit/90846f2bfd890de159ab7c3d4fcf8a71c6fb7125), [`6bdb944`](https://github.com/mastra-ai/mastra/commit/6bdb944acb3f39bccad59ee140d7614420948f6b), [`d1b070c`](https://github.com/mastra-ai/mastra/commit/d1b070cd77a944e6bb2e5848052b1e8275be88a2), [`7f6d101`](https://github.com/mastra-ai/mastra/commit/7f6d101044eefc0d776a555b45dbea1c0d5224c4), [`4573c23`](https://github.com/mastra-ai/mastra/commit/4573c231c108e7d796eab12b8e9b2094f8cc4d47), [`a54766a`](https://github.com/mastra-ai/mastra/commit/a54766a10381295583144847b856d18e8f924d30), [`1bd31e7`](https://github.com/mastra-ai/mastra/commit/1bd31e7fd49e6de56e6e9a157a6b452cbbd86983), [`a4381a2`](https://github.com/mastra-ai/mastra/commit/a4381a2b36cdb81c4e33c435cd882921edfc146c), [`ff45065`](https://github.com/mastra-ai/mastra/commit/ff45065d42132075c4efb064d96169c4eadbab58), [`e872dd6`](https://github.com/mastra-ai/mastra/commit/e872dd6619f3a5a46f1158b190b02f607b74d191)]:
  - @mastra/core@1.67.0

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
