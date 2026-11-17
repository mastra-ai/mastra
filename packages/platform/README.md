# @mastra/platform (experimental)

Hosted Mastra Platform clients for Memory, Knowledge, and Browser, with Sandbox and Filesystem re-exported from the `@mastra/platform-workspace` dependency.

## Installation

```sh
npm install @mastra/platform
```

## Usage

Set `MASTRA_PLATFORM_ACCESS_TOKEN` (or `MASTRA_PLATFORM_SECRET_KEY`). `PlatformMemory` also needs `MASTRA_MEMORY_INSTANCE_ID` and `PlatformKnowledge` needs `MASTRA_KNOWLEDGE_INSTANCE_ID`; the example below uses both, so set both IDs. Obtain your instance IDs and credentials from Mastra Platform.

```ts
import { Agent } from '@mastra/core/agent';
import { PlatformMemory, PlatformKnowledge } from '@mastra/platform';

const model = 'openai/gpt-4o-mini';
const agent = new Agent({
  name: 'assistant',
  model,
  memory: new PlatformMemory(),
});
const knowledge = new PlatformKnowledge();
```

`PlatformSandbox` and `PlatformFilesystem` are also available from `@mastra/platform`.

### Hosted browser

Create a hosted browser from your Mastra Platform project's browser page, then pass its CDP URL to `PlatformBrowser`. Treat the CDP URL as a secret: anyone holding it can connect to that browser. Keep it server-side, do not commit it, and use a secure environment variable such as `MASTRA_BROWSER_CDP_URL`.

```ts
import { Agent } from '@mastra/core/agent';
import { PlatformBrowser } from '@mastra/platform';

const agent = new Agent({
  name: 'browser-agent',
  model: 'openai/gpt-4o-mini',
  browser: new PlatformBrowser({ cdpUrl: process.env.MASTRA_BROWSER_CDP_URL! }),
});
```

Alternatively, provide a Mastra Platform project ID and access token to provision a new Browserbase-backed session on demand. Browserbase credentials stay on the Platform server.

```ts
const browser = new PlatformBrowser({ projectId: 'your-project-id' });
```

`PlatformBrowser` uses `MASTRA_PLATFORM_ACCESS_TOKEN` or `MASTRA_PLATFORM_SECRET_KEY` and `MASTRA_PROJECT_ID` when the corresponding options are omitted for on-demand provisioning. It POSTs `{ projectId }` to `https://platform.mastra.ai/v1/browsers/sessions` (overridable with `apiUrl` or `MASTRA_BROWSER_API_URL`) and connects to the returned CDP URL with shared browser scope. A project access token must be authorized for that project. Supplying `cdpUrl` skips provisioning and does not require a Platform token or project ID.

### Knowledge transport contract

- `POST {apiUrl}/v1/knowledge/{instanceId}/operations/{operation}` with `Authorization: Bearer {accessToken}` and JSON body `{ input }`; returns `{ result }`.
- `instanceId` and `apiUrl` come from options or `MASTRA_KNOWLEDGE_INSTANCE_ID` and `MASTRA_KNOWLEDGE_API_URL`; `apiUrl` defaults to `https://knowledge-api.mastra.ai`. The service derives the authorized project from the instance and credential; `projectId` is accepted for compatibility but is not sent.
- `renameScopeDeclaration` is not forwarded and rejects with `KnowledgeUnsupportedCapabilityError`: its `check` callback cannot be sent to the hosted store.
- Credential priority: option `accessToken`, `MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PLATFORM_SECRET_KEY`.
- The server checks that the instance belongs to the credential's organization and, for project-bound tokens, its project; it allowlists page-store operations and never accepts a connection string from the caller.
- Hosted Knowledge requires a core and PostgreSQL adapter release implementing the Knowledge pages-v4 contract; production release alignment remains pending.

## Documentation

`PlatformKnowledge` extends core `Knowledge` and delegates schema-v4 page-store operations to the hosted service. The provider, connection string, importer, and sync scheduler belong to Platform rather than this client. For general API concepts, see [Mastra documentation](https://mastra.ai/docs).

### Verification matrix

The same scenarios must run once with core `Knowledge` on local PostgreSQL and again with `PlatformKnowledge` against Compose-backed Platform: scope materialization and discovery; nested page create/update/move/delete; search and read; notes and links; pin visibility; editor/viewer access; agent tool attachment, including denial across scopes. Connect-backed source provisioning, import, and incremental re-sync require a separate linked-source scenario; host page writes alone do not prove this integration.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/platform/CHANGELOG.md).

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
