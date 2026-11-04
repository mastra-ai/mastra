# PlatformKnowledge (experimental)

`PlatformKnowledge` is the open-source client for a Platform-hosted Knowledge instance. The client extends core `Knowledge` and delegates schema-v4 page-store operations over an authenticated project-scoped API. The provider, connection string, importer and sync scheduler belong to Platform, never to the client.

## Transport contract

- `POST {apiUrl}/v1/knowledge/{instanceId}/operations/{operation}` with `Authorization: Bearer {accessToken}` and JSON body `{ input }`; returns `{ result }`.
- `instanceId` and `apiUrl` come from options or `MASTRA_KNOWLEDGE_INSTANCE_ID` and `MASTRA_KNOWLEDGE_API_URL`; `apiUrl` defaults to `https://knowledge-api.mastra.ai`. `projectId` is an optional hint; the service derives the authorized project from the instance and credential.
- Credential priority: option `accessToken`, `MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PLATFORM_SECRET_KEY`.
- The server checks that the instance belongs to the credential's organization and, for project-bound tokens, its project; it allowlists page-store operations and never accepts a connection string from the caller.
- Hosted Knowledge requires a core and PostgreSQL adapter release implementing the Knowledge pages-v4 contract; production release alignment remains pending.

## Verification matrix

The same scenarios must run once with core `Knowledge` on local PostgreSQL and again with `PlatformKnowledge` against Compose-backed Platform: scope materialization and discovery; nested page create/update/move/delete; search and read; notes and links; pin visibility; editor/viewer access; agent tool attachment, including denial across scopes. Connect-backed source provisioning, import, and incremental re-sync require a separate linked-source scenario; host page writes alone do not prove this integration.
