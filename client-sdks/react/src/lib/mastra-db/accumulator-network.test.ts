import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { NetworkChunkType } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';
import { accumulateNetworkChunk } from './accumulator';
import type { MastraDBMessageMetadata } from './types';

const RUN_ID = 'run-net-1';

const networkMeta = (): MastraDBMessageMetadata => ({ mode: 'network' });

// -----------------------------------------------------------------------------
// Network chunk fixture builders. NetworkChunkType is a large discriminated
// union; each builder uses a single boundary cast, matching the convention in
// accumulator.test.ts.
// -----------------------------------------------------------------------------

const routingTextDeltaChunk = (text: string): NetworkChunkType =>
  ({
    type: 'routing-agent-text-delta',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { text },
  }) as unknown as NetworkChunkType;

const agentExecutionStartChunk = (primitiveId: string, runId: string): NetworkChunkType =>
  ({
    type: 'agent-execution-start',
    runId,
    from: 'AGENT',
    payload: {
      runId,
      args: { primitiveId, selectionReason: 'best agent for the job', task: 'do the thing' },
    },
  }) as unknown as NetworkChunkType;

const agentExecutionEndChunk = (runId: string, result: string): NetworkChunkType =>
  ({ type: 'agent-execution-end', runId, from: 'AGENT', payload: { runId, result } }) as unknown as NetworkChunkType;

const workflowExecutionStartChunk = (primitiveId: string, runId: string): NetworkChunkType =>
  ({
    type: 'workflow-execution-start',
    runId,
    from: 'WORKFLOW',
    payload: {
      runId,
      args: { primitiveId, selectionReason: 'workflow reason', prompt: '{"foo":"bar"}' },
    },
  }) as unknown as NetworkChunkType;

const toolExecutionStartChunk = (toolName: string, toolCallId: string, runId: string): NetworkChunkType =>
  ({
    type: 'tool-execution-start',
    runId,
    from: 'AGENT',
    payload: { runId, args: { toolName, toolCallId, args: { city: 'sf' }, selectionReason: 'need weather' } },
  }) as unknown as NetworkChunkType;

const toolExecutionEndChunk = (toolCallId: string, runId: string, result: unknown): NetworkChunkType =>
  ({
    type: 'tool-execution-end',
    runId,
    from: 'AGENT',
    payload: { toolCallId, result },
  }) as unknown as NetworkChunkType;

const toolExecutionSuspendedChunk = (toolName: string, toolCallId: string, runId: string): NetworkChunkType =>
  ({
    type: 'tool-execution-suspended',
    runId,
    from: 'AGENT',
    payload: { toolName, toolCallId, args: { a: 1 }, suspendPayload: { reason: 'await input' }, runId },
  }) as unknown as NetworkChunkType;

const toolExecutionApprovalChunk = (toolName: string, toolCallId: string, runId: string): NetworkChunkType =>
  ({
    type: 'tool-execution-approval',
    runId,
    from: 'AGENT',
    payload: { toolName, toolCallId, args: { a: 1 }, runId },
  }) as unknown as NetworkChunkType;

const networkValidationEndChunk = (runId: string, passed: boolean): NetworkChunkType =>
  ({
    type: 'network-validation-end',
    runId,
    from: 'AGENT',
    payload: {
      runId,
      passed,
      results: [],
      duration: 12,
      timedOut: false,
      reason: 'done',
      maxIterationReached: false,
    },
  }) as unknown as NetworkChunkType;

const stepFinishChunk = (runId: string, result: string): NetworkChunkType =>
  ({
    type: 'network-execution-event-step-finish',
    runId,
    from: 'AGENT',
    payload: { runId, result },
  }) as unknown as NetworkChunkType;

// -----------------------------------------------------------------------------
// Test helpers
// -----------------------------------------------------------------------------

const run = (chunks: NetworkChunkType[], initial: MastraDBMessage[] = []): MastraDBMessage[] =>
  chunks.reduce(
    (conversation, chunk) => accumulateNetworkChunk({ chunk, conversation, metadata: networkMeta() }),
    initial,
  );

const seedAssistant = (): MastraDBMessage[] => [
  {
    id: 'seed-assistant',
    role: 'assistant',
    createdAt: new Date(),
    content: { format: 2, parts: [], metadata: { mode: 'network' } },
  },
];

