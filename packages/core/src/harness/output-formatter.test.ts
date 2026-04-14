import { PassThrough } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { describe, it, expect } from 'vitest';
import type { FullOutput } from '../stream/base/output';
import type { ChunkType } from '../stream/types';
import { ChunkFrom } from '../stream/types';
import {
  buildJsonEnvelope,
  buildInterruptedEnvelope,
  formatText,
  formatJson,
  formatStreamJson,
  hasWarnings,
} from './output-formatter';

function createMockFullOutput(overrides: Partial<FullOutput<any>> = {}): FullOutput<any> {
  return {
    text: 'Hello world',
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    steps: [{ text: 'Hello world' } as any],
    finishReason: 'end_turn' as any,
    warnings: [],
    providerMetadata: undefined as any,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { modelId: 'test-model', id: '1', timestamp: new Date(), messages: [], uiMessages: [] } as any,
    totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    object: undefined,
    error: undefined,
    tripwire: undefined,
    traceId: 'trace-123',
    spanId: 'span-456',
    runId: 'run-789',
    suspendPayload: undefined,
    resumeSchema: undefined,
    messages: [],
    rememberedMessages: [],
    ...overrides,
  };
}

describe('buildJsonEnvelope', () => {
  it('should build a success envelope with correct fields', () => {
    const fullOutput = createMockFullOutput();
    const envelope = buildJsonEnvelope(fullOutput, 1234);

    expect(envelope.type).toBe('result');
    expect(envelope.subtype).toBe('success');
    expect(envelope.is_error).toBe(false);
    expect(envelope.result).toBe('Hello world');
    expect(envelope.duration_ms).toBe(1234);
    expect(envelope.num_turns).toBe(1);
    expect(envelope.model_id).toBe('test-model');
    expect(envelope.trace_id).toBe('trace-123');
    expect(envelope.run_id).toBe('run-789');
  });

  it('should build an error envelope when error is present', () => {
    const fullOutput = createMockFullOutput({ error: new Error('test error') });
    const envelope = buildJsonEnvelope(fullOutput, 500);

    expect(envelope.subtype).toBe('error');
    expect(envelope.is_error).toBe(true);
  });

  it('should include usage data from totalUsage', () => {
    const fullOutput = createMockFullOutput({
      totalUsage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      } as any,
    });
    const envelope = buildJsonEnvelope(fullOutput, 1000);

    expect(envelope.usage.input_tokens).toBe(100);
    expect(envelope.usage.output_tokens).toBe(50);
    expect(envelope.usage.total_tokens).toBe(150);
  });

  it('should map tool calls to simplified format', () => {
    const fullOutput = createMockFullOutput({
      toolCalls: [
        {
          type: 'tool-call',
          runId: 'run-1',
          from: 'AGENT' as any,
          payload: {
            toolCallId: 'tc-1',
            toolName: 'search',
            args: { query: 'test' },
            toolCallType: 'function',
          },
        },
      ] as any,
    });
    const envelope = buildJsonEnvelope(fullOutput, 1000);

    expect(envelope.tool_calls).toHaveLength(1);
    expect(envelope.tool_calls[0]).toEqual({
      id: 'tc-1',
      name: 'search',
      args: { query: 'test' },
    });
  });

  it('should map tool results to simplified format', () => {
    const fullOutput = createMockFullOutput({
      toolResults: [
        {
          type: 'tool-result',
          runId: 'run-1',
          from: 'AGENT' as any,
          payload: {
            toolCallId: 'tc-1',
            toolName: 'search',
            result: { data: 'found' },
            isError: false,
            args: { query: 'test' },
            toolCallType: 'function',
          },
        },
      ] as any,
    });
    const envelope = buildJsonEnvelope(fullOutput, 1000);

    expect(envelope.tool_results).toHaveLength(1);
    expect(envelope.tool_results[0]).toEqual({
      id: 'tc-1',
      name: 'search',
      result: { data: 'found' },
      isError: false,
    });
  });

  it('should include structured output in object field', () => {
    const fullOutput = createMockFullOutput({
      object: { colors: ['red', 'green', 'blue'] },
    });
    const envelope = buildJsonEnvelope(fullOutput, 1000);

    expect(envelope.object).toEqual({ colors: ['red', 'green', 'blue'] });
  });

  it('should set object to null when no structured output', () => {
    const fullOutput = createMockFullOutput({ object: undefined });
    const envelope = buildJsonEnvelope(fullOutput, 1000);

    expect(envelope.object).toBeNull();
  });

  it('should include warnings in the envelope', () => {
    const fullOutput = createMockFullOutput({
      warnings: [{ type: 'unsupported-setting', setting: 'temperature' }] as any,
    });
    const envelope = buildJsonEnvelope(fullOutput, 1000);

    expect(envelope.warnings).toHaveLength(1);
  });

  it('should include finish_reason', () => {
    const fullOutput = createMockFullOutput({ finishReason: 'stop' as any });
    const envelope = buildJsonEnvelope(fullOutput, 1000);

    expect(envelope.finish_reason).toBe('stop');
  });
});

