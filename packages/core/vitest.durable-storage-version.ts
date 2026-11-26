// The durable agent tests run twice: once as written, and once more
// (`unit:packages/core:durable-other-storage-version`) with new DurableAgent runs stored in the
// workflow storage version agents don't use by default. Agents that set `storageVersion` keep it.
// The default is rewritten at load rather than mocked, so tests that reset modules to stand in
// for a restarted process get it too.
//
// The second pass only changes what a DurableAgent does, so a file that never builds one would
// run the same code twice. Those files are listed below and skipped in the second pass.
// vitest.durable-storage-version-setup.ts fails a listed file once it starts building a
// DurableAgent; take the file off the list when that happens.

const defaultStorageVersion = /(this\.#storageVersion = storageVersion \?\? )(1|2);/;

function rewriteDurableAgent(name: string, rewrite: (head: string, version: string) => string) {
  return {
    name,
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.endsWith('/src/agent/durable/durable-agent.ts')) return;
      if (!defaultStorageVersion.test(code)) {
        throw new Error("DurableAgent's default storageVersion is no longer a literal");
      }
      return code.replace(defaultStorageVersion, (_, head: string, version: string) => rewrite(head, version));
    },
  };
}

export const durableTestsWithoutDurableAgent = [
  'src/agent/durable/__tests__/agreement-memory.test.ts',
  'src/agent/durable/__tests__/cache-ttl.test.ts',
  'src/agent/durable/__tests__/deprecated-exports.test.ts',
  'src/agent/durable/__tests__/durable-agent-working-memory.test.ts',
  'src/agent/durable/__tests__/durable-input-processor-agent-context.test.ts',
  'src/agent/durable/__tests__/durable-input-processor-request-context.test.ts',
  'src/agent/durable/__tests__/evented-workflow-agent-step-restart.test.ts',
  'src/agent/durable/__tests__/evented-workflow-agent-suspend-recovery.test.ts',
  'src/agent/durable/__tests__/evented-workflow-sleep-restart.test.ts',
  'src/agent/durable/__tests__/execution-ownership-guard.test.ts',
  'src/agent/durable/__tests__/execution-ownership-wrapper.test.ts',
  'src/agent/durable/__tests__/observe-idle-timeout.test.ts',
  'src/agent/durable/__tests__/resumable-streams.test.ts',
  'src/agent/durable/__tests__/stream-adapter-late-reject.test.ts',
  'src/agent/durable/__tests__/stream-adapter-publish-failure.test.ts',
  'src/agent/durable/__tests__/stream-adapter-suspend-order.test.ts',
  'src/agent/durable/__tests__/stream-adapter-timeout-dedupe.test.ts',
  'src/agent/durable/__tests__/workflow-restart-shapes.test.ts',
  'src/agent/durable/__tests__/wrapper-forwarding.test.ts',
  'src/agent/durable/observe-full-stream.test.ts',
  'src/agent/durable/run-abort.test.ts',
  'src/agent/durable/run-cleanup.test.ts',
  'src/agent/durable/run-registry-activity.test.ts',
  'src/agent/durable/segment-spans.test.ts',
  'src/agent/durable/utils/client-tools-xproc.test.ts',
  'src/agent/durable/utils/resolve-runtime-approval.test.ts',
  'src/agent/durable/utils/resolve-runtime-request-context.test.ts',
  'src/agent/durable/utils/resume-generate-args.test.ts',
  'src/agent/durable/utils/serialize-state.test.ts',
  'src/agent/durable/utils/skill-tools-approval.test.ts',
  'src/agent/durable/utils/toolsets-xproc.test.ts',
  'src/agent/durable/workflows/__tests__/finalize-run.test.ts',
  'src/agent/durable/workflows/create-durable-agentic-workflow.tool-call-concurrency.test.ts',
  'src/agent/durable/workflows/durable-loop-builder.final-outcome.test.ts',
  'src/agent/durable/workflows/shared/accumulated-steps.test.ts',
  'src/agent/durable/workflows/shared/execute-scorers.test.ts',
  'src/agent/durable/workflows/shared/iteration-state.test.ts',
  'src/agent/durable/workflows/shared/message-list-state.test.ts',
  'src/agent/durable/workflows/shared/reported-cost.test.ts',
  'src/agent/durable/workflows/shared/tool-call-concurrency.test.ts',
  'src/agent/durable/workflows/steps/background-task-check.test.ts',
  'src/agent/durable/workflows/steps/is-task-complete-restore.test.ts',
  'src/agent/durable/workflows/steps/llm-mapping-background-race.test.ts',
  'src/agent/durable/workflows/steps/llm-mapping-pending-client-tool.test.ts',
  'src/agent/durable/workflows/steps/scorer-execution.test.ts',
  'src/agent/durable/workflows/steps/tool-approval-recall.test.ts',
  'src/agent/durable/workflows/steps/tool-call-abort-listener.test.ts',
  'src/agent/durable/workflows/steps/tool-call-actor.test.ts',
  'src/agent/durable/workflows/steps/tool-call-approval-context.test.ts',
  'src/agent/durable/workflows/steps/tool-call-bg.test.ts',
  'src/agent/durable/workflows/steps/tool-call-cold-resume.test.ts',
  'src/agent/durable/workflows/steps/tool-call-fga.test.ts',
  'src/agent/durable/workflows/steps/tool-call-keep-alive.test.ts',
  'src/agent/durable/workflows/steps/tool-call-nested-approval.test.ts',
  'src/agent/durable/workflows/steps/tool-call-provider-executed.test.ts',
  'src/agent/durable/workflows/steps/tool-call-provider-fallback.test.ts',
  'src/agent/durable/workflows/steps/tool-call-result-processors.test.ts',
  'src/agent/durable/workflows/steps/tool-call-xproc-workspace.test.ts',
];

export const otherStorageVersion = rewriteDurableAgent(
  'durable-agent-other-storage-version',
  (head, version) => `${head}${version === '1' ? 2 : 1};`,
);

// Counts the DurableAgents built in a worker, for the check described above.
export const countDurableAgents = rewriteDurableAgent(
  'count-durable-agents',
  (head, version) =>
    `${head}${version}; globalThis.__mastraDurableAgentsBuilt = (globalThis.__mastraDurableAgentsBuilt ?? 0) + 1;`,
);
