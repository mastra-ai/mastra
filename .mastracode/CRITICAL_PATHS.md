# Critical Paths

Brittle code paths in the Mastra monorepo. Each entry lists a file or glob, the GitHub owners who must review changes to it, and a short reason explaining why.

## Instructions for the triage agent

When triaging a PR, do the following:

1. Get the list of changed files in the PR.
2. For each changed file, check whether it matches any `path` entry below. A `**` suffix means every file under that directory.
3. If one or more changed files match, add every listed `owner` from the matching entries as a reviewer on the PR. In your triage comment, list each matched path and its `reason` so the reviewer has context.
4. If zero changed files match, this file has no effect on the PR. Continue with normal triage.

## Paths

```yaml
- path: packages/core/src/loop/loop.ts
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Core agent execution loop; ordering, streaming, tool calls, and resume behavior all converge here.

- path: packages/core/src/loop/network/**
  owners: ["@rase-", "@taofeeq-deru", "@abhiaiyer91"]
  reason: Networked loop execution coordinates distributed state and event flow.

- path: packages/core/src/loop/workflows/**
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Workflow-backed loop execution state; small ordering or serialization changes can break agent runs.

- path: packages/core/src/agent/agent.ts
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Main Agent implementation and public behavior surface used across the framework.

- path: packages/core/src/agent/message-list/message-list.ts
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Central message normalization and persistence boundary logic for agent conversations.

- path: packages/core/src/agent/message-list/state/**
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Tracks message sources and persistence state; mistakes can duplicate, drop, or corrupt messages.

- path: packages/core/src/agent/message-list/conversion/**
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Converts between Mastra and AI SDK message formats; field loss here silently affects all agents.

- path: packages/core/src/agent/save-queue/**
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Ordered async persistence for agent messages; race conditions can cause data loss.

- path: packages/core/src/agent/durable/run-registry.ts
  owners: ["@taofeeq-deru", "@rase-"]
  reason: Tracks in-flight durable agent runs used for suspend and resume.

- path: packages/core/src/agent/durable/stream-adapter.ts
  owners: ["@taofeeq-deru", "@rase-"]
  reason: Bridges durable agent streaming with resumable workflow execution.

- path: packages/core/src/workflows/index.ts
  owners: ["@rase-", "@taofeeq-deru", "@abhiaiyer91"]
  reason: Workflow public entry point for step execution, branching, suspend, and resume.

- path: packages/core/src/workflows/workflow.ts
  owners: ["@rase-", "@taofeeq-deru", "@abhiaiyer91"]
  reason: Main workflow engine implementation; state transitions and resume behavior are highly coupled.

- path: packages/core/src/workflows/evented/**
  owners: ["@rase-", "@taofeeq-deru", "@abhiaiyer91"]
  reason: Evented workflow runtime; event ordering and persisted state must stay consistent.

- path: packages/core/src/workflows/scheduler/**
  owners: ["@abhiaiyer91", "@rase-"]
  reason: Workflow scheduling bridges runtime state with deferred execution.

- path: packages/core/src/mastra/index.ts
  owners: ["@wardpeet", "@abhiaiyer91"]
  reason: Root Mastra framework hub that wires agents, tools, workflows, storage, and telemetry.

- path: packages/core/src/llm/model/model.ts
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Core model abstraction used by all providers and agent generation paths.

- path: packages/core/src/llm/model/model.loop.ts
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Connects model execution to loop semantics, tool calls, and streamed responses.

- path: packages/core/src/llm/model/router.ts
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Model routing determines which provider and auth context executes a request.

- path: packages/core/src/llm/model/gateways/**
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Gateway adapters route model calls through external gateway services.

- path: packages/core/src/stream/aisdk/**
  owners: ["@taofeeq-deru", "@wardpeet"]
  reason: AI SDK stream compatibility layer; protocol mistakes break streamed agent output.

- path: packages/core/src/stream/base/**
  owners: ["@taofeeq-deru", "@wardpeet"]
  reason: Base stream transforms, schemas, and output handling shared by streaming responses.

- path: packages/core/src/processors/runner.ts
  owners: ["@DanielSLew", "@TylerBarnes", "@wardpeet"]
  reason: Coordinates processor execution and error/retry behavior around model output.

- path: packages/core/src/processor-provider/**
  owners: ["@DanielSLew", "@TylerBarnes", "@wardpeet"]
  reason: Registers and resolves output processors used during agent execution.

- path: packages/core/src/memory/index.ts
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Core memory surface for persistence, recall, and working memory integration.

- path: packages/core/src/processors/memory/**
  owners: ["@DanielSLew", "@TylerBarnes", "@wardpeet"]
  reason: Memory processors inject recall and working memory into agent context.

- path: packages/memory/src/processors/observational-memory/observational-memory.ts
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Complex observation extraction pipeline that writes long-term memory.

- path: packages/memory/src/processors/working-memory-state/**
  owners: ["@CalebBarnes", "@TylerBarnes", "@abhiaiyer91"]
  reason: Tracks mutable working memory state across conversations.

- path: packages/core/src/deployer/index.ts
  owners: ["@wardpeet", "@TheIsrael1", "@LekoArts"]
  reason: Core deployer interface used by deployment targets.

- path: packages/core/src/bundler/index.ts
  owners: ["@wardpeet", "@TheIsrael1", "@LekoArts"]
  reason: Core bundling entry point; incorrect output breaks deployments.

- path: packages/deployer/src/build/**
  owners: ["@wardpeet", "@TheIsrael1", "@LekoArts"]
  reason: Entire deployer build pipeline is brittle; unit tests cannot catch build output bugs, only e2e tests work. Community PRs here almost always break production builds (see #18930).

- path: packages/core/src/storage/index.ts
  owners: ["@NikAiyer", "@abhiaiyer91"]
  reason: Storage abstraction entry point used by persistence providers.

- path: packages/core/src/storage/types.ts
  owners: ["@NikAiyer", "@abhiaiyer91"]
  reason: Shared storage interfaces; type changes affect every storage backend.

- path: packages/core/src/storage/base.ts
  owners: ["@NikAiyer", "@abhiaiyer91"]
  reason: Base storage contract used by all storage implementations.

- path: packages/core/src/storage/domains/workflows/**
  owners: ["@NikAiyer", "@abhiaiyer91"]
  reason: Workflow persistence domain; bugs can corrupt run snapshots and resume state.

- path: packages/core/src/storage/domains/observability/**
  owners: ["@epinzur", "@NikAiyer"]
  reason: Observability persistence schemas feed traces, logs, metrics, and scores.

- path: packages/core/src/server/index.ts
  owners: ["@wardpeet", "@rphansen91", "@abhiaiyer91"]
  reason: Core server API entry point for Mastra applications.

- path: packages/server/src/server/server-adapter/index.ts
  owners: ["@rase-", "@NikAiyer"]
  reason: Server adapter route registration and request handling boundary.

- path: packages/server/src/server/schemas/route-contracts.ts
  owners: ["@rase-", "@NikAiyer"]
  reason: Shared route contract definitions used to keep server handlers and clients aligned.

- path: packages/server/src/server/handlers/responses.ts
  owners: ["@rase-", "@NikAiyer"]
  reason: Response execution endpoint drives agent responses, streaming, and persistence behavior.

- path: packages/server/src/server/handlers/agents.ts
  owners: ["@rase-", "@NikAiyer"]
  reason: Main agent API handlers expose generation, streaming, and agent metadata routes.

- path: packages/core/src/auth/ee/**
  owners: ["@rphansen91", "@graysonhicks"]
  reason: Enterprise auth, RBAC, and FGA checks gate protected functionality.

- path: packages/core/src/auth/defaults/session/**
  owners: ["@rphansen91", "@graysonhicks"]
  reason: Default session handling affects authentication correctness and cookie behavior.

- path: packages/core/src/license/index.ts
  owners: ["@junydania", "@abhiaiyer91"]
  reason: License validation and enforcement for gated functionality.

- path: packages/core/src/signals/**
  owners: ["@TylerBarnes", "@abhiaiyer91"]
  reason: Signal delivery for agents and workflows; ordering and delivery mistakes can hang runs.

- path: packages/core/src/request-context/**
  owners: ["@wardpeet", "@abhiaiyer91"]
  reason: Async request context propagation; leaks or missing context can route execution incorrectly.

- path: packages/core/src/observability/**
  owners: ["@epinzur", "@intojhanurag"]
  reason: Core observability types and exporters feed traces used to debug production behavior.

- path: packages/core/src/telemetry/**
  owners: ["@epinzur", "@intojhanurag"]
  reason: Telemetry spans and attributes must remain compatible with monitoring dashboards.

- path: client-sdks/client-js/src/resources/agent.ts
  owners: ["@TheIsrael1", "@wardpeet", "@mfrachet"]
  reason: Client agent resource maps public SDK calls to server agent endpoints.

- path: client-sdks/client-js/src/route-types.generated.ts
  owners: ["@TheIsrael1", "@wardpeet", "@mfrachet"]
  reason: Generated route types couple the public client SDK to server API contracts.

- path: packages/schema-compat/src/index.ts
  owners: ["@wardpeet", "@DanielSLew", "@TylerBarnes"]
  reason: Schema compat public entry point; changes affect all providers.

- path: packages/schema-compat/src/types.ts
  owners: ["@wardpeet", "@DanielSLew", "@TylerBarnes"]
  reason: Shared schema compat types used by every provider compat layer.

- path: packages/schema-compat/src/schema-compatibility*.ts
  owners: ["@wardpeet", "@DanielSLew", "@TylerBarnes"]
  reason: Core schema transformation logic shared across all providers.

- path: packages/schema-compat/src/json-schema/**
  owners: ["@wardpeet", "@DanielSLew", "@TylerBarnes"]
  reason: JSON Schema utilities used by all provider compat layers.

- path: packages/schema-compat/src/zod-to-json.ts
  owners: ["@wardpeet", "@DanielSLew", "@TylerBarnes"]
  reason: Zod-to-JSON-Schema conversion shared across providers.

- path: packages/schema-compat/src/json-to-zod.ts
  owners: ["@wardpeet", "@DanielSLew", "@TylerBarnes"]
  reason: JSON-Schema-to-Zod conversion shared across providers.

- path: packages/_vendored/ai_v*/**
  owners: ["@wardpeet", "@TheIsrael1", "@abhiaiyer91"]
  reason: Vendored AI SDK compatibility code affects provider behavior across the monorepo.

- path: packages/core/src/background-tasks/manager.ts
  owners: ["@taofeeq-deru", "@rase-"]
  reason: Stateful background task manager coordinating pubsub, task context, abort controllers, and lifecycle cleanup.

- path: packages/core/src/background-tasks/schema-injection.ts
  owners: ["@taofeeq-deru", "@rase-"]
  reason: Extends Zod schemas for background task payloads; compatibility mistakes can break task dispatch.

- path: packages/core/src/agent-controller/session-run-engine.ts
  owners: ["@abhiaiyer91", "@wardpeet"]
  reason: Stream-to-state folding engine for session runs; metadata and output state must remain consistent.

- path: packages/core/src/agent-controller/session.ts
  owners: ["@abhiaiyer91", "@wardpeet"]
  reason: Large stateful session implementation covering memory, state, subagents, and approval behavior.

- path: packages/core/src/events/pubsub.ts
  owners: ["@rase-", "@TylerBarnes"]
  reason: Pubsub abstraction for cross-process event delivery, delivery mode negotiation, and flush guarantees.

- path: packages/core/src/events/codec/codec.ts
  owners: ["@rase-", "@TylerBarnes"]
  reason: Serialization roundtrip for cross-wire events; breakage can corrupt event delivery.

- path: packages/core/src/loop/run-scope-keys.ts
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Typed registry for non-serializable run-scoped runtime state used by loop execution.

- path: packages/core/src/loop/hydrate-run-scope.ts
  owners: ["@TylerBarnes", "@CalebBarnes", "@abhiaiyer91"]
  reason: Bootstrap point that hydrates run scope from stream internals before loop execution continues.

- path: packages/core/src/worker/workers/orchestration-worker.ts
  owners: ["@rase-", "@NikAiyer"]
  reason: Workflow event processor coordinating pull-based subscriptions and remote worker execution.
```
