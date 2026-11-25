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

# Informal UX backlog

Unordered notes on how tags behave today and where that may surprise people. None of these are built.

## One tag across a run

Built: the agent tag also selects sub-agents and prompt blocks, an unknown prompt tag returns 404, and agent run spans report the versions that ran. What is left:

- **A partly tagged release still runs.** A sub-agent or prompt block without the tag uses its published version. The trace lists these (`promptBlocksWithoutTag`), but nothing refuses the run. Option: a strict mode that fails when anything in the run lacks the tag.
- **The prompt tag check ignores rules.** The 404 looks at every prompt block the agents reference, including ones a rule would skip for this request.
- **Only some run routes apply the tag to sub-agents and check the prompt tag.** Generate, stream, stream until idle, signals and messages, resume and recover do. The legacy, network and tool approval routes don't. Prompt blocks follow the tag on every route.
- **Stored sub-agents of stored agents.** A stored agent only gets a stored sub-agent if the server has that sub-agent loaded when the parent is loaded, and any update unloads it. This predates tags; the tests use a code-defined sub-agent with stored versions.
- **Traces for durable agents.** The span metadata is wired for durable runs but not tested there. Recovered runs don't report it.

## Knowing what ran

- **Studio doesn't surface the versions in a trace.** The metadata is on the agent run span; there is no dedicated display or filter for it.
- **Responses don't report versions.** Only traces do.
- **No way to try a tag in Studio.** The chat view has no tag picker, and there is no "copy the API call for this tag" action next to a tag.

## Moving and removing tags safely

- **Moving a tag is silent.** Typing an existing name moves that tag with no confirmation, and removing one is a single click. Removing `production` makes every caller of that tag get a 404.
- **No history.** Tag changes create no version and no log, so there is no record of who moved `production`, when, or from which version, and no one-click rollback.
- **Last write wins.** Each save replaces the whole tag map, so a stale Studio tab or two people editing at once can drop each other's tags.
- **No protected tags.** Anyone who can edit the agent or prompt can move any tag. There is no way to restrict `production`.

## Finding and understanding tags

- **Published and tags are two separate pointers.** Calls without a tag run the published version. A `production` tag does nothing unless callers ask for it, which is easy to misread in the panel.
- **Tags only show in the version history panel.** They are not in the agent or prompt lists, the page header, or the prompt editor's version dropdown.
- **No cross-resource view.** There is no place to see what `staging` points at across all agents and prompts, or to promote several at once.
- **Free-text names.** Nothing suggests existing tag names, so `prodution` becomes a new tag.
- **Delete is refused late.** A tagged version can't be deleted, but the user only learns that from the error after trying.

## Environments and sources

- **Tags live in one database.** They don't travel between environments, and there is no export or import.
- **Code-source agents.** Check how tags should behave when agent versions come from Git history.

## Loose ends

- **Client SDK runs.** `generate()` and `stream()` have no tag option; callers set request context by hand.
- **Phone layout of the prompt editor.** The content column doesn't fit at 390px.
- **Explicit `agentVersionId` on a stored agent runs the latest draft.** This predates tags and is recorded as an expected failure in `packages/editor/src/agent-version-tags.integration.test.ts`.

# Reference: the closed "labels" stack

An earlier design for the same feature used dedicated storage and routes. Its pull requests were closed on 2026-11-24 in favor of the metadata-based tags in this branch. The branches were kept in case that design is needed later, for example if tags need their own history, per-tag permissions, or atomic moves.

| PR                                                       | Branch                               | Scope                                            |
| -------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| [#25519](https://github.com/mastra-ai/mastra/pull/25519) | `codex/agent-version-labels-core`    | Core labels and immutable run pins               |
| [#25520](https://github.com/mastra-ai/mastra/pull/25520) | `codex/agent-version-labels-storage` | Label persistence                                |
| [#25521](https://github.com/mastra-ai/mastra/pull/25521) | `codex/agent-version-labels-api-sdk` | Label APIs and SDK methods                       |
| [#25522](https://github.com/mastra-ai/mastra/pull/25522) | `codex/agent-version-labels-studio`  | Studio label management and run-target selection |
