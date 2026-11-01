// Core unit test files that run with per-file isolation (`unit:packages/core-isolated`).
// Every other core unit test file shares its worker's module cache with the files before it
// (`isolate: false`), which removes most of the import cost.
//
// A file belongs here when sharing a worker would change what it tests:
// - vi.mock: mocks bind when a module is first imported. With a shared cache, a module an
//   earlier file already imported keeps its real (or someone else's mocked) version, and this
//   file's mocks stay registered for the files after it.
// - env: sets process.env, often in vi.hoisted before imports. Modules that read the value at
//   import time keep whichever value the first importer saw, and the change outlives the file.
// - global: replaces a global (fetch, process.on, ...) that later files would inherit.
// - reset-modules: calls vi.resetModules (directly or through restart-harness) to load a
//   second copy of core. In a shared worker every reload adds another copy, and the parallel
//   re-imports can evaluate a module before the class it extends ("Class extends value undefined").
// - heap: asserts on process.memoryUsage() deltas, which work left running by earlier files in
//   the same worker allocates into.
//
// The list comes from scanning test sources for those patterns, then checking the rest
// with a leak probe that diffs worker state between files.
export const isolatedTestFiles = [
  'src/agent-controller/__tests__/session-message-after-swept-prompt.test.ts', // env
  'src/agent-controller/fork-clone-metadata.test.ts', // vi.mock
  'src/agent-controller/lease-lost-abort-reason.test.ts', // env
  'src/agent-controller/list-available-models.test.ts', // global
  'src/agent-controller/subagent-tool.test.ts', // vi.mock
  'src/agent/__tests__/abort-run-stream-without-thread.test.ts', // global,reset-modules
  'src/agent/__tests__/agent-turn-tool-stream.test.ts', // vi.mock
  'src/agent/__tests__/mcp-instructions.test.ts', // vi.mock
  'src/agent/__tests__/model-retry-after.test.ts', // vi.mock
  'src/agent/__tests__/scorers.test.ts', // vi.mock
  'src/agent/__tests__/structured-output.test.ts', // env
  'src/agent/__tests__/suspended-run-ttl.test.ts', // env
  'src/agent/__tests__/thread-lease-loss-abort.test.ts', // vi.mock,env
  'src/agent/__tests__/thread-lease-loss-no-abort-run-stream.test.ts', // env
  'src/agent/__tests__/thread-lease-loss-tool-scope.test.ts', // env
  'src/agent/__tests__/thread-stream-late-generation.test.ts', // env
  'src/agent/__tests__/thread-stream-save-listener.test.ts', // vi.mock
  'src/agent/durable/__tests__/agreement-memory.test.ts', // reset-modules
  'src/agent/durable/__tests__/durable-agent-background-transform.test.ts', // vi.mock
  'src/agent/durable/__tests__/durable-agent-concurrent-runs.test.ts', // reset-modules
  'src/agent/durable/__tests__/durable-agent-crash-recovery.test.ts', // vi.mock,reset-modules
  'src/agent/durable/__tests__/durable-agent-memory-message-refs.test.ts', // reset-modules
  'src/agent/durable/__tests__/durable-agent-model-list-settings-recovery.test.ts', // reset-modules
  'src/agent/durable/__tests__/durable-agent-parallel-tool-restart.test.ts', // reset-modules
  'src/agent/durable/__tests__/durable-agent-step-budget-recovery.test.ts', // reset-modules
  'src/agent/durable/__tests__/durable-agent-usage-detail-counters.test.ts', // reset-modules
  'src/agent/durable/__tests__/evented-workflow-agent-step-restart.test.ts', // reset-modules
  'src/agent/durable/__tests__/evented-workflow-agent-suspend-recovery.test.ts', // reset-modules
  'src/agent/durable/__tests__/evented-workflow-sleep-restart.test.ts', // reset-modules
  'src/agent/durable/__tests__/recover-processor-agent.test.ts', // reset-modules
  'src/agent/durable/__tests__/recover-task-completion-repro.test.ts', // reset-modules
  'src/agent/durable/__tests__/recover-tool-search.test.ts', // reset-modules
  'src/agent/durable/__tests__/restart-agreement.test.ts', // reset-modules
  'src/agent/durable/__tests__/restart-harness.test.ts', // reset-modules
  'src/agent/durable/__tests__/resume-claim-loser.test.ts', // env,reset-modules
  'src/agent/durable/__tests__/workflow-restart-shapes.test.ts', // reset-modules
  'src/agent/durable/workflows/__tests__/finalize-run.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/llm-mapping-pending-client-tool.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-approval-recall.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-call-actor.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-call-approval-context.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-call-bg.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-call-cold-resume.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-call-fga.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-call-keep-alive.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-call-nested-approval.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-call-provider-executed.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-call-provider-fallback.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-call-result-processors.test.ts', // vi.mock
  'src/agent/durable/workflows/steps/tool-call-xproc-workspace.test.ts', // vi.mock
  'src/agent/message-list/prompt/download-assets.test.ts', // vi.mock,global
  'src/auth/ee/__tests__/capabilities-fga.test.ts', // env
  'src/auth/ee/__tests__/capabilities-rbac-binding.test.ts', // env
  'src/auth/ee/__tests__/ee-telemetry.test.ts', // vi.mock,env
  'src/background-tasks/library-mode.test.ts', // env
  'src/datasets/__tests__/caller-driven-experiments.test.ts', // vi.mock
  'src/datasets/experiment/__tests__/executor.test.ts', // vi.mock
  'src/datasets/experiment/__tests__/p0-regression.test.ts', // vi.mock
  'src/datasets/experiment/__tests__/p1-regression.test.ts', // vi.mock
  'src/datasets/experiment/__tests__/tool-mocks-execution.test.ts', // vi.mock
  'src/evals/hooks.test.ts', // vi.mock
  'src/evals/scoreTraces/scoreTrace.test.ts', // vi.mock
  'src/events/unix-socket-pubsub-lease-recovery.test.ts', // vi.mock
  'src/events/unix-socket-pubsub.test.ts', // heap
  'src/llm/model/cloudflare-workers-ai-url.test.ts', // vi.mock,env
  'src/llm/model/gateways/azure.test.ts', // vi.mock,global
  'src/llm/model/gateways/custom-gateway.test.ts', // env
  'src/llm/model/gateways/mastra.test.ts', // env
  'src/llm/model/gateways/models-dev-kimi-usage.test.ts', // global
  'src/llm/model/gateways/models-dev.test.ts', // vi.mock,env,global
  'src/llm/model/gateways/netlify.test.ts', // env,global
  'src/llm/model/openai-websocket-fetch.test.ts', // vi.mock
  'src/llm/model/provider-registry.test.ts', // env
  'src/llm/model/registry-generator.test.ts', // global
  'src/llm/model/router-api-provider-id.test.ts', // env
  'src/llm/model/router-custom-provider-api.test.ts', // vi.mock
  'src/llm/model/router-custom-provider.test.ts', // vi.mock
  'src/llm/model/router-deepseek.test.ts', // env,global
  'src/llm/model/router-openai-websocket.test.ts', // vi.mock,env
  'src/llm/model/router-openrouter-headers.test.ts', // vi.mock,env
  'src/loop/loop.test.ts', // vi.mock
  'src/loop/network/run-command-tool.test.ts', // global
  'src/loop/shared/steps/background-dispatch-core.test.ts', // vi.mock
  'src/loop/test-utils/aimock/scenarios/agent-prepare-step-dynamic.scenario.test.ts', // env
  'src/loop/workflows/agentic-execution/llm-execution-step.test.ts', // vi.mock
  'src/loop/workflows/stream.test.ts', // vi.mock
  'src/mastra/classifier-registry-schema.test.ts', // vi.mock
  'src/mastra/custom-gateway-integration.test.ts', // env
  'src/mastra/environment.test.ts', // env
  'src/mastra/internal-workflow-registry.test.ts', // env
  'src/mastra/scheduler-integration.test.ts', // env
  'src/mastra/workers-filter.test.ts', // env
  'src/processors/stream-error-retry-processor.test.ts', // vi.mock
  'src/skills/validate.test.ts', // global
  'src/storage/base.test.ts', // env
  'src/storage/storageWithInit.test.ts', // env
  'src/telemetry/context.test.ts', // vi.mock,env
  'src/telemetry/feature-telemetry.test.ts', // vi.mock,env
  'src/telemetry/model-usage-telemetry.test.ts', // vi.mock,env
  'src/telemetry/posthog.test.ts', // vi.mock,env
  'src/telemetry/usage-telemetry.test.ts', // vi.mock,env
  'src/tools/builtin/web-fetch.test.ts', // vi.mock
  'src/utils.test.ts', // vi.mock,env,global
  'src/utils/fetchWithRetry.test.ts', // vi.mock,global
  'src/worker/strategies/in-process-strategy.test.ts', // env
  'src/workflows/__tests__/declarative-step-entries.test.ts', // env
  'src/workflows/__tests__/lazy-step-writer.test.ts', // vi.mock
  'src/workflows/__tests__/step-output-type-preservation.test.ts', // env
  'src/workflows/create.test.ts', // env
  'src/workflows/evented/restart-completed-boundary.test.ts', // reset-modules
  'src/workflows/fetch-import.test.ts', // global
  'src/workflows/on-start.test.ts', // vi.mock
  'src/workflows/schedule-declaration.test.ts', // env
  'src/workflows/workflow.test.ts', // vi.mock
  'src/workspace/filesystem/local-filesystem-race.test.ts', // vi.mock
  'src/workspace/lsp/manager.test.ts', // vi.mock
  'src/workspace/lsp/servers.test.ts', // env
  'src/workspace/sandbox/local-process-manager.test.ts', // vi.mock,env,reset-modules
  'src/workspace/sandbox/local-sandbox.browser-safety.test.ts', // vi.mock,reset-modules
  'src/workspace/sandbox/local-sandbox.test.ts', // vi.mock,env
  'src/workspace/skills/skill-versioning.test.ts', // global
];