describe('buildInterruptedEnvelope', () => {
  it('should build an interrupted envelope', () => {
    const envelope = buildInterruptedEnvelope(2500);

    expect(envelope.type).toBe('result');
    expect(envelope.subtype).toBe('interrupted');
    expect(envelope.is_error).toBe(true);
    expect(envelope.result).toBe('');
    expect(envelope.duration_ms).toBe(2500);
    expect(envelope.num_turns).toBe(0);
    expect(envelope.object).toBeNull();
    expect(envelope.tool_calls).toEqual([]);
    expect(envelope.tool_results).toEqual([]);
  });

  it('should have undefined usage values', () => {
    const envelope = buildInterruptedEnvelope(0);

    expect(envelope.usage.input_tokens).toBeUndefined();
    expect(envelope.usage.output_tokens).toBeUndefined();
    expect(envelope.usage.total_tokens).toBeUndefined();
  });
});

describe('hasWarnings', () => {
  it('should return false when no warnings', () => {
    const fullOutput = createMockFullOutput({ warnings: [] });
    expect(hasWarnings(fullOutput)).toBe(false);
  });

  it('should return true when warnings are present', () => {
    const fullOutput = createMockFullOutput({
      warnings: [{ type: 'test-warning' }] as any,
    });
    expect(hasWarnings(fullOutput)).toBe(true);
  });
});

/**
 * Build a minimal MastraModelOutput-like object with a fullStream that yields the given chunks
 * and a getFullOutput() that resolves to the given full output.
 */
function createMockStreamOutput(chunks: ChunkType<any>[], fullOutput: FullOutput<any>) {
  const fullStream = new ReadableStream<ChunkType<any>>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  return {
    fullStream,
    getFullOutput: async () => fullOutput,
  } as any;
}

/**
 * Collect everything written to a PassThrough into a string.
 */
async function collectStream(stream: PassThrough): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

describe('formatText', () => {
  it('should write text-delta payloads to stdout', async () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdoutPromise = collectStream(stdout);
    const stderrPromise = collectStream(stderr);

    const chunks: ChunkType<any>[] = [
      { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: 'Hello ' } },
      { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: 'world' } },
    ];
    const fullOutput = createMockFullOutput({ text: 'Hello world' });
    const streamOutput = createMockStreamOutput(chunks, fullOutput);

    await formatText(streamOutput, stdout, stderr);
    stdout.end();
    stderr.end();

    const stdoutText = await stdoutPromise;
    const stderrText = await stderrPromise;

    expect(stdoutText).toBe('Hello world\n');
    expect(stderrText).toBe('');
  });

  it('should write error chunks to stderr, not stdout', async () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdoutPromise = collectStream(stdout);
    const stderrPromise = collectStream(stderr);

    const chunks: ChunkType<any>[] = [
      { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: 'partial' } },
      { type: 'error', runId: 'r1', from: ChunkFrom.AGENT, payload: { error: 'boom' } },
    ];
    const fullOutput = createMockFullOutput({ text: 'partial' });
    const streamOutput = createMockStreamOutput(chunks, fullOutput);

    await formatText(streamOutput, stdout, stderr);
    stdout.end();
    stderr.end();

    const stdoutText = await stdoutPromise;
    const stderrText = await stderrPromise;

    expect(stdoutText).toBe('partial\n');
    expect(stderrText).toContain('Error:');
    expect(stderrText).toContain('boom');
  });

  it('should ignore non-text chunks (tool-call, finish, etc.) in stdout', async () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdoutPromise = collectStream(stdout);
    collectStream(stderr); // drain stderr

    const chunks: ChunkType<any>[] = [
      {
        type: 'tool-call',
        runId: 'r1',
        from: ChunkFrom.AGENT,
        payload: { toolCallId: 'tc1', toolName: 'search', args: {}, toolCallType: 'function' },
      } as any,
      { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: 'answer' } },
      { type: 'finish', runId: 'r1', from: ChunkFrom.AGENT, payload: {} } as any,
    ];
    const fullOutput = createMockFullOutput({ text: 'answer' });
    const streamOutput = createMockStreamOutput(chunks, fullOutput);

    await formatText(streamOutput, stdout, stderr);
    stdout.end();
    stderr.end();

    const stdoutText = await stdoutPromise;
    expect(stdoutText).toBe('answer\n');
  });

  it('should return the FullOutput from getFullOutput', async () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    collectStream(stdout);
    collectStream(stderr);

    const fullOutput = createMockFullOutput({ text: 'Hello' });
    const streamOutput = createMockStreamOutput([], fullOutput);

    const result = await formatText(streamOutput, stdout, stderr);
    stdout.end();
    stderr.end();

    expect(result).toBe(fullOutput);
  });
});

