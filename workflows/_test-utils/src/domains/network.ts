/**
 * Network-equivalent delegation tests for DurableAgent
 *
 * `Agent.network()` itself is a plain-Agent surface: the network loop is
 * built directly on the default in-process workflow engine
 * (loop/network/index.ts → createWorkflow → default engine), and neither
 * DurableAgent nor EventedAgent exposes a network() method — so the literal
 * network-mode behaviors cannot be exercised cross-engine. What *is*
 * cross-engine is the delegation family those behaviors are built from: a
 * supervisor agent routing work to sub-agents through the agentic loop.
 * These tests pin that family through the DurableAgentLike surface so every
 * leg (DurableAgent, EventedAgent, plain Agent, Inngest) proves the same
 * contract:
 *
 * - a delegation tool-call routes to the named sub-agent (and only it)
 * - the sub-agent's result feeds the supervisor's next model turn
 * - onDelegationStart / onDelegationComplete fire with delegation context
 * - sub-agent memory identity is derived from the caller (issue #23903)
 * - onDelegationStart request-context mutations reach the delegated run
 * - bail() from onDelegationComplete stops the loop in the same iteration
 * - a sub-agent failure surfaces to the supervisor without killing the run
 *
 * Observational-memory × network guards
 * (AGENT_NETWORK_OBSERVATIONAL_MEMORY_UNSUPPORTED etc.) stay in
 * packages/core/src/agent/agent-network.test.ts: they gate the plain-Agent
 * network() entry point, which no other leg has. The durable OM surface
 * (serialized flag, title-generation guard) is pinned by
 * agent/durable/utils/serialize-state.test.ts and
 * agent/durable/workflows/__tests__/finalize-run.test.ts.
 */

import { describe, it, expect, vi } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createToolCallThenTextModel } from '../mock-models';

/** Sub-agent that streams a single text response. */
function makeSubAgent(id: string, text: string): Agent {
  return new Agent({
    id,
    name: id,
    description: `Sub-agent ${id}`,
    instructions: 'You are a helpful sub-agent.',
    model: createTextStreamModel(text) as LanguageModelV2,
  });
}

/**
 * Supervisor model that delegates on EVERY turn. Used to prove bail()
 * actually stops the loop: without bail it would keep delegating until
 * maxSteps, so the post-bail call counts are unambiguous.
 */
