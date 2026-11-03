# PlatformKnowledge (experimental)

`PlatformKnowledge` is the open-source client for a Platform-hosted Knowledge instance. The client extends core `Knowledge` and delegates schema-v4 page-store operations over an authenticated project-scoped API. The provider, connection string, importer and sync scheduler belong to Platform, never to the client.

## Transport contract

- `POST {apiUrl}/v1/knowledge/{projectId}/{instanceId}/operations/{operation}` with `Authorization: Bearer {accessToken}` and JSON body `{ input }`; returns `{ result }`.
- `projectId`, `instanceId`, and `apiUrl` come from the respective options or `MASTRA_PROJECT_ID`, `MASTRA_KNOWLEDGE_INSTANCE_ID`, and `MASTRA_PLATFORM_API_URL`.
- Credential priority: option `accessToken`, `MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PLATFORM_SECRET_KEY`.
- The server verifies that the credential authorizes the project path and that the instance belongs to that project and is ready; it allowlists page-store operations and never accepts a connection string from the caller.
- The hosted service uses published schema-v4 alphas `@mastra/core@1.82.0-alpha.2` and `@mastra/pg@1.35.0-alpha.2`; production release alignment remains pending.

## Verification matrix

The same scenarios must run once with core `Knowledge` on local PostgreSQL and again with `PlatformKnowledge` against Compose-backed Platform: scope materialization and discovery; nested page create/update/move/delete; search and read; notes and links; pin visibility; editor/viewer access; agent tool attachment, including denial across scopes. Connect-backed source provisioning, import, and incremental re-sync require a separate linked-source scenario; host page writes alone do not prove this integration.