describe('formatJson', () => {
  it('should write a single JSON envelope to stdout', async () => {
    const stdout = new PassThrough();
    const stdoutPromise = collectStream(stdout);

    const fullOutput = createMockFullOutput({ text: 'Hello world' });
    const streamOutput = createMockStreamOutput([], fullOutput);

    const startTime = Date.now() - 500;
    await formatJson(streamOutput, stdout, startTime);
    stdout.end();

    const stdoutText = await stdoutPromise;
    const lines = stdoutText.trim().split('\n');
    expect(lines).toHaveLength(1);

    const envelope = JSON.parse(lines[0]!);
    expect(envelope.type).toBe('result');
    expect(envelope.subtype).toBe('success');
    expect(envelope.result).toBe('Hello world');
    expect(envelope.duration_ms).toBeGreaterThanOrEqual(500);
  });

  it('should emit error envelope when FullOutput contains error', async () => {
    const stdout = new PassThrough();
    const stdoutPromise = collectStream(stdout);

    const fullOutput = createMockFullOutput({ error: new Error('failed'), text: '' });
    const streamOutput = createMockStreamOutput([], fullOutput);

    await formatJson(streamOutput, stdout, Date.now());
    stdout.end();

    const envelope = JSON.parse((await stdoutPromise).trim());
    expect(envelope.subtype).toBe('error');
    expect(envelope.is_error).toBe(true);
  });
});

describe('formatStreamJson', () => {
  it('should write each chunk as a JSON line (NDJSON)', async () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdoutPromise = collectStream(stdout);
    collectStream(stderr);

    const chunks: ChunkType<any>[] = [
      { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: 'Hello' } },
      { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: ' world' } },
      { type: 'finish', runId: 'r1', from: ChunkFrom.AGENT, payload: {} } as any,
    ];
    const fullOutput = createMockFullOutput({ text: 'Hello world' });
    const streamOutput = createMockStreamOutput(chunks, fullOutput);

    await formatStreamJson(streamOutput, stdout, stderr);
    stdout.end();
    stderr.end();

    const stdoutText = await stdoutPromise;
    const lines = stdoutText.trim().split('\n');
    expect(lines).toHaveLength(3);

    const parsed = lines.map(line => JSON.parse(line));
    expect(parsed[0].type).toBe('text-delta');
    expect(parsed[0].payload.text).toBe('Hello');
    expect(parsed[1].type).toBe('text-delta');
    expect(parsed[1].payload.text).toBe(' world');
    expect(parsed[2].type).toBe('finish');
  });

  it('should preserve runId and from on each chunk', async () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdoutPromise = collectStream(stdout);
    collectStream(stderr);

    const chunks: ChunkType<any>[] = [
      { type: 'text-delta', runId: 'run-abc', from: ChunkFrom.AGENT, payload: { id: '1', text: 'x' } },
    ];
    const streamOutput = createMockStreamOutput(chunks, createMockFullOutput({ text: 'x' }));

    await formatStreamJson(streamOutput, stdout, stderr);
    stdout.end();
    stderr.end();

    const parsed = JSON.parse((await stdoutPromise).trim());
    expect(parsed.runId).toBe('run-abc');
    expect(parsed.from).toBe('AGENT');
  });

  it('should emit one line per chunk separated by newlines', async () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdoutPromise = collectStream(stdout);
    collectStream(stderr);

    const chunks: ChunkType<any>[] = [
      { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: 'a' } },
      { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: 'b' } },
    ];
    const streamOutput = createMockStreamOutput(chunks, createMockFullOutput({ text: 'ab' }));

    await formatStreamJson(streamOutput, stdout, stderr);
    stdout.end();
    stderr.end();

    const stdoutText = await stdoutPromise;
    // Each line should be a complete JSON object terminated by \n
    expect(stdoutText.endsWith('\n')).toBe(true);
    expect(stdoutText.split('\n').filter(Boolean)).toHaveLength(2);
  });
});
