import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';

/**
 * Coverage for `DelegationConfig.hookErrorStrategy`.
 *
 * Delegation lifecycle hooks (`onDelegationStart`, `onDelegationComplete`) run
 * inside a try/catch that, by default, only logs a throwing hook and continues
 * ("fail-open"). `hookErrorStrategy: 'throw'` opts into fail-closed behavior:
 * a throwing `onDelegationStart` aborts the delegation, and a throwing
 * `onDelegationComplete` marks the delegation as failed.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/21624
 */

/** Sub-agent that immediately answers with fixed text, no tool calls. */
function buildSubAgent() {
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'sub-1', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'sub-t' },
        { type: 'text-delta', id: 'sub-t', delta: 'Sub-agent result.' },
        { type: 'text-end', id: 'sub-t' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ] as any),
    }),
  });

  return new Agent({
    id: 'sub-agent',
    name: 'Sub Agent',
    description: 'Answers directly.',
    instructions: 'Answer directly.',
    model,
  });
}

/** Sub-agent whose model call always fails, so the delegation itself fails. */
function buildFailingSubAgent() {
  const model = new MockLanguageModelV2({
    doStream: async () => {
      throw new Error('sub-agent model boom');
    },
  });

  return new Agent({
    id: 'sub-agent',
    name: 'Sub Agent',
    description: 'Always fails.',
    instructions: 'Always fails.',
    model,
  });
}

/**
 * Supervisor whose first turn delegates once to the sub-agent, then reports
 * completion on the following turn once the delegation's tool result is seen.
 */
