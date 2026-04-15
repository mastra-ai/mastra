import { PassThrough } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { describe, it, expect } from 'vitest';
import type { FullOutput } from '../stream/base/output';
import type { ChunkType } from '../stream/types';
import { ChunkFrom } from '../stream/types';
import { formatText, formatJson, formatStreamJson, hasWarnings } from './output-formatter';

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
  it('should write the FullOutput as a single JSON line to stdout', async () => {
    const stdout = new PassThrough();
    const stdoutPromise = collectStream(stdout);

    const fullOutput = createMockFullOutput({ text: 'Hello world' });
    const streamOutput = createMockStreamOutput([], fullOutput);

    await formatJson(streamOutput, stdout, 0);
    stdout.end();

    const stdoutText = await stdoutPromise;
    const lines = stdoutText.trim().split('\n');
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]!);
    expect(parsed.text).toBe('Hello world');
    expect(parsed.error).toBeFalsy();
    expect(parsed.steps).toHaveLength(1);
    expect(parsed.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    expect(parsed.finishReason).toBe('end_turn');
  });

  it('should serialize Error instances as plain objects with name/message/stack', async () => {
    const stdout = new PassThrough();
    const stdoutPromise = collectStream(stdout);

    const fullOutput = createMockFullOutput({ error: new Error('boom'), text: '' });
    const streamOutput = createMockStreamOutput([], fullOutput);

    await formatJson(streamOutput, stdout, 0);
    stdout.end();

    const parsed = JSON.parse((await stdoutPromise).trim());
    expect(parsed.error).toBeTruthy();
    expect(parsed.error.message).toBe('boom');
    expect(parsed.error.name).toBe('Error');
    expect(typeof parsed.error.stack).toBe('string');
  });

  it('should include structured output in the `object` field', async () => {
    const stdout = new PassThrough();
    const stdoutPromise = collectStream(stdout);

    const fullOutput = createMockFullOutput({ object: { colors: ['red', 'green'] } });
    const streamOutput = createMockStreamOutput([], fullOutput);

    await formatJson(streamOutput, stdout, 0);
    stdout.end();

    const parsed = JSON.parse((await stdoutPromise).trim());
    expect(parsed.object).toEqual({ colors: ['red', 'green'] });
  });

  it('should return the FullOutput', async () => {
    const stdout = new PassThrough();
    collectStream(stdout);
    const fullOutput = createMockFullOutput({ text: 'x' });
    const streamOutput = createMockStreamOutput([], fullOutput);

    const result = await formatJson(streamOutput, stdout, 0);
    stdout.end();

    expect(result).toBe(fullOutput);
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
