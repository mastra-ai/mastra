# @mastra/connect

## 0.4.0-alpha.0

### Minor Changes

- Add `environment()` for sandboxed agents. Materialize provider credentials from your project's Platform connections into a `{ env, onStart }` pair that any sandbox provider (e2b, Modal, Daytona, Docker, subprocess) can consume — so CLI tooling inside the sandbox is authenticated without hand-wiring tokens per agent. ([#24912](https://github.com/mastra-ai/mastra/pull/24912))

  ```ts
  import { environment } from '@mastra/connect';

  const env = environment({
    projectId: process.env.MASTRA_PROJECT_ID,
    client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
  });

  const { env: envVars, onStart } = await env();

  await sandbox.start({ env: envVars, onStart });
  ```

  `environment()` shares its resolution model with `connect()`: same `projectId`, `client`, and per-provider `integrations` overrides (`connectionId` to pin, `disabled: true` to exclude). GitHub is the first provider with an env contributor — its OAuth token is exported as `GH_TOKEN`/`GITHUB_TOKEN` so both `gh` and `git` HTTPS authenticate as the connected user, and `onStart` installs a git credential helper that reads the token from the environment rather than baking it into git config.

### Patch Changes

- Updated dependencies [[`d47a70d`](https://github.com/mastra-ai/mastra/commit/d47a70d14aa2486089115069416fb0a9cac5eef5), [`fc7d2c1`](https://github.com/mastra-ai/mastra/commit/fc7d2c102e911f43f70f425e67c970231ea19363), [`4607046`](https://github.com/mastra-ai/mastra/commit/460704663e2869183e7dfff7efec49a4f2f47503), [`1e435dc`](https://github.com/mastra-ai/mastra/commit/1e435dc84a9c1b35aa58d0ab9b14ff39fe13aab0), [`9ba23a2`](https://github.com/mastra-ai/mastra/commit/9ba23a23893622b72c76189199d02432590606c1), [`1640470`](https://github.com/mastra-ai/mastra/commit/1640470792c1138f91f543526b3a516a948cf129)]:
  - @mastra/discord@1.1.0-alpha.0
  - @mastra/core@1.71.0-alpha.1
  - @mastra/telegram@0.1.3-alpha.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`bfde500`](https://github.com/mastra-ai/mastra/commit/bfde5009d1d9bdbce241132b3df9e638ad805fab), [`04233fd`](https://github.com/mastra-ai/mastra/commit/04233fdc197e1d9a4b13e9d182447df283ea1850), [`574a55c`](https://github.com/mastra-ai/mastra/commit/574a55cd26cc2171f61906e0f090c817032c9603), [`e33a488`](https://github.com/mastra-ai/mastra/commit/e33a488ec308b7742e2bf66528873767f802c957), [`fc0ee2b`](https://github.com/mastra-ai/mastra/commit/fc0ee2b7d6d33bd5dd80f7338a5a90ec615b1235), [`9544a15`](https://github.com/mastra-ai/mastra/commit/9544a158e9bf110b3873b74b2c368616015244ee), [`22ed0d9`](https://github.com/mastra-ai/mastra/commit/22ed0d9f0f399ca29cf66e847795784018e6b79c), [`68fece5`](https://github.com/mastra-ai/mastra/commit/68fece5b724be17ab9bbfaa132468c5afa866b39), [`e7d378f`](https://github.com/mastra-ai/mastra/commit/e7d378f16e68b9ec1268a71960ecf102f86cd437), [`8adceb5`](https://github.com/mastra-ai/mastra/commit/8adceb53a48bb1b628ba839665e736b062b0d58f), [`e675e83`](https://github.com/mastra-ai/mastra/commit/e675e83c29d1c69ee334985725c5ce78ac5dcd6f), [`f9ffd28`](https://github.com/mastra-ai/mastra/commit/f9ffd2825c3cb21145b361f06c96f3c35c07bce2), [`5e4edbe`](https://github.com/mastra-ai/mastra/commit/5e4edbe212a714cc659203964f60e44988c7171f), [`7465c16`](https://github.com/mastra-ai/mastra/commit/7465c166894c5a0628634f564c62a26322654f9e), [`9f349e3`](https://github.com/mastra-ai/mastra/commit/9f349e34a1bc6e1011c471ad305068d95966ae35), [`c593409`](https://github.com/mastra-ai/mastra/commit/c59340998206b7273747d5b5281a09ab26535f81), [`4cb2f12`](https://github.com/mastra-ai/mastra/commit/4cb2f12d05b0de71a22127a76a16c1732bb674ec), [`3601e57`](https://github.com/mastra-ai/mastra/commit/3601e57cd8a4d2ca6f68d460c527c472a19f612d), [`ac426a0`](https://github.com/mastra-ai/mastra/commit/ac426a0f015e0d234f1394505c0b0795dc03ebed), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`68695fd`](https://github.com/mastra-ai/mastra/commit/68695fdc4b92cdf67c7fcf36603fa3c59e1bc10e), [`c35feed`](https://github.com/mastra-ai/mastra/commit/c35feedf99a55ad404657a1cebf0c298f36ab82e), [`2d73b0f`](https://github.com/mastra-ai/mastra/commit/2d73b0f52801be76691bab1204f133de1d631208), [`9a2db9a`](https://github.com/mastra-ai/mastra/commit/9a2db9ac12c7b5e24a44841d47a7f7ff17d3f504), [`ff6487e`](https://github.com/mastra-ai/mastra/commit/ff6487e163c4e4fcde950352e6598961b037dd1a)]:
  - @mastra/core@1.70.0
  - @mastra/mcp@2.1.0

## 0.3.1-alpha.0

### Patch Changes

- Updated dependencies [[`bfde500`](https://github.com/mastra-ai/mastra/commit/bfde5009d1d9bdbce241132b3df9e638ad805fab), [`f9ffd28`](https://github.com/mastra-ai/mastra/commit/f9ffd2825c3cb21145b361f06c96f3c35c07bce2), [`c593409`](https://github.com/mastra-ai/mastra/commit/c59340998206b7273747d5b5281a09ab26535f81), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`cf98812`](https://github.com/mastra-ai/mastra/commit/cf98812b7e9b511bc45a8641047ad7b91fee6abf), [`68695fd`](https://github.com/mastra-ai/mastra/commit/68695fdc4b92cdf67c7fcf36603fa3c59e1bc10e)]:
  - @mastra/core@1.70.0-alpha.0
  - @mastra/mcp@2.1.0-alpha.0

## 0.3.0

### Minor Changes

- Added ten generated tool providers to @mastra/connect: Slack, GitHub, Google Mail, Google Calendar, Fireflies, PostHog, Stripe, Discord, Twitter/X, and HubSpot. Each ships checked-in tools generated from Nango integration templates, including new agent-focused actions (PostHog HogQL queries, Stripe balance/dispute/coupon/account reads, GitHub tags and trees, Slack Connect shared-channel invites, Twitter search and following lookups, HubSpot form submission). Attach a provider connection in Mastra Platform and the tools resolve through connect() with no extra configuration: ([#24606](https://github.com/mastra-ai/mastra/pull/24606))

  ```ts
  import { Agent } from '@mastra/core/agent';
  import { connect } from '@mastra/connect';

  const agent = new Agent({
    id: 'ops-agent',
    model: 'anthropic/claude-sonnet-4-6',
    tools: connect(),
  });
  ```

### Patch Changes

- Generated `@mastra/connect` providers now cover more of the upstream template catalog. Actions that authenticate with the raw connection credential — token-introspection endpoints, for example — are generated instead of skipped, and actions that validate their input with the template validation helper are generated too. The credential is fetched from the platform only for the specific actions that read it. Under the hood this extends the platform proxy runtime and the provider generator; agents consume the resulting tools through the normal provider workflow with no API changes: ([#24605](https://github.com/mastra-ai/mastra/pull/24605))

  ```typescript
  import { Agent } from '@mastra/core/agent';
  import { connect } from '@mastra/connect';

  const assistant = new Agent({
    id: 'assistant',
    name: 'Assistant',
    instructions: 'Help with connected services.',
    model: 'anthropic/claude-sonnet-4-6',
    tools: connect(), // tools for every connected provider, resolved per request
  });
  ```

- Updated dependencies [[`7fefefd`](https://github.com/mastra-ai/mastra/commit/7fefefdcb91e15f8bf60b5b2148ef27cf1352faf), [`251eb56`](https://github.com/mastra-ai/mastra/commit/251eb5674e8e32855af6925d7fd1cd337aa5ea7d), [`e0fd937`](https://github.com/mastra-ai/mastra/commit/e0fd937e84fa6dd7e82b7b55b039a4191e61aa5c), [`f7180bd`](https://github.com/mastra-ai/mastra/commit/f7180bdd52b4ffaa9f053b8495c6c8b8c530de2a), [`f9ea7b2`](https://github.com/mastra-ai/mastra/commit/f9ea7b2d2f1e925b357fd71fe18ab26d3b00feae), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`26ed7ad`](https://github.com/mastra-ai/mastra/commit/26ed7ad111927211231a995346b9b561d4baa8e2), [`ecc642d`](https://github.com/mastra-ai/mastra/commit/ecc642d0a6ca2e938f92129726a4278471924124), [`1ed77dd`](https://github.com/mastra-ai/mastra/commit/1ed77dd7176e2f41ea2bf74f5ab0e4d1899c38e5), [`18863ae`](https://github.com/mastra-ai/mastra/commit/18863ae95c87218b8163e28d9826883cf4edf02b), [`c61d52c`](https://github.com/mastra-ai/mastra/commit/c61d52c338dbd77f3e8f0e7487f44b1f0a0d1350), [`32a9682`](https://github.com/mastra-ai/mastra/commit/32a96824a9ff31c3596fdb1a2789b946eba152cc), [`9ce6bc9`](https://github.com/mastra-ai/mastra/commit/9ce6bc9107b5fe81dffe8a155dded9b0471013b5), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`725d46b`](https://github.com/mastra-ai/mastra/commit/725d46b4b7eaf5a3f3ef2f3fbbe8ee8909cb2c9b), [`6e21835`](https://github.com/mastra-ai/mastra/commit/6e2183502250ee5325fc834d80f4d0584916f54e), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe), [`70cd0d8`](https://github.com/mastra-ai/mastra/commit/70cd0d80373346b4d04ebf913851ade37aa807ed), [`3802d6f`](https://github.com/mastra-ai/mastra/commit/3802d6f7dbf8c27b1f84b48c6c7c2efa6c4f0d03), [`2a83258`](https://github.com/mastra-ai/mastra/commit/2a832580e3cf3efcdb4be3355eaa9a02929b3a2c), [`fc3ee16`](https://github.com/mastra-ai/mastra/commit/fc3ee1604c0ec0a98e5051585e3d201b5699abbe)]:
  - @mastra/core@1.69.0

## 0.3.0-alpha.0

### Minor Changes

- Added ten generated tool providers to @mastra/connect: Slack, GitHub, Google Mail, Google Calendar, Fireflies, PostHog, Stripe, Discord, Twitter/X, and HubSpot. Each ships checked-in tools generated from Nango integration templates, including new agent-focused actions (PostHog HogQL queries, Stripe balance/dispute/coupon/account reads, GitHub tags and trees, Slack Connect shared-channel invites, Twitter search and following lookups, HubSpot form submission). Attach a provider connection in Mastra Platform and the tools resolve through connect() with no extra configuration: ([#24606](https://github.com/mastra-ai/mastra/pull/24606))

  ```ts
  import { Agent } from '@mastra/core/agent';
  import { connect } from '@mastra/connect';

  const agent = new Agent({
    id: 'ops-agent',
    model: 'anthropic/claude-sonnet-4-6',
    tools: connect(),
  });
  ```

### Patch Changes

- Generated `@mastra/connect` providers now cover more of the upstream template catalog. Actions that authenticate with the raw connection credential — token-introspection endpoints, for example — are generated instead of skipped, and actions that validate their input with the template validation helper are generated too. The credential is fetched from the platform only for the specific actions that read it. Under the hood this extends the platform proxy runtime and the provider generator; agents consume the resulting tools through the normal provider workflow with no API changes: ([#24605](https://github.com/mastra-ai/mastra/pull/24605))

  ```typescript
  import { Agent } from '@mastra/core/agent';
  import { connect } from '@mastra/connect';

  const assistant = new Agent({
    id: 'assistant',
    name: 'Assistant',
    instructions: 'Help with connected services.',
    model: 'anthropic/claude-sonnet-4-6',
    tools: connect(), // tools for every connected provider, resolved per request
  });
  ```

- Updated dependencies:
  - @mastra/core@1.69.0-alpha.1

## 0.2.0

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

- Added built-in Clerk and WorkOS providers with 42 and 40 tools respectively for identity, organization, directory, connection, invitation, membership, and domain administration. Provider tools can now forward repeated query parameters for multi-value filters. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Added built-in Anthropic, Notion, OpenAI, and Supabase providers. Generated tools can now read safe connection configuration and metadata through the platform proxy, enabling providers with connection-specific API hosts. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

### Patch Changes

- Fixed OpenAI image generation tools to send base64 images to models as multimodal image content instead of JSON text, preventing generated images from consuming the text context window. Updated the generated OpenAI tools to the current API parameters. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Removed warnings for providers that do not have project connections. Connect now silently skips unavailable providers while continuing to report actionable connection problems. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Raise the `@mastra/core` peer floor to `>=1.68.0-0` to match `@mastra/mcp` 2.x, which `@mastra/connect` uses for catalog MCP discovery. ([#23876](https://github.com/mastra-ai/mastra/pull/23876))

- Validate `baseUrlOverride` on the connection-proxy client before it is forwarded as a request header. Only absolute HTTPS URLs without embedded credentials are accepted; unparseable values, non-HTTPS schemes, and userinfo-bearing URLs are rejected with `invalid_options` so a compromised connection config cannot redirect authenticated proxy traffic to an unintended origin. ([#23527](https://github.com/mastra-ai/mastra/pull/23527))

- Updated dependencies [[`81ccd7b`](https://github.com/mastra-ai/mastra/commit/81ccd7b93040952fe9c7168a2757c43a217f0a87), [`a46385d`](https://github.com/mastra-ai/mastra/commit/a46385dc1b773d1e1453627b1d62e7b6ebe93cf1), [`1e68460`](https://github.com/mastra-ai/mastra/commit/1e68460205d0061c6dbc7a7e7a50950236af774b), [`372dfed`](https://github.com/mastra-ai/mastra/commit/372dfed464ad1cbf2d42e5559f08205eea8d54a0), [`4266b67`](https://github.com/mastra-ai/mastra/commit/4266b677d33bb20651ca296f64aa91fa3b3d4e82), [`d21aa84`](https://github.com/mastra-ai/mastra/commit/d21aa84aac0dc61bbc43434af7a3b3180373a8a7), [`291a694`](https://github.com/mastra-ai/mastra/commit/291a694b3f9b7d9a17af7d10ed3c9c357bed7a6c), [`2cb5319`](https://github.com/mastra-ai/mastra/commit/2cb5319fc72ef20e7feebfa1e786ff78956aae84), [`a0fbeab`](https://github.com/mastra-ai/mastra/commit/a0fbeabf6298854bcc6d64c8b31530bedd1ea934), [`7cfa0df`](https://github.com/mastra-ai/mastra/commit/7cfa0df76759a31b54dd1a87bc95d3064f2026e9), [`b246a1b`](https://github.com/mastra-ai/mastra/commit/b246a1ba0cec1ca2781c661a6b90c777520b64c7), [`f43da93`](https://github.com/mastra-ai/mastra/commit/f43da9335acf26f9d18a1fa4abb49efe70be935e), [`291a694`](https://github.com/mastra-ai/mastra/commit/291a694b3f9b7d9a17af7d10ed3c9c357bed7a6c), [`79385bb`](https://github.com/mastra-ai/mastra/commit/79385bbd8a52ed5e5536b16190dd8b8ac1ee0840), [`bec18d0`](https://github.com/mastra-ai/mastra/commit/bec18d05e7f997ead6ada04a4dc0179c3cad8aa2), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`6ef8186`](https://github.com/mastra-ai/mastra/commit/6ef8186ade9c8ca69269deed07fd47a942ecf70d), [`f6e7562`](https://github.com/mastra-ai/mastra/commit/f6e7562b2ccfdd5d7d77a7eeea0849b6ffd2ec94), [`11560f5`](https://github.com/mastra-ai/mastra/commit/11560f54627055f5ae541a6825669778983a23c9), [`abecb67`](https://github.com/mastra-ai/mastra/commit/abecb6709643785fd87a3ff9251032a61479ccab), [`697fecc`](https://github.com/mastra-ai/mastra/commit/697feccaa4ad5df913c22e47bf16f493dd7956a8), [`2ea44c1`](https://github.com/mastra-ai/mastra/commit/2ea44c1b578d8116507160ac32c7824faa07158e), [`9fe69d6`](https://github.com/mastra-ai/mastra/commit/9fe69d6566c3e6d1e5c9f5bf5e9848b35c73e182), [`25d940a`](https://github.com/mastra-ai/mastra/commit/25d940add25504daebe65bc5cc02f268d6eba07c), [`467e0a6`](https://github.com/mastra-ai/mastra/commit/467e0a630db09a1750ce9271bddb38e46681bf04), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`ee7187e`](https://github.com/mastra-ai/mastra/commit/ee7187e7bf66db46630f33c64e86b1ff7bb0c0b7), [`0bf287c`](https://github.com/mastra-ai/mastra/commit/0bf287c36ec14b45f5a4fdd0d279698694f592dd), [`89b8005`](https://github.com/mastra-ai/mastra/commit/89b8005902259b7c53b4079787a4798262b83192), [`b2942c0`](https://github.com/mastra-ai/mastra/commit/b2942c0f3c99dd1edba9dc8c2c17bfa55c851ae8), [`6249741`](https://github.com/mastra-ai/mastra/commit/6249741f8463bdc5a05ded2b35b143f92f33afbf), [`99fab39`](https://github.com/mastra-ai/mastra/commit/99fab399c35952ae15427ea64845d4762e9ec144), [`cd6948c`](https://github.com/mastra-ai/mastra/commit/cd6948c50aa4478d795613bdfa2d5259a7045026), [`2480359`](https://github.com/mastra-ai/mastra/commit/248035940aa048c7bcd8cfe7845915dc4734b571), [`15d3e76`](https://github.com/mastra-ai/mastra/commit/15d3e7647636c7286650ef517953c9885806c3dd), [`02f8f09`](https://github.com/mastra-ai/mastra/commit/02f8f09bc3665ed9a82ffbbc769e42e6027dc29b), [`34e4d21`](https://github.com/mastra-ai/mastra/commit/34e4d21e62c61e11e52aa7d6c39748b1120fbb93), [`8702f39`](https://github.com/mastra-ai/mastra/commit/8702f39331322ef0296fd3d68c0bd0997079faaa), [`d7f0579`](https://github.com/mastra-ai/mastra/commit/d7f0579a0445469430b9eadbf9c28ed3fa009839), [`5014bf6`](https://github.com/mastra-ai/mastra/commit/5014bf6a52f04304c30b4e572df4052085e3ac02), [`096825c`](https://github.com/mastra-ai/mastra/commit/096825c0cc37de5f465ecdc6617d642b8c898a78), [`d65d4d4`](https://github.com/mastra-ai/mastra/commit/d65d4d40a24a482d5b0ee83d9bab6042702ca1be), [`e6072cb`](https://github.com/mastra-ai/mastra/commit/e6072cbbd3482e37027e53e4d62da7aad6a36c41), [`c016c9b`](https://github.com/mastra-ai/mastra/commit/c016c9bd051612714e662588e5928b72bd6a6ac6), [`644ac13`](https://github.com/mastra-ai/mastra/commit/644ac131110a9f24a8d92b62dd3777384211a2e7), [`9cfb572`](https://github.com/mastra-ai/mastra/commit/9cfb5720d30af5421c021ab2cf8edd7a517b0442), [`b483910`](https://github.com/mastra-ai/mastra/commit/b48391034dee9a19396c1b3ec084ecf20faf550e), [`3c86726`](https://github.com/mastra-ai/mastra/commit/3c867260be59d3cd8337bc0af9a76bac517fe16f), [`6fd532a`](https://github.com/mastra-ai/mastra/commit/6fd532a2462858637a5f0b38096e9ab105bc146f), [`fec1259`](https://github.com/mastra-ai/mastra/commit/fec125946766805f3122be391272415691de6408), [`285b25a`](https://github.com/mastra-ai/mastra/commit/285b25aa9bb7cc3184991ad01f1acd4895fba076), [`33a46bd`](https://github.com/mastra-ai/mastra/commit/33a46bd43a5945b052e00341d1eecdcd78327d6e), [`4fb5ae9`](https://github.com/mastra-ai/mastra/commit/4fb5ae9e2cba9b14ba6c5cef0894e49bccf6f607), [`0a989ab`](https://github.com/mastra-ai/mastra/commit/0a989abf37c409040ee2ce9a9ccfcfb5a700508e), [`d4795a4`](https://github.com/mastra-ai/mastra/commit/d4795a42067605d2bbec10ad0b3dcc45acf02147), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`b87aa0d`](https://github.com/mastra-ai/mastra/commit/b87aa0dc38055558950024f750532ddae6ccf40c), [`ed24c7f`](https://github.com/mastra-ai/mastra/commit/ed24c7f654bb193a0c503469f4f19dda9d687ecb), [`babda00`](https://github.com/mastra-ai/mastra/commit/babda005397d2780aa21be0a7670688b704bdb2f), [`0894a0e`](https://github.com/mastra-ai/mastra/commit/0894a0e6ede48058b547aab5bb8a2a3d71c3878a), [`aa38e6f`](https://github.com/mastra-ai/mastra/commit/aa38e6f424a0eae0e43a5c2ae0b387e404f5e6a6), [`8d9eadb`](https://github.com/mastra-ai/mastra/commit/8d9eadb59ccbcae054600128aa15d95ea4d1141a), [`2476423`](https://github.com/mastra-ai/mastra/commit/24764233246dc85d7bcba8f8bb610110449a54d6), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`fa4c366`](https://github.com/mastra-ai/mastra/commit/fa4c3664c5446ae13d991204275883b2d7f00690), [`8d808d8`](https://github.com/mastra-ai/mastra/commit/8d808d8452b8acd5eda4f8cfe014331a8c0f1e92), [`164e197`](https://github.com/mastra-ai/mastra/commit/164e197aa5b0973ae49a82252294f6276b2829aa), [`e581e66`](https://github.com/mastra-ai/mastra/commit/e581e66e14bb1b2863698aecca7324fbf1ec4ff5), [`34fd538`](https://github.com/mastra-ai/mastra/commit/34fd538060402e414bdf65af9f469e7bff60be1e), [`1670091`](https://github.com/mastra-ai/mastra/commit/16700919c35dadb9737dc7fe7e5feb67cc209494), [`53519a2`](https://github.com/mastra-ai/mastra/commit/53519a29ce0063712786b74973ae2dbe97a433a7), [`a3f8f05`](https://github.com/mastra-ai/mastra/commit/a3f8f05ecb60c52056c590325e3821ecfc85afe3), [`58c88c4`](https://github.com/mastra-ai/mastra/commit/58c88c4e58504176ccb06d52df9440105aca788d), [`f43da93`](https://github.com/mastra-ai/mastra/commit/f43da9335acf26f9d18a1fa4abb49efe70be935e), [`13b0f30`](https://github.com/mastra-ai/mastra/commit/13b0f304533a43df7a7c486b6f37c9dca2187ecf), [`d39b43b`](https://github.com/mastra-ai/mastra/commit/d39b43beada08e69a962a47b58d743384722cd1f), [`b8e3ee5`](https://github.com/mastra-ai/mastra/commit/b8e3ee5da5cbc46b182ca75214acda667bac5205), [`02f8f09`](https://github.com/mastra-ai/mastra/commit/02f8f09bc3665ed9a82ffbbc769e42e6027dc29b), [`9cd9b4e`](https://github.com/mastra-ai/mastra/commit/9cd9b4eca69a3db0a0c415d0dcedf266cc7d5ec6), [`bdab4a8`](https://github.com/mastra-ai/mastra/commit/bdab4a889808d502f398a8086af3b50cc3bfbcd5), [`fc1e4f2`](https://github.com/mastra-ai/mastra/commit/fc1e4f2d4e0c1caa9d29de02f7be6a7d69ee2ea2), [`fa08939`](https://github.com/mastra-ai/mastra/commit/fa08939df788c81feb3f0afe70e10a3c40072f93), [`53cdd63`](https://github.com/mastra-ai/mastra/commit/53cdd6368b12aea743f95118a49fc6b93985fd20), [`3589cde`](https://github.com/mastra-ai/mastra/commit/3589cde4ea8dd210df6b9a2355a3e568210965fc), [`d777788`](https://github.com/mastra-ai/mastra/commit/d7777889d72b4f37a3d50b830f8208c736ee0e7a), [`5085475`](https://github.com/mastra-ai/mastra/commit/5085475c0da226e618eb3ee2676d347788c3fb00), [`5968b71`](https://github.com/mastra-ai/mastra/commit/5968b718044f8dd21bab6ce4ae7da3590729842b), [`76c7d98`](https://github.com/mastra-ai/mastra/commit/76c7d989f691510d7bfc016723cc78d7e08ac108), [`dafabf2`](https://github.com/mastra-ai/mastra/commit/dafabf22e4f4b0aabecb09839de5abe54e03151a), [`150a670`](https://github.com/mastra-ai/mastra/commit/150a67086539eea91cac3550fc068e6ac5c7e79b), [`f8683b3`](https://github.com/mastra-ai/mastra/commit/f8683b3f45fcc1b92cebe74991b94653a1fafab2), [`9fe69d6`](https://github.com/mastra-ai/mastra/commit/9fe69d6566c3e6d1e5c9f5bf5e9848b35c73e182), [`73ab51d`](https://github.com/mastra-ai/mastra/commit/73ab51dbb3d29413cae0a5bf5875cfa0382a589a), [`783e48a`](https://github.com/mastra-ai/mastra/commit/783e48aba82489a085230f6b8539a9fb338c326b), [`aee580d`](https://github.com/mastra-ai/mastra/commit/aee580d98976560e68e401c36790ce0cc6443aad), [`b26e528`](https://github.com/mastra-ai/mastra/commit/b26e5288891641044a3c26a498c06259985fed10), [`61f953a`](https://github.com/mastra-ai/mastra/commit/61f953a79736ac0d8a9650f0561c6dab1b097c8e), [`56680bf`](https://github.com/mastra-ai/mastra/commit/56680bfff71e7cdad71721b424b160bdd5de6e02), [`93a3425`](https://github.com/mastra-ai/mastra/commit/93a342569d592d0449eee7b4b4f7555dc001081b), [`32edb03`](https://github.com/mastra-ai/mastra/commit/32edb0371b8d884bee66897f236e852a959ae07a), [`7c73bac`](https://github.com/mastra-ai/mastra/commit/7c73baccc8336a4fb0db92614bf778bae5459e24), [`b130872`](https://github.com/mastra-ai/mastra/commit/b130872508e95f17894c2ed4932d4952db0a2d3c), [`a2c9876`](https://github.com/mastra-ai/mastra/commit/a2c9876f0d76a3b50ea28e6bab71de0ff4bd78a8), [`1853f3d`](https://github.com/mastra-ai/mastra/commit/1853f3d9331e3131930581556df781cca85f2d2d), [`b2f412a`](https://github.com/mastra-ai/mastra/commit/b2f412ae77fa5379471d103ebcc1ba69b22dd353), [`bc12e6c`](https://github.com/mastra-ai/mastra/commit/bc12e6cd9cc74fb078b006ed5d14429e2101cbb2), [`fdb59c6`](https://github.com/mastra-ai/mastra/commit/fdb59c6a4c3d9aea19159886aac8d80602763f04), [`07a81c8`](https://github.com/mastra-ai/mastra/commit/07a81c8be0cbdb5413ffa5c289d32765d80f4ea4), [`07ff1b8`](https://github.com/mastra-ai/mastra/commit/07ff1b8eafbd9c7786ef77decc6be3b63497cfd9), [`c6999e2`](https://github.com/mastra-ai/mastra/commit/c6999e2b4ab805301e66723ca8ba9fe30faa82ca), [`0ca5d6d`](https://github.com/mastra-ai/mastra/commit/0ca5d6d58a24e73a364451660a5a8696883eba45)]:
  - @mastra/core@1.68.0
  - @mastra/mcp@2.0.0

## 0.2.0-alpha.2

### Patch Changes

- Raise the `@mastra/core` peer floor to `>=1.68.0-0` to match `@mastra/mcp` 2.x, which `@mastra/connect` uses for catalog MCP discovery. ([#23876](https://github.com/mastra-ai/mastra/pull/23876))

- Updated dependencies [[`6ef8186`](https://github.com/mastra-ai/mastra/commit/6ef8186ade9c8ca69269deed07fd47a942ecf70d), [`2ea44c1`](https://github.com/mastra-ai/mastra/commit/2ea44c1b578d8116507160ac32c7824faa07158e), [`34e4d21`](https://github.com/mastra-ai/mastra/commit/34e4d21e62c61e11e52aa7d6c39748b1120fbb93), [`8702f39`](https://github.com/mastra-ai/mastra/commit/8702f39331322ef0296fd3d68c0bd0997079faaa), [`e6072cb`](https://github.com/mastra-ai/mastra/commit/e6072cbbd3482e37027e53e4d62da7aad6a36c41), [`8d808d8`](https://github.com/mastra-ai/mastra/commit/8d808d8452b8acd5eda4f8cfe014331a8c0f1e92)]:
  - @mastra/core@1.68.0-alpha.6
  - @mastra/mcp@2.0.0-alpha.4

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