function buildSupervisor(subAgent: Agent) {
  let step = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      step += 1;
      const chunks =
        step === 1
          ? [
              {
                type: 'tool-call',
                toolCallId: 'sup-tc-1',
                toolName: 'agent-subAgent',
                input: JSON.stringify({ prompt: 'Delegate this.' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 'sup-final-t' },
              { type: 'text-delta', id: 'sup-final-t', delta: 'Sub-agent result acknowledged.' },
              { type: 'text-end', id: 'sup-final-t' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `sup-${step}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });

  return new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    instructions: 'Delegate to the sub agent.',
    model,
    agents: { subAgent },
  });
}

function buildSupervisorAgent(subAgent: Agent, storage: InMemoryStore = new InMemoryStore()) {
  const sup = buildSupervisor(subAgent);
  const mastra = new Mastra({ agents: { supervisor: sup }, logger: false, storage });
  return mastra.getAgent('supervisor');
}

describe('DelegationConfig.hookErrorStrategy', () => {
  describe('default ("warn") — unchanged from pre-existing behavior', () => {
    it('a throwing onDelegationStart is logged and the delegation still proceeds', async () => {
      const subAgent = buildSubAgent();
      const supervisor = buildSupervisorAgent(subAgent);
      const errorSpy = vi.fn();
      // @ts-expect-error - internal test hook into the Mastra logger for assertions
      supervisor.logger.error = errorSpy;

      const stream = await supervisor.stream('Delegate this.', {
        maxSteps: 4,
        delegation: {
          onDelegationStart: () => {
            throw new Error('start hook boom');
          },
        },
      });

      const text = await stream.text;
      expect(text).toContain('Sub-agent result');
      expect(errorSpy).toHaveBeenCalledWith('onDelegationStart hook error', expect.objectContaining({}));
    });

    it('a throwing onDelegationComplete is logged and the delegation result is still returned', async () => {
      const subAgent = buildSubAgent();
      const supervisor = buildSupervisorAgent(subAgent);
      const errorSpy = vi.fn();
      // @ts-expect-error - internal test hook into the Mastra logger for assertions
      supervisor.logger.error = errorSpy;

      const stream = await supervisor.stream('Delegate this.', {
        maxSteps: 4,
        delegation: {
          onDelegationComplete: () => {
            throw new Error('complete hook boom');
          },
        },
      });

      const text = await stream.text;
      expect(text).toContain('Sub-agent result');
      expect(errorSpy).toHaveBeenCalledWith('onDelegationComplete hook error', expect.objectContaining({}));
    });
  });

  describe("'throw' strategy", () => {
    it('a throwing onDelegationStart aborts the delegation instead of proceeding', async () => {
      const subAgent = buildSubAgent();
      const supervisor = buildSupervisorAgent(subAgent);

      const stream = await supervisor.stream('Delegate this.', {
        maxSteps: 4,
        delegation: {
          hookErrorStrategy: 'throw',
          onDelegationStart: () => {
            throw new Error('start hook boom');
          },
        },
      });

      // The delegation aborts before invoking the sub-agent: the tool call
      // surfaces as a tool-error chunk instead of a successful tool-result.
      const toolErrorChunks: any[] = [];
      const toolResultChunks: any[] = [];
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-error') toolErrorChunks.push(chunk);
        if (chunk.type === 'tool-result') toolResultChunks.push(chunk);
      }
      expect(toolErrorChunks.length).toBeGreaterThan(0);
      expect(toolErrorChunks[0].payload.error.message).toMatch(/onDelegationStart hook threw/i);
      // The sub-agent's own tool-result must never appear: the abort happens
      // before the sub-agent is invoked.
      expect(toolResultChunks.some(c => c.payload?.toolName === 'agent-subAgent')).toBe(false);
    });

    it('a throwing onDelegationComplete marks the delegation as failed, propagating the hook error', async () => {
      const subAgent = buildSubAgent();
      const supervisor = buildSupervisorAgent(subAgent);

      const stream = await supervisor.stream('Delegate this.', {
        maxSteps: 4,
        delegation: {
          hookErrorStrategy: 'throw',
          onDelegationComplete: () => {
            throw new Error('complete hook boom');
          },
        },
      });

      const toolErrorChunks: any[] = [];
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-error') toolErrorChunks.push(chunk);
      }
      expect(toolErrorChunks.length).toBeGreaterThan(0);
      // The delegation is marked failed the same way a sub-agent execution
      // failure would propagate: the top-level message is the generic
      // "failed agent tool execution" text, with the hook's own error
      // preserved down the cause chain.
      const error = toolErrorChunks[0].payload.error;
      expect(error.message).toMatch(/Failed agent tool execution/i);
      expect(JSON.stringify(error)).toContain('complete hook boom');
    });

    it('does not invoke onDelegationComplete a second time when it already threw', async () => {
      const subAgent = buildSubAgent();
      const supervisor = buildSupervisorAgent(subAgent);
      const completeSpy = vi.fn(() => {
        throw new Error('complete hook boom');
      });

      const stream = await supervisor.stream('Delegate this.', {
        maxSteps: 4,
        delegation: {
          hookErrorStrategy: 'throw',
          onDelegationComplete: completeSpy,
        },
      });

      for await (const _chunk of stream.fullStream) {
        // Drain the stream so the delegation runs to completion.
      }
      expect(completeSpy).toHaveBeenCalledTimes(1);
    });

    it('when the sub-agent itself fails AND onDelegationComplete throws, the hook error is surfaced instead of silently logged', async () => {
      const failingSubAgent = buildFailingSubAgent();
      const supervisor = buildSupervisorAgent(failingSubAgent);

      const stream = await supervisor.stream('Delegate this.', {
        maxSteps: 4,
        delegation: {
          hookErrorStrategy: 'throw',
          onDelegationComplete: () => {
            throw new Error('complete hook boom on failure path');
          },
        },
      });

      const toolErrorChunks: any[] = [];
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-error') toolErrorChunks.push(chunk);
      }
      expect(toolErrorChunks.length).toBeGreaterThan(0);
      // The hook's own error is preserved in the propagated failure instead
      // of being silently logged and discarded.
      expect(JSON.stringify(toolErrorChunks[0].payload.error)).toContain('complete hook boom on failure path');
    });
  });
});
