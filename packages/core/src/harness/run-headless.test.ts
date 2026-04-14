import { PassThrough } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { describe, it, expect, vi } from 'vitest';
import type { FullOutput } from '../stream/base/output';
import type { ChunkType } from '../stream/types';
import { ChunkFrom } from '../stream/types';
import { runHeadless } from './run-headless';
import type { RunHeadlessIO, RunHeadlessOptions } from './run-headless';

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

async function collectStream(stream: PassThrough): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

interface Harness {
  stdout: PassThrough;
  stderr: PassThrough;
  stdoutPromise: Promise<string>;
  stderrPromise: Promise<string>;
  exits: number[];
  sigintHandlers: Array<() => void>;
  io: RunHeadlessIO;
}

function createHarness(): Harness {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const exits: number[] = [];
  const sigintHandlers: Array<() => void> = [];

  const io: RunHeadlessIO = {
    stdout,
    stderr,
    exit: (code: number) => {
      exits.push(code);
    },
    onSigint: (h: () => void) => {
      sigintHandlers.push(h);
    },
  };

  return {
    stdout,
    stderr,
    stdoutPromise: collectStream(stdout),
    stderrPromise: collectStream(stderr),
    exits,
    sigintHandlers,
    io,
  };
}

function createMockMastra(agentFn: (id: string) => any, agents: Record<string, unknown> = {}) {
  return {
    getAgent: vi.fn((id: string) => agentFn(id)),
    getAgents: () => agents,
  };
}

const baseOptions: RunHeadlessOptions = {
  prompt: 'Hello',
  agentId: 'testAgent',
  outputFormat: 'text',
  strict: false,
};

