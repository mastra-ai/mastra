/**
 * Plain Agent (reference engine) test suite using the shared factory
 *
 * Runs the behavioral subset of the conformance suite against the plain
 * in-process Agent — the reference engine whose semantics the durable
 * engines are supposed to reproduce. Wherever a domain observes behavior
 * (callbacks, memory id threading, approval/suspension/resume flows) this
 * leg pins the reference outcome; a durable engine that diverges from it
 * now fails against the same test text instead of a hand-copied mirror.
 *
 * Most factory domains are skipped here: they pin the *durable
 * serialization surface* (`prepare()` → `workflowInput`) rather than
 * observable behavior, or exercise durable-only machinery (pubsub streams,
 * resumable observe, crash recovery). Each skip below documents which.
 */

import { createDurableAgentTestSuite } from './factory';
import type { CreateAgentConfig, DurableAgentLike } from './types';
import { Agent } from '@mastra/core/agent';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';

// Test ID counter for unique agent IDs
let testIdCounter = 0;
function generateTestId(): string {
  return `test-${Date.now()}-${++testIdCounter}`;
}

/**
 * Resolve threadId/resourceId the same way DurableAgent's prepare() does:
 * from the caller-supplied memory options (thread as string or `{ id }`).
 * The plain Agent doesn't echo these back on its output, so the adapter
 * resolves them at the same boundary durable does.
 */
function resolveMemoryIds(options: any): { threadId?: string; resourceId?: string } {
  const thread = options?.memory?.thread;
  const threadId = typeof thread === 'string' ? thread : thread?.id;
  const resource = options?.memory?.resource;
  const resourceId = typeof resource === 'string' ? resource : resource?.id;
  return { threadId, resourceId };
}

/**
 * Drive the lazy plain-Agent stream in the background so the loop makes
 * progress without the test consuming chunks itself (durable engines run
 * regardless of consumption). While draining, translate the loop's native
 * suspension chunks into the `onSuspended` callback shape the durable
 * engines emit (AgentSuspendedEventData) — payload fields map 1:1.
 */
function driveStream(output: any, onSuspended?: (data: any) => void | Promise<void>): void {
  void (async () => {
    try {
      for await (const chunk of output.fullStream) {
        if (!onSuspended) continue;
        if (chunk?.type === 'tool-call-approval') {
          await onSuspended({
            type: 'approval',
            toolCallId: chunk.payload?.toolCallId,
            toolName: chunk.payload?.toolName,
            args: chunk.payload?.args,
            resumeSchema: chunk.payload?.resumeSchema,
          });
        } else if (chunk?.type === 'tool-call-suspended') {
          await onSuspended({
            type: 'suspension',
            toolCallId: chunk.payload?.toolCallId,
            toolName: chunk.payload?.toolName,
            args: chunk.payload?.args,
            suspendPayload: chunk.payload?.suspendPayload,
            resumeSchema: chunk.payload?.resumeSchema,
          });
        }
      }
    } catch {
      // Error-model runs reject during consumption; the loop's own onError
      // callback (forwarded untouched in options) still fires.
    }
  })();
}

function wrapNormalAgent(agent: Agent): DurableAgentLike {
  return {
    id: agent.id,
    name: agent.name,

    stream: async (messages: any, options?: any) => {
      const { onSuspended, ...streamOptions } = options ?? {};
      const output = await agent.stream(messages, streamOptions);
      driveStream(output, onSuspended);
      return {
        output,
        runId: output.runId,
        ...resolveMemoryIds(options),
        cleanup: () => {},
      };
    },

    resume: async (runId: string, resumeData: unknown, options?: any) => {
      const { onSuspended, ...resumeOptions } = options ?? {};
      const base = { ...resumeOptions, runId };

      let output: any;
      const approval =
        resumeData !== null &&
        typeof resumeData === 'object' &&
        'approved' in resumeData &&
        typeof (resumeData as any).approved === 'boolean'
          ? (resumeData as { approved: boolean; reason?: string })
          : undefined;

      if (approval) {
        output = approval.approved
          ? await agent.approveToolCall(base)
          : await agent.declineToolCall(approval.reason ? { ...base, reason: approval.reason } : base);
      } else {
        output = await agent.resumeStream(resumeData, base);
      }

      driveStream(output, onSuspended);
      return { output, runId, cleanup: () => {} };
    },

    // Satisfies the interface; the prepare-pinning domains are skipped on
    // this leg (prepare() is a durable-serialization surface).
    prepare: (messages: any, options?: any) => (agent as any).prepare(messages, options),
  } as unknown as DurableAgentLike;
}

createDurableAgentTestSuite({
  name: 'Agent (reference engine)',

  // Required by the factory lifecycle; the plain Agent doesn't use a bus.
  createPubSub: () => new EventEmitterPubSub(),

  createAgent: async (config: CreateAgentConfig): Promise<DurableAgentLike> => {
    const testId = generateTestId();
    const agentId = config.exactId ? config.id : `${config.id}-${testId}`;

    const agent = new Agent({
      id: agentId,
      name: config.name || config.id,
      instructions: config.instructions,
      model: config.model,
      tools: config.tools,
      ...(config.memory ? { memory: config.memory } : {}),
      ...(config.outputProcessors ? { outputProcessors: config.outputProcessors } : {}),
    });

    // Always register on a Mastra host with storage (mirrors the evented
    // harness) so suspend/resume snapshots persist across approval flows.
    new Mastra({
      logger: false,
      storage: config.storage ?? new MockStore(),
      agents: { [agentId]: agent },
    });

    return wrapNormalAgent(agent);
  },

  skip: {
    // Explicitly enabled: `{}.constructor` is Object's constructor (truthy),
    // so legs that omit this key silently skip the constructor domain.
    // `false` opts this leg in.
    constructor: false,

    // ── Durable-only machinery (no plain-Agent equivalent) ──────────────
    prepare: true, // pins prepare() → workflowInput serialization
    pubsub: true, // pins event-bus topics/chunks
    observe: true, // resumable streams (durable run registry)
    recovery: true, // crash recovery over persisted snapshots
    advancedDurableOnly: true, // runRegistry / lazy init
    modelFallbackRuntime: true, // requires durable run registry

    // ── Prepare/workflowInput-pinned domains ────────────────────────────
    // These assert on the serialized durable execution state rather than
    // (or in addition to) observable behavior. Phase 2 audits them for a
    // behavioral/serialization split so the behavioral half runs here too.
    stream: true,
    tools: true,
    advanced: true,
    images: true,
    reasoning: true,
    requestContext: true,
    stopWhen: true,
    structuredOutput: true,
    toolApproval: true,
    toolConcurrency: true,
    toolSuspension: true,
    uiMessage: true,
    usage: true,
    modelFallback: true,
    workspace: true,
    scorers: true,
    streamId: true,
    dynamicMemory: true,
    memoryReadonly: true,
    memoryRequestContextInheritance: true,
    reasoningMemory: true,
    v3Features: true,
    workingMemoryContext: true,
    inputProcessors: true,
    skillsWithCustomProcessors: true,
    titleGeneration: true,
    saveAndErrors: true,
    memoryMetadata: true,
    processorPipeline: true,
    versionOverrides: true,
    memoryPersistence: true,
    backgroundTasks: true,
  },
});
