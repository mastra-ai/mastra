# PlatformKnowledge (experimental)

`PlatformKnowledge` is the open-source client for a Platform-hosted Knowledge instance. The client extends core `Knowledge` and delegates schema-v4 page-store operations over an authenticated project-scoped API. The provider, connection string, importer and sync scheduler belong to Platform, never to the client.

## Transport contract

- `POST {apiUrl}/v1/knowledge/{instanceId}/operations/{operation}` with `Authorization: Bearer {accessToken}` and JSON body `{ input }`; returns `{ result }`.
- `instanceId` is selected by option or `MASTRA_KNOWLEDGE_INSTANCE_ID`; `apiUrl` by option or `MASTRA_PLATFORM_API_URL`.
- Credential priority: option `accessToken`, `MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PLATFORM_SECRET_KEY`.
- The server resolves organization and project from the credential, validates instance ownership and readiness, and allowlists page-store operations. It never accepts a connection string from the caller.
- Platform's Knowledge storage contract and schema version must both be 4; the currently published Platform `@mastra/core` and `@mastra/pg` dependencies do not yet implement this contract. Upgrade both to a release with schema-v4 Knowledge before deploying.

## Verification matrix

The same scenarios must run once with core `Knowledge` on local PostgreSQL and again with `PlatformKnowledge` against Compose-backed Platform: scope materialization and discovery; nested page create/update/move/delete; search and read; notes and links; pin visibility; editor/viewer access; agent tool attachment, including denial across scopes. Connect-backed source provisioning, import, and incremental re-sync require a separate linked-source scenario; host page writes alone do not prove this integration.