function createAlwaysDelegateModel(toolName: string, args: Record<string, unknown>): LanguageModelV2 {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `sup-${calls}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: `delegate-call-${calls}`,
            toolName,
            input: JSON.stringify(args),
            providerExecuted: false,
          },
          {
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

function streamCallCount(model: unknown): number {
  return (model as { doStreamCalls: unknown[] }).doStreamCalls.length;
}

export function createNetworkTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('Network-equivalent delegation', () => {
    it('routes a delegation tool-call to the named sub-agent and not its siblings', async () => {
      const researchModel = createTextStreamModel('Dolphins are marine mammals.');
      const writerModel = createTextStreamModel('A polished report.');
      const research = new Agent({
        id: 'research',
        name: 'research',
        description: 'Researches topics',
        instructions: 'You research.',
        model: researchModel as LanguageModelV2,
      });
      const writer = new Agent({
        id: 'writer',
        name: 'writer',
        description: 'Writes reports',
        instructions: 'You write.',
        model: writerModel as LanguageModelV2,
      });

      const supervisorModel = createToolCallThenTextModel('agent-research', { prompt: 'research dolphins' }, 'Done');

      const agent = await createAgent({
        id: 'network-routing-agent',
        instructions: 'You orchestrate sub-agents.',
        model: supervisorModel,
        agents: { research, writer },
      });

      const { output, cleanup } = await agent.stream('Research dolphins', { maxSteps: 3 });
      let text = '';
      for await (const chunk of output.textStream) {
        text += chunk;
      }
      cleanup();

      expect(text).toContain('Done');
      expect(streamCallCount(researchModel)).toBe(1);
      expect(streamCallCount(writerModel)).toBe(0);
    });

    it("feeds the sub-agent's result into the supervisor's next model turn", async () => {
      const research = makeSubAgent('research', 'MARKER_DOLPHIN_FACT');
      const supervisorModel = createToolCallThenTextModel('agent-research', { prompt: 'research dolphins' }, 'Done');

      const agent = await createAgent({
        id: 'network-result-agent',
        instructions: 'You orchestrate sub-agents.',
        model: supervisorModel,
        agents: { research },
      });

      const { output, cleanup } = await agent.stream('Research dolphins', { maxSteps: 3 });
      for await (const _chunk of output.textStream) {
        void _chunk;
      }
      cleanup();

      // The supervisor's second turn must carry the delegated result back
      // as a tool result in its prompt.
      const calls = (supervisorModel as unknown as { doStreamCalls: unknown[] }).doStreamCalls;
      expect(calls).toHaveLength(2);
      expect(JSON.stringify(calls[1])).toContain('MARKER_DOLPHIN_FACT');
    });

    it('invokes onDelegationStart with the delegation prompt', async () => {
      const onDelegationStart = vi.fn(() => undefined);
      const research = makeSubAgent('research', 'Findings.');

      const agent = await createAgent({
        id: 'network-delegation-start-agent',
        instructions: 'You orchestrate sub-agents.',
        model: createToolCallThenTextModel('agent-research', { prompt: 'research dolphins' }, 'Done'),
        agents: { research },
      });

      const { output, cleanup } = await agent.stream('Research dolphins', {
        maxSteps: 3,
        delegation: { onDelegationStart },
      });
      for await (const _chunk of output.textStream) {
        void _chunk;
      }
      cleanup();

      expect(onDelegationStart).toHaveBeenCalledTimes(1);
      expect(onDelegationStart).toHaveBeenCalledWith(
        expect.objectContaining({
          primitiveType: 'agent',
          prompt: 'research dolphins',
        }),
      );
    });

    it('invokes onDelegationComplete with the sub-agent result', async () => {
      const onDelegationComplete = vi.fn(() => undefined);
      const writerAgent = makeSubAgent('writerAgent', 'Here is the final report.');

      const agent = await createAgent({
        id: 'network-delegation-complete-agent',
        instructions: 'You orchestrate sub-agents.',
        model: createToolCallThenTextModel('agent-writerAgent', { prompt: 'write a report' }, 'Done'),
        agents: { writerAgent },
      });

      const { output, cleanup } = await agent.stream('Write a report', {
        maxSteps: 3,
        delegation: { onDelegationComplete },
      });
      for await (const _chunk of output.textStream) {
        void _chunk;
      }
      cleanup();

      expect(onDelegationComplete).toHaveBeenCalledTimes(1);
      expect(onDelegationComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          primitiveType: 'agent',
          result: expect.objectContaining({ text: 'Here is the final report.' }),
        }),
      );
    });

    it('derives sub-agent memory identity from the caller (issue #23903)', async () => {
      const research = makeSubAgent('research', 'Findings.');
      const streamSpy = vi.spyOn(research, 'stream');

      const agent = await createAgent({
        id: 'network-memory-scope-agent',
        instructions: 'You orchestrate sub-agents.',
        model: createToolCallThenTextModel('agent-research', { prompt: 'research dolphins' }, 'Done'),
        agents: { research },
      });

      const { output, cleanup } = await agent.stream('Research dolphins', {
        maxSteps: 3,
        memory: { thread: 'net-thread-1', resource: 'net-user-1' },
      });
      for await (const _chunk of output.textStream) {
        void _chunk;
      }
      cleanup();

      // The delegation wrapper derives sub-agent identity from the caller:
      // `${callerResourceId}-${agentName}` and a caller-thread-derived thread
      // id. A parent-derived constant would let every caller share one scope.
      expect(streamSpy).toHaveBeenCalledTimes(1);
      const subAgentCallArgs = streamSpy.mock.calls[0] as unknown[];
      const subAgentOptions = subAgentCallArgs?.[1] as
        | { memory?: { thread?: unknown; resource?: unknown } }
        | undefined;
      expect(subAgentOptions?.memory?.resource).toBe('net-user-1-research');
      expect(subAgentOptions?.memory?.thread).toMatch(/^net-thread-1-/);
    });

    it('applies onDelegationStart request-context mutations to the delegated run', async () => {
      let subAgentSawSpecialty: unknown;

      const specialist = new Agent({
        id: 'specialist',
        name: 'specialist',
        description: 'Runtime-configured sub-agent',
        instructions: ({ requestContext }) => {
          subAgentSawSpecialty = requestContext.get('specialty');
          return 'You are a helpful sub-agent.';
        },
        model: createTextStreamModel('Task done.') as LanguageModelV2,
      });

      const agent = await createAgent({
        id: 'network-delegation-context-agent',
        instructions: 'You orchestrate sub-agents.',
        model: createToolCallThenTextModel('agent-specialist', { prompt: 'do specialized work' }, 'Done'),
        agents: { specialist },
      });

      const { output, cleanup } = await agent.stream('Do the work', {
        maxSteps: 3,
        delegation: {
          onDelegationStart: (delegationContext: any) => {
            delegationContext.requestContext.set('specialty', delegationContext.primitiveId);
          },
        },
      });
      for await (const _chunk of output.textStream) {
        void _chunk;
      }
      cleanup();

      expect(subAgentSawSpecialty).toBe('specialist');
    });

    it('bail() from onDelegationComplete stops the loop in the same iteration', async () => {
      const researchModel = createTextStreamModel('Findings.');
      const research = new Agent({
        id: 'research',
        name: 'research',
        description: 'Researches topics',
        instructions: 'You research.',
        model: researchModel as LanguageModelV2,
      });

      // Delegates on every turn: without bail this loop would run to
      // maxSteps, so the call counts below can only pass if bail stopped it.
      const supervisorModel = createAlwaysDelegateModel('agent-research', { prompt: 'keep going' });
      const onDelegationComplete = vi.fn((delegationContext: any) => {
        delegationContext.bail();
      });

      const agent = await createAgent({
        id: 'network-bail-agent',
        instructions: 'You orchestrate sub-agents.',
        model: supervisorModel,
        agents: { research },
      });

      const { output, cleanup } = await agent.stream('Keep delegating', {
        maxSteps: 5,
        delegation: { onDelegationComplete },
      });
      for await (const _chunk of output.textStream) {
        void _chunk;
      }
      cleanup();

      // Same-iteration bail: supervisor turn 1 delegates, the sub-agent runs,
      // bail() fires, and the loop terminates right there. A feedback-less
      // bail grants no reply turn — the supervisor model is never called
      // again (returning { feedback } from the hook would grant one).
      expect(onDelegationComplete).toHaveBeenCalledTimes(1);
      expect(streamCallCount(researchModel)).toBe(1);
      expect(streamCallCount(supervisorModel)).toBe(1);
    });

    it('surfaces a sub-agent failure to the supervisor without killing the run', async () => {
      const failingModel = new MockLanguageModelV2({
        doStream: async () => {
          throw new Error('sub-agent exploded');
        },
      });
      const broken = new Agent({
        id: 'broken',
        name: 'broken',
        description: 'Always fails',
        instructions: 'You fail.',
        model: failingModel as unknown as LanguageModelV2,
      });

      const supervisorModel = createToolCallThenTextModel('agent-broken', { prompt: 'do work' }, 'Recovered');

      const agent = await createAgent({
        id: 'network-subagent-error-agent',
        instructions: 'You orchestrate sub-agents.',
        model: supervisorModel,
        agents: { broken },
      });

      const { output, cleanup } = await agent.stream('Do work', { maxSteps: 3 });
      let text = '';
      for await (const chunk of output.textStream) {
        text += chunk;
      }
      cleanup();

      // The failure becomes an error tool-result; the supervisor gets a
      // second turn and finishes the run instead of the loop dying.
      expect(text).toContain('Recovered');
      expect(streamCallCount(supervisorModel)).toBe(2);
    });
  });
}
