import { describe, expect, it } from 'vitest';

import type { AgentDataPart, AgentStepDataPart } from '../transformers';
import { transformAgent } from '../transformers';

/**
 * Regression for issue #23022.
 *
 * `transformAgent` converts a delegated sub-agent's stream into `data-tool-agent`
 * parts. It had no `case 'tool-error'`, so the chunk fell through to
 * `default: break`, `hasChanged` stayed false and the function returned `null`:
 * a sub-agent whose tool threw produced a part stream indistinguishable from one
 * where the same tool succeeded. Hosts could not tell a failed delegated step
 * apart from a successful one.
 *
 * The top-level (non-nested) agent already reported tool failures via
 * `tool-output-error`; the gap was specific to chunks routed through
 * `transformAgent`.
 */
describe('transformAgent tool-error (issue #23022)', () => {
  function makePayload(type: string, runId: string, payload: any) {
    return { type, runId, payload } as any;
  }

  function flattenAgentParts(result: any) {
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
  }

  function agentPart(result: any): AgentDataPart {
    return flattenAgentParts(result).find((part: any) => part.type === 'data-tool-agent');
  }

  function stepPart(result: any): AgentStepDataPart {
    return flattenAgentParts(result).find((part: any) => part.type === 'data-tool-agent-step');
  }

  /**
   * Core tags sub-agent chunks with `from: ChunkFrom.AGENT`. Inlined as the enum's
   * literal value so this unit test stays hermetic (`transformAgent` never reads
   * `from`), rather than pulling in `@mastra/core`'s built output.
   */
  function toolErrorChunk(runId: string, payload: any) {
    return { type: 'tool-error', runId, from: 'AGENT', payload } as any;
  }

  function startRun(bufferedSteps: Map<string, any>, runId: string) {
    transformAgent(makePayload('start', runId, { id: 'sub-agent-1' }), bufferedSteps);
  }

  it('makes a failed delegated tool call distinguishable from a successful one', () => {
    const okSteps = new Map<string, any>();
    startRun(okSteps, 'ok-run');
    transformAgent(
      makePayload('tool-call', 'ok-run', { toolCallId: 'call-1', toolName: 'getWeather', dynamic: false }),
      okSteps,
    );
    const ok = agentPart(
      transformAgent(
        makePayload('tool-result', 'ok-run', {
          toolCallId: 'call-1',
          toolName: 'getWeather',
          result: { temperature: 21 },
        }),
        okSteps,
      ),
    );

    const failedSteps = new Map<string, any>();
    startRun(failedSteps, 'failed-run');
    transformAgent(
      makePayload('tool-call', 'failed-run', { toolCallId: 'call-1', toolName: 'getWeather', dynamic: false }),
      failedSteps,
    );
    const failed = agentPart(
      transformAgent(
        toolErrorChunk('failed-run', {
          toolCallId: 'call-1',
          toolName: 'getWeather',
          error: new Error('weather API 500'),
        }),
        failedSteps,
      ),
    );

    expect(ok.data.toolErrors).toEqual([]);
    expect(failed.data.toolErrors).toEqual([expect.objectContaining({ toolCallId: 'call-1', toolName: 'getWeather' })]);
    expect(failed.data.toolErrors).not.toEqual(ok.data.toolErrors);
  });

  it('normalizes a live Error into a JSON-safe errorText', () => {
    const bufferedSteps = new Map<string, any>();
    startRun(bufferedSteps, 'run-1');

    const part = agentPart(
      transformAgent(
        toolErrorChunk('run-1', {
          toolCallId: 'call-1',
          toolName: 'getWeather',
          args: { city: 'Paris' },
          error: new Error('weather API 500'),
          providerExecuted: false,
        }),
        bufferedSteps,
      ),
    );

    expect(part.data.toolErrors).toEqual([
      {
        toolCallId: 'call-1',
        toolName: 'getWeather',
        args: { city: 'Paris' },
        errorText: 'Error: weather API 500',
        providerExecuted: false,
      },
    ]);

    // `JSON.stringify(new Error(...))` is `"{}"`, so a raw Error would reach a host
    // over SSE with no usable content. The snapshot must survive the wire.
    const wire = JSON.parse(JSON.stringify(part));
    expect(wire.data.toolErrors[0].errorText).toBe('Error: weather API 500');
  });

  it('preserves the durable path error shape ({ name, message, stack })', () => {
    const bufferedSteps = new Map<string, any>();
    startRun(bufferedSteps, 'run-2');

    const part = agentPart(
      transformAgent(
        toolErrorChunk('run-2', {
          toolCallId: 'call-1',
          toolName: 'nope',
          // packages/core/src/agent/durable/utils/serialize-state.ts `serializeError`
          error: { name: 'ToolNotFoundError', message: 'Tool "nope" not found.', stack: 'ToolNotFoundError: x' },
        }),
        bufferedSteps,
      ),
    );

    const errorText = part.data.toolErrors![0].errorText;
    expect(() => JSON.parse(errorText)).not.toThrow();
    const parsed = JSON.parse(errorText);
    expect(parsed.name).toBe('ToolNotFoundError');
    expect(parsed.message).toBe('Tool "nope" not found.');
    expect(parsed.stack).toBe('ToolNotFoundError: x');
  });

  it('redacts error fields that could leak the system prompt', () => {
    const bufferedSteps = new Map<string, any>();
    startRun(bufferedSteps, 'run-3');

    const part = agentPart(
      transformAgent(
        toolErrorChunk('run-3', {
          toolCallId: 'call-1',
          toolName: 'llmTool',
          error: {
            message: 'invalid provider response',
            prompt: 'You are a secret system prompt',
            data: { apiKey: 'sk-leaked' },
          },
        }),
        bufferedSteps,
      ),
    );

    const parsed = JSON.parse(part.data.toolErrors![0].errorText);
    expect(parsed.message).toBe('invalid provider response');
    expect(parsed).not.toHaveProperty('prompt');
    expect(parsed).not.toHaveProperty('data');
  });

  it('omits args and providerExecuted when the payload does not carry them', () => {
    const bufferedSteps = new Map<string, any>();
    startRun(bufferedSteps, 'run-4');

    const part = agentPart(
      transformAgent(
        toolErrorChunk('run-4', { toolCallId: 'call-1', toolName: 't', error: new Error('boom') }),
        bufferedSteps,
      ),
    );

    const entry = part.data.toolErrors![0];
    expect(entry).not.toHaveProperty('args');
    expect(entry).not.toHaveProperty('providerExecuted');
    expect(entry.errorText).toBe('Error: boom');
  });

  it('clears the pending tool call that failed', () => {
    const bufferedSteps = new Map<string, any>();
    startRun(bufferedSteps, 'run-5');
    transformAgent(
      makePayload('tool-call-input-streaming-start', 'run-5', { toolCallId: 'call-1', toolName: 'getWeather' }),
      bufferedSteps,
    );

    const pending = agentPart(
      transformAgent(
        makePayload('tool-call-delta', 'run-5', { toolCallId: 'call-1', argsTextDelta: '{}' }),
        bufferedSteps,
      ),
    );
    expect(pending.data.pendingToolCalls).toHaveLength(1);

    const afterError = agentPart(
      transformAgent(
        toolErrorChunk('run-5', { toolCallId: 'call-1', toolName: 'getWeather', error: new Error('boom') }),
        bufferedSteps,
      ),
    );
    expect(afterError.data.pendingToolCalls).toEqual([]);
    expect(afterError.data.toolErrors).toHaveLength(1);
  });

  it('does not conflate a tool failure with a model-level failure', () => {
    const bufferedSteps = new Map<string, any>();
    startRun(bufferedSteps, 'run-6');

    const part = agentPart(
      transformAgent(
        toolErrorChunk('run-6', { toolCallId: 'call-1', toolName: 't', error: new Error('boom') }),
        bufferedSteps,
      ),
    );

    // The sub-agent recovered and kept running; only the tool failed.
    expect((part.data as any).status).toBe('running');
    expect(part.data.finishReason).toBeNull();
    // A thrown tool is not a tool result.
    expect(part.data.toolResults).toEqual([]);
  });

  it('accumulates every failure within a step', () => {
    const bufferedSteps = new Map<string, any>();
    startRun(bufferedSteps, 'run-7');

    transformAgent(
      toolErrorChunk('run-7', { toolCallId: 'call-1', toolName: 'a', error: new Error('first') }),
      bufferedSteps,
    );
    const part = agentPart(
      transformAgent(
        toolErrorChunk('run-7', { toolCallId: 'call-2', toolName: 'b', error: new Error('second') }),
        bufferedSteps,
      ),
    );

    expect(part.data.toolErrors).toHaveLength(2);
    expect(part.data.toolErrors!.map(entry => entry.toolCallId)).toEqual(['call-1', 'call-2']);
  });

  it('carries toolErrors on the completed step part and resets the run snapshot', () => {
    const bufferedSteps = new Map<string, any>();
    startRun(bufferedSteps, 'run-8');
    transformAgent(
      toolErrorChunk('run-8', { toolCallId: 'call-1', toolName: 'getWeather', error: new Error('boom') }),
      bufferedSteps,
    );

    const result = transformAgent(
      makePayload('step-finish', 'run-8', {
        id: 'step-0',
        stepResult: { reason: 'tool-calls', warnings: [] },
        output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        metadata: { timestamp: new Date(), modelId: 'test-model' },
      }),
      bufferedSteps,
    );

    const completed = stepPart(result);
    expect(completed).toBeDefined();
    expect(completed.data.step.toolErrors).toHaveLength(1);
    expect(completed.data.step.toolErrors![0].errorText).toBe('Error: boom');

    // Mirrors toolResults: the run-level snapshot restarts each step.
    expect(agentPart(result).data.toolErrors).toEqual([]);
  });

  it('exposes the failure on the terminal snapshot via steps[]', () => {
    const bufferedSteps = new Map<string, any>();
    startRun(bufferedSteps, 'run-9');
    transformAgent(
      toolErrorChunk('run-9', { toolCallId: 'call-1', toolName: 'getWeather', error: new Error('boom') }),
      bufferedSteps,
    );
    transformAgent(
      makePayload('step-finish', 'run-9', {
        id: 'step-0',
        stepResult: { reason: 'tool-calls', warnings: [] },
        output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        metadata: { timestamp: new Date(), modelId: 'test-model' },
      }),
      bufferedSteps,
    );

    const terminal = agentPart(
      transformAgent(
        makePayload('finish', 'run-9', {
          stepResult: { reason: 'stop', warnings: [] },
          output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          finishReason: 'stop',
        }),
        bufferedSteps,
      ),
    );

    expect(terminal.data.steps).toHaveLength(1);
    expect((terminal.data.steps[0] as any).toolErrors).toEqual([
      expect.objectContaining({ toolCallId: 'call-1', toolName: 'getWeather', errorText: 'Error: boom' }),
    ]);
  });
});