const seedPendingToolAssistant = (
  metadata: MastraDBMessageMetadata,
  toolName: string,
  toolCallId: string,
): MastraDBMessage[] => [
  {
    id: 'seed-pending-tool',
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [
        {
          type: 'dynamic-tool',
          toolName,
          toolCallId,
          state: 'input-available',
          input: { city: 'sf' },
        } as unknown as MastraDBMessage['content']['parts'][number],
      ],
      metadata,
    },
  },
];

const lastMessage = (conversation: MastraDBMessage[]): MastraDBMessage => conversation[conversation.length - 1];

const firstPart = (message: MastraDBMessage): Record<string, unknown> =>
  message.content.parts[0] as unknown as Record<string, unknown>;

const meta = (message: MastraDBMessage): MastraDBMessageMetadata =>
  (message.content.metadata ?? {}) as MastraDBMessageMetadata;

const expectValidNetworkMessage = (message: MastraDBMessage) => {
  expect(message.role).toBe('assistant');
  expect(message.content.format).toBe(2);
  expect(Array.isArray(message.content.parts)).toBe(true);
  expect(meta(message).mode).toBe('network');
};

describe('accumulateNetworkChunk', () => {
  it('parses routing-agent JSON deltas into metadata.routingDecision without a visible text part', () => {
    const decision = '{"isNetwork":true,"agentId":"weather","selectionReason":"User asked about weather"}';
    const chunks = [
      routingTextDeltaChunk(decision.slice(0, 20)),
      routingTextDeltaChunk(decision.slice(20, 50)),
      routingTextDeltaChunk(decision.slice(50)),
    ];
    const result = run(chunks, seedAssistant());
    const message = lastMessage(result);

    expect(message.content.parts).toHaveLength(0);
    const metadata = meta(message);
    expect(metadata.mode).toBe('network');
    expect(metadata.routingDecision).toEqual({
      isNetwork: true,
      agentId: 'weather',
      selectionReason: 'User asked about weather',
    });
    expect(metadata.routingDecisionBuffer).toBeUndefined();
    expect(metadata.routingDecisionText).toBeUndefined();
  });

  it('keeps non-JSON routing-agent text in metadata.routingDecisionText without rendering it', () => {
    const result = run([routingTextDeltaChunk('Routing to weather agent...')], seedAssistant());
    const message = lastMessage(result);

    expect(message.content.parts).toHaveLength(0);
    const metadata = meta(message);
    expect(metadata.routingDecision).toBeUndefined();
    expect(metadata.routingDecisionText).toBe('Routing to weather agent...');
  });

  it('seeds a new assistant message when routing-agent text arrives before any other chunk', () => {
    const decision = '{"isNetwork":true,"agentId":"weather"}';
    const result = run([routingTextDeltaChunk(decision)], []);

    expect(result).toHaveLength(1);
    const message = lastMessage(result);
    expect(message.role).toBe('assistant');
    expect(message.content.parts).toHaveLength(0);
    expect(meta(message).routingDecision).toEqual({ isNetwork: true, agentId: 'weather' });
  });

  it('handles agent-execution-start then agent-execution-end as a dynamic-tool lifecycle', () => {
    const afterStart = run([agentExecutionStartChunk('weather-agent', RUN_ID)]);
    const startMsg = lastMessage(afterStart);
    const startPart = firstPart(startMsg);

    expect(startPart.type).toBe('dynamic-tool');
    expect(startPart.toolName).toBe('weather-agent');
    expect(startPart.state).toBe('input-available');
    expect(meta(startMsg).mode).toBe('network');
    expect(meta(startMsg).from).toBe('AGENT');
    expect(meta(startMsg).selectionReason).toBe('best agent for the job');
    expect(meta(startMsg).agentInput).toBe('do the thing');

    const afterEnd = run([agentExecutionEndChunk(RUN_ID, 'final answer')], afterStart);
    const endPart = firstPart(lastMessage(afterEnd));
    expect(endPart.state).toBe('output-available');
    expect((endPart.output as Record<string, unknown>).result).toBe('final answer');
  });

  it('sets from=WORKFLOW and parses the prompt for workflow-execution-start', () => {
    const result = run([workflowExecutionStartChunk('my-workflow', RUN_ID)]);
    const msg = lastMessage(result);
    const part = firstPart(msg);
    expect(part.type).toBe('dynamic-tool');
    expect(part.toolName).toBe('my-workflow');
    expect(meta(msg).from).toBe('WORKFLOW');
    expect(meta(msg).agentInput).toEqual({ foo: 'bar' });
  });

  it('handles tool-execution-start and tool-execution-end lifecycle', () => {
    const afterStart = run([toolExecutionStartChunk('getWeather', 'tc-1', RUN_ID)]);
    const startPart = firstPart(lastMessage(afterStart));
    expect(startPart.type).toBe('dynamic-tool');
    expect(startPart.toolName).toBe('getWeather');
    expect(startPart.state).toBe('input-available');
    expect(startPart.input).toEqual({ city: 'sf' });

    const afterEnd = run([toolExecutionEndChunk('tc-1', RUN_ID, '72F')], afterStart);
    const endPart = firstPart(lastMessage(afterEnd));
    expect(endPart.state).toBe('output-available');
    expect(endPart.output).toBe('72F');
  });

  it('writes suspendedTools metadata on tool-execution-suspended', () => {
    const result = run([toolExecutionSuspendedChunk('askHuman', 'tc-2', RUN_ID)], seedAssistant());
    const suspended = meta(lastMessage(result)).suspendedTools;
    expect(suspended?.askHuman?.toolCallId).toBe('tc-2');
    expect(suspended?.askHuman?.toolName).toBe('askHuman');
  });

  it('writes requireApprovalMetadata on tool-execution-approval', () => {
    const result = run([toolExecutionApprovalChunk('sendEmail', 'tc-3', RUN_ID)], seedAssistant());
    const approval = meta(lastMessage(result)).requireApprovalMetadata;
    expect(approval?.sendEmail?.toolCallId).toBe('tc-3');
    expect(approval?.sendEmail?.toolName).toBe('sendEmail');
  });

  it('accumulates an approval continuation after requireApprovalMetadata', () => {
    const result = run(
      [toolExecutionEndChunk('tc-approval', RUN_ID, 'approved result')],
      seedPendingToolAssistant(
        {
          mode: 'network',
          requireApprovalMetadata: {
            sendEmail: { toolCallId: 'tc-approval', toolName: 'sendEmail', args: { city: 'sf' }, runId: RUN_ID },
          },
        },
        'sendEmail',
        'tc-approval',
      ),
    );

    const msg = lastMessage(result);
    const part = firstPart(msg);
    expectValidNetworkMessage(msg);
    expect(part.type).toBe('dynamic-tool');
    expect(part.toolName).toBe('sendEmail');
    expect(part.state).toBe('output-available');
    expect(part.output).toBe('approved result');
    expect(meta(msg).requireApprovalMetadata?.sendEmail?.toolCallId).toBe('tc-approval');
  });

  it('accumulates a declined continuation after suspendedTools metadata', () => {
    const result = run(
      [toolExecutionEndChunk('tc-suspended', RUN_ID, { declined: true })],
      seedPendingToolAssistant(
        {
          mode: 'network',
          suspendedTools: {
            askHuman: {
              toolCallId: 'tc-suspended',
              toolName: 'askHuman',
              args: { city: 'sf' },
              suspendPayload: { reason: 'await input' },
              runId: RUN_ID,
            },
          },
        },
        'askHuman',
        'tc-suspended',
      ),
    );

    const msg = lastMessage(result);
    const part = firstPart(msg);
    expectValidNetworkMessage(msg);
    expect(part.type).toBe('dynamic-tool');
    expect(part.toolName).toBe('askHuman');
    expect(part.state).toBe('output-available');
    expect(part.output).toEqual({ declined: true });
    expect(meta(msg).suspendedTools?.askHuman?.toolCallId).toBe('tc-suspended');
  });

  it('pushes completion-feedback text with completionResult on network-validation-end', () => {
    const result = run([networkValidationEndChunk(RUN_ID, true)]);
    const msg = lastMessage(result);
    const part = firstPart(msg);
    expect(part.type).toBe('text');
    expect(typeof part.text).toBe('string');
    expect((part.text as string).length).toBeGreaterThan(0);
    expect(meta(msg).completionResult?.passed).toBe(true);
  });

  it('finalizes the trailing text part on network-execution-event-step-finish', () => {
    const afterDelta = run([routingTextDeltaChunk('partial answer')], seedAssistant());
    const result = run([stepFinishChunk(RUN_ID, 'partial answer')], afterDelta);
    const part = firstPart(lastMessage(result));
    expect(part.type).toBe('text');
    expect(part.state).toBe('done');
  });

  it('pushes a final text part on step-finish when none exists yet', () => {
    const result = run([stepFinishChunk(RUN_ID, 'the result')], seedAssistant());
    const part = firstPart(lastMessage(result));
    expect(part.type).toBe('text');
    expect(part.text).toBe('the result');
    expect(part.state).toBe('done');
  });
});
