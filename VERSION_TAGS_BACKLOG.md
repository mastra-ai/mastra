# Version tags: feature backlog

Follow-ups for agent version tags that are not in this branch. Remove this file before the branch merges.

## Accept `?tag=` on the generate and stream routes

**Today:** a run selects a tag with `requestContext.agentVersionTag` in the request body (or set by server middleware). `?tag=` only works on `GET /agents/:agentId` and the plans route.

**Wanted:** `POST /agents/:agentId/generate?tag=staging` and `POST /agents/:agentId/stream?tag=staging` run the tagged version, so a caller can pick a tag from the URL alone.

**Notes:**

- This is a query parameter on existing routes, with no new route, table, or column.
- Precedence should stay `versionId` > `tag` > `status`. Decide which wins when the query tag and `requestContext.agentVersionTag` disagree; the query parameter is the more explicit of the two.
- `extractVersionOptions` and `getAgentFromSystem` in `packages/server/src/server/handlers/agents.ts` already resolve and pin a tag for the run, so the work is reading the query parameter on the run routes and passing it through.
- Cover the other run routes that share those helpers (for example network and approval routes) or state that they are excluded.
- Regenerate the client route types and CLI route metadata, add the case to `packages/editor/src/agent-version-tags.integration.test.ts`, and update `docs/src/content/en/reference/editor/versioning.mdx`.

# Reference: the closed "labels" stack

An earlier design for the same feature used dedicated storage and routes. Its pull requests were closed on 2026-11-24 in favor of the metadata-based tags in this branch. The branches were kept in case that design is needed later, for example if tags need their own history, per-tag permissions, or atomic moves.

| PR                                                       | Branch                               | Scope                                            |
| -------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| [#25519](https://github.com/mastra-ai/mastra/pull/25519) | `codex/agent-version-labels-core`    | Core labels and immutable run pins               |
| [#25520](https://github.com/mastra-ai/mastra/pull/25520) | `codex/agent-version-labels-storage` | Label persistence                                |
| [#25521](https://github.com/mastra-ai/mastra/pull/25521) | `codex/agent-version-labels-api-sdk` | Label APIs and SDK methods                       |
| [#25522](https://github.com/mastra-ai/mastra/pull/25522) | `codex/agent-version-labels-studio`  | Studio label management and run-target selection |