describe('runHeadless', () => {
  describe('validation', () => {
    it('should exit with config error on invalid outputFormat', async () => {
      const h = createHarness();
      const mastra = createMockMastra(() => ({ stream: vi.fn() }));

      await runHeadless(mastra, { ...baseOptions, outputFormat: 'yaml' as any }, h.io);
      h.stderr.end();
      h.stdout.end();

      expect(h.exits).toEqual([2]);
      expect(await h.stderrPromise).toContain('Invalid outputFormat');
    });

    it('should exit with config error when agent not found', async () => {
      const h = createHarness();
      const mastra = createMockMastra(
        (_id: string) => {
          throw new Error('not found');
        },
        { agentA: {}, agentB: {} },
      );

      await runHeadless(mastra, { ...baseOptions, agentId: 'missing' }, h.io);
      h.stderr.end();
      h.stdout.end();

      expect(h.exits).toEqual([2]);
      const stderrText = await h.stderrPromise;
      expect(stderrText).toContain('"missing"');
      expect(stderrText).toContain('not found');
      expect(stderrText).toContain('Available agents: agentA, agentB');
    });

    it('should exit with config error on invalid jsonSchema', async () => {
      const h = createHarness();
      const mastra = createMockMastra(() => ({ stream: vi.fn() }));

      await runHeadless(mastra, { ...baseOptions, outputFormat: 'json', jsonSchema: 'not json{' }, h.io);
      h.stderr.end();
      h.stdout.end();

      expect(h.exits).toEqual([2]);
      expect(await h.stderrPromise).toContain('Invalid --json-schema');
    });

    it('should not register sigint handler or call stream when validation fails', async () => {
      const h = createHarness();
      const streamSpy = vi.fn();
      const mastra = createMockMastra(() => ({ stream: streamSpy }));

      await runHeadless(mastra, { ...baseOptions, outputFormat: 'nonsense' as any }, h.io);
      h.stderr.end();
      h.stdout.end();

      expect(streamSpy).not.toHaveBeenCalled();
      expect(h.sigintHandlers).toHaveLength(0);
    });
  });

  describe('text mode', () => {
    it('should stream text deltas to stdout and exit 0', async () => {
      const h = createHarness();
      const chunks: ChunkType<any>[] = [
        { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: 'Hello ' } },
        { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: 'world' } },
      ];
      const streamOutput = createMockStreamOutput(chunks, createMockFullOutput({ text: 'Hello world' }));
      const agent = { stream: vi.fn().mockResolvedValue(streamOutput) };
      const mastra = createMockMastra(() => agent);

      await runHeadless(mastra, { ...baseOptions, outputFormat: 'text' }, h.io);
      h.stdout.end();
      h.stderr.end();

      expect(h.exits).toEqual([0]);
      expect(await h.stdoutPromise).toBe('Hello world\n');
    });

    it('should exit 1 when FullOutput has error', async () => {
      const h = createHarness();
      const streamOutput = createMockStreamOutput([], createMockFullOutput({ error: new Error('boom') }));
      const agent = { stream: vi.fn().mockResolvedValue(streamOutput) };
      const mastra = createMockMastra(() => agent);

      await runHeadless(mastra, { ...baseOptions, outputFormat: 'text' }, h.io);
      h.stdout.end();
      h.stderr.end();

      expect(h.exits).toEqual([1]);
    });

    it('should exit 1 when strict and warnings present', async () => {
      const h = createHarness();
      const streamOutput = createMockStreamOutput(
        [],
        createMockFullOutput({ warnings: [{ type: 'unsupported-setting' }] as any }),
      );
      const agent = { stream: vi.fn().mockResolvedValue(streamOutput) };
      const mastra = createMockMastra(() => agent);

      await runHeadless(mastra, { ...baseOptions, outputFormat: 'text', strict: true }, h.io);
      h.stdout.end();
      h.stderr.end();

      expect(h.exits).toEqual([1]);
      expect(await h.stderrPromise).toContain('Warnings treated as errors');
    });

    it('should exit 0 when strict is false even with warnings', async () => {
      const h = createHarness();
      const streamOutput = createMockStreamOutput([], createMockFullOutput({ warnings: [{ type: 'w' }] as any }));
      const agent = { stream: vi.fn().mockResolvedValue(streamOutput) };
      const mastra = createMockMastra(() => agent);

      await runHeadless(mastra, { ...baseOptions, outputFormat: 'text', strict: false }, h.io);
      h.stdout.end();
      h.stderr.end();

      expect(h.exits).toEqual([0]);
    });
  });

  describe('json mode', () => {
    it('should emit a single JSON envelope and exit 0', async () => {
      const h = createHarness();
      const streamOutput = createMockStreamOutput([], createMockFullOutput({ text: 'answer' }));
      const agent = { stream: vi.fn().mockResolvedValue(streamOutput) };
      const mastra = createMockMastra(() => agent);

      await runHeadless(mastra, { ...baseOptions, outputFormat: 'json' }, h.io);
      h.stdout.end();
      h.stderr.end();

      expect(h.exits).toEqual([0]);
      const stdoutText = await h.stdoutPromise;
      const envelope = JSON.parse(stdoutText.trim());
      expect(envelope.type).toBe('result');
      expect(envelope.subtype).toBe('success');
      expect(envelope.result).toBe('answer');
    });

    it('should emit error envelope and exit 1 when FullOutput has error', async () => {
      const h = createHarness();
      const streamOutput = createMockStreamOutput([], createMockFullOutput({ error: new Error('bad') }));
      const agent = { stream: vi.fn().mockResolvedValue(streamOutput) };
      const mastra = createMockMastra(() => agent);

      await runHeadless(mastra, { ...baseOptions, outputFormat: 'json' }, h.io);
      h.stdout.end();
      h.stderr.end();

      expect(h.exits).toEqual([1]);
      const envelope = JSON.parse((await h.stdoutPromise).trim());
      expect(envelope.subtype).toBe('error');
      expect(envelope.is_error).toBe(true);
    });
  });

  describe('stream-json mode', () => {
    it('should emit one JSON line per chunk and exit 0', async () => {
      const h = createHarness();
      const chunks: ChunkType<any>[] = [
        { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: 'a' } },
        { type: 'text-delta', runId: 'r1', from: ChunkFrom.AGENT, payload: { id: '1', text: 'b' } },
      ];
      const streamOutput = createMockStreamOutput(chunks, createMockFullOutput({ text: 'ab' }));
      const agent = { stream: vi.fn().mockResolvedValue(streamOutput) };
      const mastra = createMockMastra(() => agent);

      await runHeadless(mastra, { ...baseOptions, outputFormat: 'stream-json' }, h.io);
      h.stdout.end();
      h.stderr.end();

      expect(h.exits).toEqual([0]);
      const lines = (await h.stdoutPromise).trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]!).type).toBe('text-delta');
    });
  });

  describe('structured output', () => {
    it('should pass structuredOutput to agent.stream when jsonSchema provided', async () => {
      const h = createHarness();
      const streamOutput = createMockStreamOutput([], createMockFullOutput());
      const streamSpy = vi.fn().mockResolvedValue(streamOutput);
      const mastra = createMockMastra(() => ({ stream: streamSpy }));

      const schema = '{"type":"object","properties":{"color":{"type":"string"}}}';
      await runHeadless(mastra, { ...baseOptions, outputFormat: 'json', jsonSchema: schema }, h.io);
      h.stdout.end();
      h.stderr.end();
      await h.stdoutPromise;

      expect(streamSpy).toHaveBeenCalledTimes(1);
      const callArgs = streamSpy.mock.calls[0];
      expect(callArgs?.[1]?.structuredOutput).toEqual({ schema: JSON.parse(schema) });
    });

    it('should not include structuredOutput when jsonSchema absent', async () => {
      const h = createHarness();
      const streamOutput = createMockStreamOutput([], createMockFullOutput());
      const streamSpy = vi.fn().mockResolvedValue(streamOutput);
      const mastra = createMockMastra(() => ({ stream: streamSpy }));

      await runHeadless(mastra, { ...baseOptions, outputFormat: 'text' }, h.io);
      h.stdout.end();
      h.stderr.end();
      await h.stdoutPromise;

      const callArgs = streamSpy.mock.calls[0];
      expect(callArgs?.[1]?.structuredOutput).toBeUndefined();
    });
  });

  describe('SIGINT handling', () => {
    it('should register a sigint handler in each mode', async () => {
      for (const fmt of ['text', 'json', 'stream-json'] as const) {
        const h = createHarness();
        const streamOutput = createMockStreamOutput([], createMockFullOutput());
        const agent = { stream: vi.fn().mockResolvedValue(streamOutput) };
        const mastra = createMockMastra(() => agent);

        await runHeadless(mastra, { ...baseOptions, outputFormat: fmt }, h.io);
        h.stdout.end();
        h.stderr.end();
        await h.stdoutPromise;

        expect(h.sigintHandlers).toHaveLength(1);
      }
    });

    it('json sigint handler should emit interrupted envelope and exit 1', async () => {
      const h = createHarness();
      // Use a stream that doesn't resolve immediately
      const never = new ReadableStream({ start() {} });
      const streamOutput = { fullStream: never, getFullOutput: () => new Promise(() => {}) } as any;
      const agent = { stream: vi.fn().mockResolvedValue(streamOutput) };
      const mastra = createMockMastra(() => agent);

      // Don't await — kick it off, then fire sigint
      void runHeadless(mastra, { ...baseOptions, outputFormat: 'json' }, h.io);
      await new Promise(r => setImmediate(r));

      expect(h.sigintHandlers).toHaveLength(1);
      h.sigintHandlers[0]!();
      h.stdout.end();
      h.stderr.end();

      expect(h.exits).toEqual([1]);
      const envelope = JSON.parse((await h.stdoutPromise).trim());
      expect(envelope.subtype).toBe('interrupted');
      expect(envelope.is_error).toBe(true);
    });

    it('stream-json sigint handler should emit abort chunk and exit 1', async () => {
      const h = createHarness();
      const never = new ReadableStream({ start() {} });
      const streamOutput = { fullStream: never, getFullOutput: () => new Promise(() => {}) } as any;
      const agent = { stream: vi.fn().mockResolvedValue(streamOutput) };
      const mastra = createMockMastra(() => agent);

      void runHeadless(mastra, { ...baseOptions, outputFormat: 'stream-json' }, h.io);
      await new Promise(r => setImmediate(r));

      h.sigintHandlers[0]!();
      h.stdout.end();
      h.stderr.end();

      expect(h.exits).toEqual([1]);
      const chunk = JSON.parse((await h.stdoutPromise).trim());
      expect(chunk.type).toBe('abort');
      expect(chunk.payload.reason).toBe('interrupted');
    });

    it('text sigint handler should emit newline and exit 1', async () => {
      const h = createHarness();
      const never = new ReadableStream({ start() {} });
      const streamOutput = { fullStream: never, getFullOutput: () => new Promise(() => {}) } as any;
      const agent = { stream: vi.fn().mockResolvedValue(streamOutput) };
      const mastra = createMockMastra(() => agent);

      void runHeadless(mastra, { ...baseOptions, outputFormat: 'text' }, h.io);
      await new Promise(r => setImmediate(r));

      h.sigintHandlers[0]!();
      h.stdout.end();
      h.stderr.end();

      expect(h.exits).toEqual([1]);
      expect(await h.stdoutPromise).toBe('\n');
    });
  });
});
