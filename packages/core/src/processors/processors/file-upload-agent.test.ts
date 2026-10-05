import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import * as fs from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable/create-durable-agent';
import { MessageList } from '../../agent/message-list';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { LocalFilesystem } from '../../workspace/filesystem';
import { LocalSandbox } from '../../workspace/sandbox/local-sandbox';
import type { SandboxFileInput, WorkspaceSandbox } from '../../workspace/sandbox/sandbox';
import { Workspace } from '../../workspace/workspace';
import type { WorkspaceSandboxResolver } from '../../workspace/workspace';

import { FILE_UPLOAD_ERROR_CODES, FileUploadProcessor } from './file-upload';
import type { FileUploadFileInfo, FileUploadProcessorOptions } from './file-upload';

const MEMORY = { thread: 'file-upload-thread', resource: 'file-upload-resource' };
const UUID = '[0-9a-f-]{36}';
const uploadedPath = (extension: string) => new RegExp(`uploads/${MEMORY.thread}/${UUID}${extension}`);

/** `holdFirstStream` keeps the first response open, so a signal can be sent while the run is active. */
function createModel(holdFirstStream?: Promise<void>) {
  const prompts: LanguageModelV2Prompt[] = [];
  const model = new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        content: [{ type: 'text', text: 'ok' }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const isFirst = prompts.length === 1;
      return {
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'response-1',
              modelId: 'mock',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'ok' });
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            if (isFirst) await holdFirstStream;
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
      };
    },
  });
  return { model, prompts };
}

/** Sandbox double with the `writeFiles` fast path; records every write and command. */
function createFakeSandbox(overrides: Partial<Pick<WorkspaceSandbox, 'writeFiles' | 'executeCommand'>> = {}) {
  const writes: SandboxFileInput[][] = [];
  const commands: string[] = [];
  const events: string[] = [];
  const sandbox = {
    id: 'fake-sandbox',
    name: 'Fake Sandbox',
    provider: 'fake',
    status: 'running',
    snapshot: async () => {},
    writeFiles: async (files: SandboxFileInput[]) => {
      writes.push(files);
      events.push('writeFiles');
    },
    executeCommand: async (_command: string, args: string[] = []) => {
      commands.push(args.at(-1) ?? '');
      events.push('executeCommand');
      return { success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 0 };
    },
    ...overrides,
  } as unknown as WorkspaceSandbox;
  return { sandbox, writes, commands, events };
}

function createHarness(
  sandbox: WorkspaceSandbox | WorkspaceSandboxResolver,
  options: Omit<FileUploadProcessorOptions, 'workspace'> = {},
  {
    withMemory = true,
    dynamicProcessors = false,
    holdFirstStream,
  }: { withMemory?: boolean; dynamicProcessors?: boolean; holdFirstStream?: Promise<void> } = {},
) {
  const { model, prompts } = createModel(holdFirstStream);
  const memory = new MockMemory();
  const workspace = new Workspace({ sandbox });
  const agent = new Agent({
    id: 'file-upload-agent',
    name: 'file-upload-agent',
    instructions: 'Answer briefly.',
    model,
    ...(withMemory ? { memory } : {}),
    workspace,
    inputProcessors: dynamicProcessors
      ? () => [new FileUploadProcessor({ workspace, ...options })]
      : [new FileUploadProcessor({ workspace, ...options })],
  });
  const recall = async () => (await memory.recall({ threadId: MEMORY.thread, resourceId: MEMORY.resource })).messages;
  return { agent, prompts, recall, memory };
}

const text = (value: string) => ({ type: 'text' as const, text: value });
const file = (data: Buffer | string | URL, filename: string | undefined, mediaType: string) => ({
  type: 'file' as const,
  data,
  mediaType,
  ...(filename ? { filename } : {}),
});
const userMessage = (...content: Array<ReturnType<typeof text> | ReturnType<typeof file>>) => ({
  role: 'user' as const,
  content,
});

const userPartsIn = (prompt: LanguageModelV2Prompt | undefined) =>
  (prompt ?? []).flatMap(message => (message.role === 'user' ? message.content : []));
const filePartsIn = (prompt: LanguageModelV2Prompt | undefined) =>
  userPartsIn(prompt).filter(part => part.type === 'file');
const textsIn = (prompt: LanguageModelV2Prompt | undefined) =>
  userPartsIn(prompt).flatMap(part => (part.type === 'text' ? [part.text] : []));

describe('FILE_UPLOAD_ERROR_CODES', () => {
  it('lists every reason the processor can stop a turn', () => {
    expect(FILE_UPLOAD_ERROR_CODES).toEqual({
      MEMORY_REQUIRED: 'MEMORY_REQUIRED',
      NO_SANDBOX: 'NO_SANDBOX',
      NO_WRITE_CAPABILITY: 'NO_WRITE_CAPABILITY',
      INVALID_MAX_FILE_SIZE: 'INVALID_MAX_FILE_SIZE',
      INVALID_FILTER: 'INVALID_FILTER',
      UNSUPPORTED_FILE_SOURCE: 'UNSUPPORTED_FILE_SOURCE',
      INVALID_FILE_DATA: 'INVALID_FILE_DATA',
      FILE_TOO_LARGE: 'FILE_TOO_LARGE',
      UPLOAD_FAILED: 'UPLOAD_FAILED',
      FILE_NOT_UPLOADED: 'FILE_NOT_UPLOADED',
    });
  });
});

describe.skipIf(process.platform === 'win32')('FileUploadProcessor through an agent (LocalSandbox)', () => {
  let tempDir: string;
  const readUploaded = (relativePath: string) => fs.readFile(path.join(tempDir, relativePath));

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-upload-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createLocalHarness = (harnessOptions: Parameters<typeof createHarness>[2] = {}) =>
    createHarness(new LocalSandbox({ workingDirectory: tempDir }), {}, harnessOptions);

  it('uploads a file sent to generate() and gives the model its sandbox path instead of the bytes', async () => {
    const { agent, prompts } = createLocalHarness();
    const bytes = Buffer.from('hello from the user');

    await agent.generate([userMessage(text('Read this file'), file(bytes, 'notes.txt', 'text/plain'))], {
      memory: MEMORY,
    });

    const prompt = prompts.at(-1);
    expect(filePartsIn(prompt)).toEqual([]);
    const uploaded = JSON.stringify(prompt).match(uploadedPath('\\.txt'))?.[0];
    expect(uploaded).toBeDefined();
    expect(await readUploaded(uploaded!)).toEqual(bytes);
  });

  it('uploads a file sent to stream()', async () => {
    const { agent, prompts } = createLocalHarness();
    const bytes = Buffer.from('streamed content');

    const result = await agent.stream([userMessage(text('Read this file'), file(bytes, 'notes.txt', 'text/plain'))], {
      memory: MEMORY,
    });
    await result.consumeStream();

    const prompt = prompts.at(-1);
    expect(filePartsIn(prompt)).toEqual([]);
    const uploaded = JSON.stringify(prompt).match(uploadedPath('\\.txt'))?.[0];
    expect(await readUploaded(uploaded!)).toEqual(bytes);
  });
  it('uploads a binary file larger than one shell chunk without altering a byte', async () => {
    const { agent, prompts } = createLocalHarness();
    const bytes = randomBytes(250_000);

    await agent.generate([userMessage(text('Unpack'), file(bytes, 'archive.bin', 'application/octet-stream'))], {
      memory: MEMORY,
    });

    const uploaded = JSON.stringify(prompts.at(-1)).match(uploadedPath('\\.bin'))![0];
    expect((await readUploaded(uploaded)).equals(bytes)).toBe(true);
    expect(await fs.readdir(path.join(tempDir, 'uploads', MEMORY.thread))).toEqual([path.basename(uploaded)]);
  });
  it('keeps a file with a hostile name inside the uploads directory', async () => {
    const { agent, prompts } = createLocalHarness();
    const bytes = Buffer.from('root:x:0:0');

    await agent.generate([userMessage(file(bytes, '../../etc/passwd; rm -rf ~', 'text/plain'))], { memory: MEMORY });

    const uploaded = JSON.stringify(prompts.at(-1)).match(uploadedPath(''))![0];
    expect(await readUploaded(uploaded)).toEqual(bytes);
    expect(await fs.readdir(tempDir)).toEqual(['uploads']);
    expect(await fs.readdir(path.join(tempDir, 'uploads'))).toEqual([MEMORY.thread]);
    expect(await fs.readdir(path.join(tempDir, 'uploads', MEMORY.thread))).toEqual([path.basename(uploaded)]);
  });
  it('keeps the uploads of a thread with a hostile id inside the uploads directory', async () => {
    const { agent } = createLocalHarness();

    await agent.generate([userMessage(file(Buffer.from('contained'), 'notes.txt', 'text/plain'))], {
      memory: { thread: '../../outside; rm -rf ~', resource: MEMORY.resource },
    });

    expect(await fs.readdir(tempDir)).toEqual(['uploads']);
    expect(await fs.readdir(path.join(tempDir, 'uploads'))).toEqual(['outside_rm_-rf']);
  });
  describe('files sent by a signal', () => {
    const SIGNAL_TARGET = { resourceId: MEMORY.resource, threadId: MEMORY.thread };

    beforeEach(() => {
      agentThreadStreamRuntime.resetForTests();
    });

    async function waitForActiveRun(subscription: { activeRunId: () => string | null }) {
      const deadline = Date.now() + 2000;
      while (!subscription.activeRunId()) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for the active run');
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    it('uploads a file from a signal that wakes an idle agent', async () => {
      const { agent, prompts } = createLocalHarness();
      const bytes = Buffer.from('sent by a signal');

      const result = await agent.sendMessage(
        { contents: [text('Check this'), file(bytes, 'signal.txt', 'text/plain')] },
        { ...SIGNAL_TARGET, ifIdle: { streamOptions: { memory: MEMORY } } },
      );
      const accepted = await result.accepted;
      if (accepted.action !== 'wake') throw new Error(`Expected the signal to wake the agent, got ${accepted.action}`);
      await accepted.output.consumeStream();

      const prompt = prompts.at(-1);
      expect(filePartsIn(prompt)).toEqual([]);
      const uploaded = JSON.stringify(prompt).match(uploadedPath('\\.txt'))![0];
      expect(await readUploaded(uploaded)).toEqual(bytes);
    });

    it.each([
      ['a static processor list', false],
      ['processors resolved per request', true],
    ])('uploads a file from a signal delivered to an active run (%s)', async (_label, dynamicProcessors) => {
      let release!: () => void;
      const holdFirstStream = new Promise<void>(resolve => (release = resolve));
      const { agent, prompts } = createLocalHarness({ dynamicProcessors, holdFirstStream });
      const bytes = Buffer.from('sent while the agent was busy');
      const subscription = await agent.subscribeToThread(SIGNAL_TARGET);

      const stream = await agent.stream('Hello', { memory: MEMORY });
      await waitForActiveRun(subscription);
      const result = agent.sendMessage(
        { contents: [text('And this file'), file(bytes, 'late.txt', 'text/plain')] },
        SIGNAL_TARGET,
      );
      await expect(result.accepted).resolves.toMatchObject({ action: 'deliver' });
      release();
      await stream.consumeStream();
      subscription.unsubscribe();

      expect(prompts).toHaveLength(2);
      expect(filePartsIn(prompts[1])).toEqual([]);
      const uploaded = JSON.stringify(prompts[1]).match(uploadedPath('\\.txt'))![0];
      expect(await readUploaded(uploaded)).toEqual(bytes);
    });

    it('aborts the run and keeps the thread usable when a file from a signal is too large', async () => {
      let release!: () => void;
      const holdFirstStream = new Promise<void>(resolve => (release = resolve));
      const { agent, prompts, recall } = createHarness(
        new LocalSandbox({ workingDirectory: tempDir }),
        { maxFileSize: () => 4 },
        { holdFirstStream },
      );
      const big = Buffer.from('far too large for the limit');
      const subscription = await agent.subscribeToThread(SIGNAL_TARGET);

      const stream = await agent.stream('Hello', { memory: MEMORY });
      await waitForActiveRun(subscription);
      const result = agent.sendMessage({ contents: [file(big, 'big.txt', 'text/plain')] }, SIGNAL_TARGET);
      await expect(result.accepted).resolves.toMatchObject({ action: 'deliver' });
      release();
      const output = await stream.getFullOutput();
      subscription.unsubscribe();
      const next = await agent.generate('Never mind', { memory: MEMORY });

      expect(output.tripwire?.metadata).toMatchObject({
        code: FILE_UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
        fileName: 'big.txt',
      });
      expect(next.tripwire).toBeUndefined();
      expect(prompts).toHaveLength(2);
      expect(filePartsIn(prompts[1])).toEqual([]);
      expect(JSON.stringify(await recall())).not.toContain(big.toString('base64'));
    });
  });
});

describe('FileUploadProcessor through an agent (fake sandbox)', () => {
  it('replaces the file in place with a note and records the upload in the message metadata', async () => {
    const { sandbox } = createFakeSandbox();
    const { agent, prompts, recall } = createHarness(sandbox);
    const bytes = Buffer.from('%PDF-1.7 report');

    await agent.generate([userMessage(text('Before'), file(bytes, 'report.pdf', 'application/pdf'), text('After'))], {
      memory: MEMORY,
    });

    const [before, note, after] = textsIn(prompts.at(-1));
    expect([before, after]).toEqual(['Before', 'After']);
    const uploaded = note!.match(uploadedPath('\\.pdf'))![0];
    expect(note).toBe(
      [
        '[File uploaded to the sandbox]',
        `path: ${uploaded}`,
        'name: report.pdf',
        'type: application/pdf',
        `size: ${bytes.byteLength} bytes`,
      ].join('\n'),
    );

    const stored = (await recall()).find(message => message.role === 'user');
    expect(stored?.content.metadata?.fileUploads).toEqual([
      { name: 'report.pdf', path: uploaded, mimeType: 'application/pdf', size: bytes.byteLength },
    ]);
  });

  it('writes every file of a turn in one writeFiles call, after creating the uploads directory', async () => {
    const { sandbox, writes, commands, events } = createFakeSandbox();
    const { agent } = createHarness(sandbox);
    const first = Buffer.from('first');
    const second = Buffer.from('second');

    await agent.generate(
      [userMessage(text('Two files'), file(first, 'a.txt', 'text/plain'), file(second, 'b.txt', 'text/plain'))],
      { memory: MEMORY },
    );

    expect(commands).toEqual([`mkdir -p uploads/${MEMORY.thread}`]);
    expect(events).toEqual(['executeCommand', 'writeFiles']);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.map(written => written.content)).toEqual([first, second]);
    expect(writes[0]![0]!.path).toMatch(uploadedPath('\\.txt'));
    expect(writes[0]![1]!.path).toMatch(uploadedPath('\\.txt'));
  });

  it('persists the reference instead of the file, so the next turn does not upload again', async () => {
    const { sandbox, writes } = createFakeSandbox();
    const { agent, prompts, recall } = createHarness(sandbox);
    const bytes = Buffer.from('persist me, but only once');

    await agent.generate([userMessage(text('First'), file(bytes, 'notes.txt', 'text/plain'))], { memory: MEMORY });
    await agent.generate('Second', { memory: MEMORY });

    const stored = JSON.stringify(await recall());
    expect(stored).not.toContain(bytes.toString('base64'));
    expect(stored).not.toContain('"type":"file"');
    expect(writes).toHaveLength(1);
    expect(prompts).toHaveLength(2);
    expect(filePartsIn(prompts.at(-1))).toEqual([]);
    expect(JSON.stringify(prompts.at(-1))).toMatch(uploadedPath('\\.txt'));
  });

  it('uploads a file sent on a later turn without uploading the earlier one again', async () => {
    const { sandbox, writes } = createFakeSandbox();
    const { agent, prompts } = createHarness(sandbox);
    const first = Buffer.from('sent on the first turn');
    const second = Buffer.from('sent on the second turn');

    await agent.generate([userMessage(text('One'), file(first, 'first.txt', 'text/plain'))], { memory: MEMORY });
    await agent.generate([userMessage(text('Two'), file(second, 'second.txt', 'text/plain'))], { memory: MEMORY });

    expect(writes.map(batch => batch.map(written => written.content))).toEqual([[first], [second]]);
    const lastPrompt = JSON.stringify(prompts.at(-1));
    expect(filePartsIn(prompts.at(-1))).toEqual([]);
    expect(lastPrompt).toContain('name: first.txt');
    expect(lastPrompt).toContain('name: second.txt');
    expect(lastPrompt.match(new RegExp(uploadedPath('\\.txt'), 'g'))).toHaveLength(2);
  });

  it('asks filter about each file, uploads the ones it accepts and leaves the others to the model', async () => {
    const { sandbox, writes } = createFakeSandbox();
    const asked: FileUploadFileInfo[] = [];
    const { agent, prompts } = createHarness(sandbox, {
      filter: file => {
        asked.push(file);
        return file.mimeType === 'application/pdf' || file.extension === 'csv';
      },
    });

    await agent.generate(
      [
        userMessage(
          file(Buffer.from('plain text stays'), 'notes.txt', 'text/plain'),
          file(Buffer.from('%PDF'), 'report.pdf', 'Application/PDF; version=1.7'),
          file(Buffer.from('a,b'), 'Data.CSV', 'application/octet-stream'),
        ),
      ],
      { memory: MEMORY },
    );

    expect(asked).toContainEqual({ fileName: 'notes.txt', mimeType: 'text/plain', extension: 'txt', source: 'inline' });
    expect(asked).toContainEqual({
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      source: 'inline',
    });
    expect(asked).toContainEqual({
      fileName: 'Data.CSV',
      mimeType: 'application/octet-stream',
      extension: 'csv',
      source: 'inline',
    });
    expect(filePartsIn(prompts.at(-1))).toMatchObject([{ mediaType: 'text/plain', filename: 'notes.txt' }]);
    expect(writes[0]!.map(written => written.path)).toEqual([
      expect.stringMatching(uploadedPath('\\.pdf')),
      expect.stringMatching(uploadedPath('\\.csv')),
    ]);
  });

  it('waits for a filter that answers asynchronously', async () => {
    const { sandbox, writes } = createFakeSandbox();
    const { agent, prompts } = createHarness(sandbox, {
      filter: async ({ mimeType }) => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return mimeType !== 'application/pdf';
      },
    });

    await agent.generate(
      [
        userMessage(
          file(Buffer.from('%PDF'), 'report.pdf', 'application/pdf'),
          file(
            Buffer.from('workbook'),
            'leads.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ),
        ),
      ],
      { memory: MEMORY },
    );

    expect(filePartsIn(prompts.at(-1))).toMatchObject([{ mediaType: 'application/pdf', filename: 'report.pdf' }]);
    expect(writes[0]!.map(written => written.path)).toEqual([expect.stringMatching(uploadedPath('\\.xlsx'))]);
  });

  it.each([
    ['nothing', () => undefined as unknown as boolean, 'undefined'],
    ['a non-boolean', () => 'yes' as unknown as boolean, 'yes'],
    [
      'an exception',
      () => {
        throw new Error('rule lookup failed');
      },
      'rule lookup failed',
    ],
  ])(
    'aborts the turn without calling the model or writing anything when filter returns %s',
    async (_label, filter, cause) => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent, prompts } = createHarness(sandbox, { filter });

      const result = await agent.generate([userMessage(file(Buffer.from('data'), 'notes.txt', 'text/plain'))], {
        memory: MEMORY,
      });

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.INVALID_FILTER,
        fileName: 'notes.txt',
        mimeType: 'text/plain',
        cause,
      });
      expect(prompts).toEqual([]);
      expect(writes).toEqual([]);
    },
  );

  describe('file size limit', () => {
    it('aborts the turn without calling the model or writing anything when one file is too large', async () => {
      const { sandbox, writes, commands } = createFakeSandbox();
      const { agent, prompts } = createHarness(sandbox, { maxFileSize: () => 4 });

      const result = await agent.generate(
        [
          userMessage(
            file(Buffer.from('ok'), 'small.txt', 'text/plain'),
            file(Buffer.from('12345'), 'big.txt', 'text/plain'),
          ),
        ],
        { memory: MEMORY },
      );

      expect(result.tripwire?.reason).toContain('big.txt');
      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
        fileName: 'big.txt',
        mimeType: 'text/plain',
        size: 5,
        maxFileSize: 4,
      });
      expect(prompts).toEqual([]);
      expect(writes).toEqual([]);
      expect(commands).toEqual([]);
    });

    it('accepts a file exactly at the limit', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent } = createHarness(sandbox, { maxFileSize: () => 4 });

      const result = await agent.generate([userMessage(file(Buffer.from('1234'), 'edge.txt', 'text/plain'))], {
        memory: MEMORY,
      });

      expect(result.tripwire).toBeUndefined();
      expect(writes).toHaveLength(1);
    });

    it('defaults to 10 MB', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent } = createHarness(sandbox);
      const tenMegabytes = 10 * 1024 * 1024;

      const result = await agent.generate(
        [userMessage(file(Buffer.alloc(tenMegabytes + 1), 'huge.bin', 'application/octet-stream'))],
        { memory: MEMORY },
      );

      expect(result.tripwire?.metadata).toMatchObject({
        code: FILE_UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
        size: tenMegabytes + 1,
        maxFileSize: tenMegabytes,
      });
      expect(writes).toEqual([]);
    });

    it('asks maxFileSize with the name, MIME type and extension of the file', async () => {
      const { sandbox } = createFakeSandbox();
      const received: unknown[] = [];
      const { agent } = createHarness(sandbox, {
        maxFileSize: file => {
          received.push(file);
          return 1024;
        },
      });

      await agent.generate([userMessage(file(Buffer.from('%PDF'), 'Report.PDF', 'application/pdf'))], {
        memory: MEMORY,
      });

      expect(received).toEqual([
        { fileName: 'Report.PDF', mimeType: 'application/pdf', extension: 'pdf', source: 'inline' },
      ]);
    });

    it.each([
      ['NaN', () => Number.NaN, 'NaN'],
      ['a negative number', () => -1, '-1'],
      ['a non-number', () => '5' as unknown as number, '5'],
      [
        'an exception',
        () => {
          throw new Error('limit lookup failed');
        },
        'limit lookup failed',
      ],
    ])('aborts the turn when maxFileSize returns %s', async (_label, maxFileSize, cause) => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent, prompts } = createHarness(sandbox, { maxFileSize });

      const result = await agent.generate([userMessage(file(Buffer.from('data'), 'notes.txt', 'text/plain'))], {
        memory: MEMORY,
      });

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.INVALID_MAX_FILE_SIZE,
        fileName: 'notes.txt',
        mimeType: 'text/plain',
        cause,
      });
      expect(prompts).toEqual([]);
      expect(writes).toEqual([]);
    });
  });

  describe('fail early', () => {
    it('throws when the processor is created without a workspace sandbox', () => {
      const withoutSandbox = new Workspace({ filesystem: new LocalFilesystem({ basePath: os.tmpdir() }) });

      expect(() => new FileUploadProcessor({ workspace: withoutSandbox })).toThrow(
        expect.objectContaining({ details: { code: FILE_UPLOAD_ERROR_CODES.NO_SANDBOX } }),
      );
      expect(() => new FileUploadProcessor({} as FileUploadProcessorOptions)).toThrow(
        expect.objectContaining({ details: { code: FILE_UPLOAD_ERROR_CODES.NO_SANDBOX } }),
      );
    });

    it.each([
      ['the agent has no memory', { withMemory: false }, { memory: MEMORY }],
      ['the call has no thread', { withMemory: true }, {}],
      ['memory is read-only', { withMemory: true }, { memory: { ...MEMORY, options: { readOnly: true } } }],
    ])('aborts a text-only turn with MEMORY_REQUIRED when %s', async (_label, harnessOptions, callOptions) => {
      const { sandbox } = createFakeSandbox();
      const { agent, prompts } = createHarness(sandbox, {}, harnessOptions);

      const result = await agent.generate('No file here', callOptions);

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.MEMORY_REQUIRED,
      });
      expect(prompts).toEqual([]);
    });

    it('aborts a text-only turn with NO_SANDBOX when the workspace resolves no sandbox', async () => {
      const { agent, prompts } = createHarness((() => undefined) as unknown as WorkspaceSandboxResolver);

      const result = await agent.generate('No file here', { memory: MEMORY });

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.NO_SANDBOX,
      });
      expect(prompts).toEqual([]);
    });

    it('aborts with NO_SANDBOX, keeping the cause, when resolving the sandbox throws', async () => {
      const { agent, prompts } = createHarness(() => {
        throw new Error('sandbox pool exhausted');
      });

      const result = await agent.generate('No file here', { memory: MEMORY });

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.NO_SANDBOX,
        cause: 'sandbox pool exhausted',
      });
      expect(prompts).toEqual([]);
    });

    it('aborts a text-only turn with NO_WRITE_CAPABILITY when the sandbox cannot write files', async () => {
      const { sandbox } = createFakeSandbox({ writeFiles: undefined, executeCommand: undefined });
      const { agent, prompts } = createHarness(sandbox);

      const result = await agent.generate('No file here', { memory: MEMORY });

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.NO_WRITE_CAPABILITY,
      });
      expect(prompts).toEqual([]);
    });
  });

  describe('file sources', () => {
    const remoteBytes = Buffer.from('%PDF remote report');
    let server: Server;
    let baseUrl: string;
    let requests: string[];

    beforeEach(async () => {
      requests = [];
      server = createServer((request, response) => {
        requests.push(request.url ?? '');
        const found = request.url === '/report.pdf';
        response.writeHead(found ? 200 : 404, { 'Content-Type': 'application/pdf' });
        response.end(found ? remoteBytes : 'Not found');
      });
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing test server port');
      baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterEach(async () => {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    });

    it('uploads a file sent as a data URI', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent } = createHarness(sandbox);
      const bytes = Buffer.from('inline through a data URI');
      const dataUri = `data:text/plain;base64,${bytes.toString('base64')}`;

      await agent.generate([userMessage(file(dataUri, 'notes.txt', 'text/plain'))], { memory: MEMORY });

      expect(writes[0]![0]!.content).toEqual(bytes);
    });

    it('aborts with UNSUPPORTED_FILE_SOURCE, without downloading it, when the filter accepts a file sent as an http URL', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent, prompts } = createHarness(sandbox);

      const result = await agent.generate(
        [userMessage(file(new URL(`${baseUrl}/report.pdf`), 'report.pdf', 'application/pdf'))],
        { memory: MEMORY },
      );

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.UNSUPPORTED_FILE_SOURCE,
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
      });
      expect(requests).toEqual([]);
      expect(prompts).toEqual([]);
      expect(writes).toEqual([]);
    });

    it('tells the filter where each file comes from, so URLs can be left to the model', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const sources: Array<[string | undefined, string]> = [];
      const { agent } = createHarness(sandbox, {
        filter: ({ fileName, source }) => {
          sources.push([fileName, source]);
          return source === 'inline';
        },
      });
      const bytes = Buffer.from('inline bytes');

      const result = await agent.generate(
        [
          userMessage(
            file(bytes, 'inline.txt', 'text/plain'),
            file(new URL(`${baseUrl}/report.pdf`), 'report.pdf', 'application/pdf'),
            file('file-abc123', 'provider.pdf', 'application/pdf'),
          ),
        ],
        { memory: MEMORY },
      );

      expect(result.tripwire).toBeUndefined();
      expect(sources).toContainEqual(['inline.txt', 'inline']);
      expect(sources).toContainEqual(['report.pdf', 'url']);
      expect(sources).toContainEqual(['provider.pdf', 'providerFileId']);
      expect(writes.flat().map(written => written.content)).toEqual([bytes]);
    });

    it.each([
      ['a cloud storage URL', new URL('gs://bucket/report.pdf')],
      ['a provider file id', 'file-abc123'],
    ])('aborts with UNSUPPORTED_FILE_SOURCE for %s', async (_label, data) => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent, prompts } = createHarness(sandbox);

      const result = await agent.generate([userMessage(file(data, 'report.pdf', 'application/pdf'))], {
        memory: MEMORY,
      });

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.UNSUPPORTED_FILE_SOURCE,
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
      });
      expect(prompts).toEqual([]);
      expect(writes).toEqual([]);
    });

    it('aborts with INVALID_FILE_DATA when inline data is not base64', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent, prompts } = createHarness(sandbox);

      const result = await agent.generate(
        [userMessage(file('data:text/plain;base64,not base64 at all!', 'notes.txt', 'text/plain'))],
        { memory: MEMORY },
      );

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.INVALID_FILE_DATA,
        fileName: 'notes.txt',
        mimeType: 'text/plain',
      });
      expect(prompts).toEqual([]);
      expect(writes).toEqual([]);
    });
  });

  describe('files without a name', () => {
    it('takes the extension from the MIME type and tells maxFileSize the name is missing', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const received: unknown[] = [];
      const { agent, prompts, recall } = createHarness(sandbox, {
        maxFileSize: file => {
          received.push(file);
          return 1024;
        },
      });
      const bytes = Buffer.from('%PDF');

      await agent.generate([userMessage(file(bytes, undefined, 'application/pdf'))], { memory: MEMORY });

      const uploaded = writes[0]![0]!.path;
      expect(uploaded).toMatch(uploadedPath('\\.pdf'));
      expect(received).toEqual([
        { fileName: undefined, mimeType: 'application/pdf', extension: undefined, source: 'inline' },
      ]);
      expect(textsIn(prompts.at(-1))[0]).toContain('name: unnamed file');
      const stored = (await recall()).find(message => message.role === 'user');
      expect(stored?.content.metadata?.fileUploads).toEqual([
        { path: uploaded, mimeType: 'application/pdf', size: bytes.byteLength },
      ]);
    });

    it('uploads an image part, which can never carry a name', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent, prompts } = createHarness(sandbox, { filter: ({ mimeType }) => mimeType.startsWith('image/') });
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      await agent.generate(
        [{ role: 'user', content: [text('Describe'), { type: 'image', image: bytes, mediaType: 'image/png' }] }],
        { memory: MEMORY },
      );

      expect(writes[0]![0]!.path).toMatch(uploadedPath('\\.png'));
      expect(writes[0]![0]!.content).toEqual(bytes);
      expect(userPartsIn(prompts.at(-1)).map(part => part.type)).toEqual(['text', 'text']);
    });
  });

  describe('upload failure', () => {
    const commandResult = (success: boolean, stderr = '') => ({
      success,
      exitCode: success ? 0 : 1,
      stdout: '',
      stderr,
      executionTimeMs: 0,
    });
    const DIR = `uploads/${MEMORY.thread}`;
    const twoFiles = () => [
      userMessage(file(Buffer.from('a'), 'a.txt', 'text/plain'), file(Buffer.from('b'), 'b.csv', 'text/plain')),
    ];

    it('removes what it wrote and aborts with UPLOAD_FAILED when writeFiles fails', async () => {
      const { sandbox, commands } = createFakeSandbox({
        writeFiles: async () => {
          throw new Error('disk full');
        },
      });
      const { agent, prompts } = createHarness(sandbox);

      const result = await agent.generate(twoFiles(), { memory: MEMORY });

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.UPLOAD_FAILED,
        cause: 'disk full',
      });
      expect(prompts).toEqual([]);
      expect(commands).toHaveLength(2);
      expect(commands[1]).toMatch(
        new RegExp(
          `^rm -f ${DIR}/${UUID}\\.txt ${DIR}/${UUID}\\.txt\\.b64 ${DIR}/${UUID}\\.csv ${DIR}/${UUID}\\.csv\\.b64$`,
        ),
      );
    });

    it('reports the paths it could not remove, and keeps the original cause', async () => {
      const { sandbox } = createFakeSandbox({
        writeFiles: async () => {
          throw new Error('disk full');
        },
        executeCommand: async (_command, args = []) => commandResult(!args.at(-1)!.startsWith('rm -f'), 'rm: denied'),
      });
      const { agent } = createHarness(sandbox);

      const result = await agent.generate(twoFiles(), { memory: MEMORY });

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.UPLOAD_FAILED,
        cause: 'disk full',
        orphanPaths: [expect.stringMatching(uploadedPath('\\.txt')), expect.stringMatching(uploadedPath('\\.csv'))],
      });
    });

    it('reports every path as orphaned when the sandbox has no command to remove them', async () => {
      const { sandbox } = createFakeSandbox({
        executeCommand: undefined,
        writeFiles: async () => {
          throw new Error('quota exceeded');
        },
      });
      const { agent } = createHarness(sandbox);

      const result = await agent.generate(twoFiles(), { memory: MEMORY });

      expect(result.tripwire?.metadata).toMatchObject({
        code: FILE_UPLOAD_ERROR_CODES.UPLOAD_FAILED,
        cause: 'quota exceeded',
        orphanPaths: [expect.stringMatching(uploadedPath('\\.txt')), expect.stringMatching(uploadedPath('\\.csv'))],
      });
    });

    it('waits for every command write to settle before removing files when one of them fails', async () => {
      const scripts: string[] = [];
      const { sandbox } = createFakeSandbox({
        writeFiles: undefined,
        executeCommand: async (_command, args = []) => {
          const script = args.at(-1)!;
          if (script.includes('.csv')) await new Promise(resolve => setTimeout(resolve, 20));
          scripts.push(script);
          return commandResult(!(script.startsWith('base64 -d') && script.includes('.txt')), 'base64: invalid input');
        },
      });
      const { agent, prompts } = createHarness(sandbox);

      const result = await agent.generate(twoFiles(), { memory: MEMORY });

      expect(result.tripwire?.metadata).toEqual({
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.UPLOAD_FAILED,
        cause: 'base64: invalid input',
      });
      expect(prompts).toEqual([]);
      expect(scripts.at(-1)).toMatch(/^rm -f /);
      expect(scripts.filter(script => script.includes('.csv') && !script.startsWith('rm -f'))).toHaveLength(3);
    });

    it('aborts with UPLOAD_FAILED when the uploads directory cannot be created', async () => {
      const { sandbox, writes } = createFakeSandbox({
        executeCommand: async (_command, args = []) =>
          commandResult(!args.at(-1)!.startsWith('mkdir'), 'mkdir: read-only'),
      });
      const { agent } = createHarness(sandbox);

      const result = await agent.generate(twoFiles(), { memory: MEMORY });

      expect(result.tripwire?.metadata).toMatchObject({
        code: FILE_UPLOAD_ERROR_CODES.UPLOAD_FAILED,
        cause: 'mkdir: read-only',
      });
      expect(writes).toEqual([]);
    });
  });

  describe('after an aborted turn', () => {
    const big = Buffer.from('this file is over the limit');
    const rejectedTurn = () => [
      userMessage(
        text('Read these'),
        file(Buffer.from('ok'), 'small.txt', 'text/plain'),
        file(big, 'big.txt', 'text/plain'),
      ),
    ];

    it('leaves the thread usable: no file is stored and the next turn runs', async () => {
      const { sandbox } = createFakeSandbox();
      const { agent, prompts, recall } = createHarness(sandbox, { maxFileSize: () => 4 });

      const rejected = await agent.generate(rejectedTurn(), { memory: MEMORY });
      const next = await agent.generate('Never mind, just say hi', { memory: MEMORY });

      expect(rejected.tripwire?.metadata).toMatchObject({ code: FILE_UPLOAD_ERROR_CODES.FILE_TOO_LARGE });
      expect(next.tripwire).toBeUndefined();
      expect(prompts).toHaveLength(1);
      expect(JSON.stringify(await recall())).not.toContain(big.toString('base64'));
    });

    it('leaves the thread usable on a durable agent too', async () => {
      const { sandbox } = createFakeSandbox();
      const { agent, prompts, recall } = createHarness(sandbox, { maxFileSize: () => 4 });
      void new Mastra({ agents: { 'file-upload-agent': agent }, storage: new InMemoryStore() });
      const pubsub = new EventEmitterPubSub();

      try {
        const durableAgent = createDurableAgent({ agent, pubsub });
        for (const turn of [rejectedTurn(), 'Never mind, just say hi']) {
          const result = await durableAgent.stream(turn, { memory: MEMORY, maxSteps: 1 });
          for await (const _chunk of result.fullStream) {
            // drain
          }
        }
      } finally {
        await pubsub.close();
      }

      const stored = JSON.stringify(await recall());
      expect(prompts).toHaveLength(1);
      expect(filePartsIn(prompts[0])).toEqual([]);
      expect(stored).not.toContain(big.toString('base64'));
      expect(stored).not.toContain('"type":"file"');
      expect(stored).toContain('[File not uploaded]');
    });
  });

  describe('safety net before the model call', () => {
    const storedFileRow = (role: 'user' | 'assistant', secondsAgo: number) => ({
      id: globalThis.crypto.randomUUID(),
      role,
      type: 'text' as const,
      threadId: MEMORY.thread,
      resourceId: MEMORY.resource,
      createdAt: new Date(Date.now() - secondsAgo * 1000),
      content: {
        format: 2 as const,
        parts: [
          {
            type: 'file' as const,
            data: `data:application/pdf;base64,${Buffer.from('%PDF stored raw').toString('base64')}`,
            mimeType: 'application/pdf',
            filename: 'old.pdf',
          },
        ],
      },
    });
    const storedTextRow = (secondsAgo: number) => ({
      ...storedFileRow('user', secondsAgo),
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'Make me a PDF' }] },
    });

    async function seedHistory(memory: MockMemory, messages: Array<ReturnType<typeof storedFileRow>>) {
      await memory.createThread({ threadId: MEMORY.thread, resourceId: MEMORY.resource });
      await memory.saveMessages({ messages });
    }

    it('lets a raw file of the thread history reach the model on every turn, as before the processor', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent, prompts, memory } = createHarness(sandbox, {
        filter: ({ mimeType }) => mimeType === 'application/pdf',
      });
      await seedHistory(memory, [storedFileRow('user', 10)]);

      const first = await agent.generate('What was in that file?', { memory: MEMORY });
      const second = await agent.generate('And what else?', { memory: MEMORY });

      expect(first.tripwire).toBeUndefined();
      expect(second.tripwire).toBeUndefined();
      expect(prompts).toHaveLength(2);
      for (const prompt of prompts) {
        expect(filePartsIn(prompt)).toMatchObject([{ mediaType: 'application/pdf', filename: 'old.pdf' }]);
      }
      expect(writes).toEqual([]);
    });

    it('never asks the filter about a file of the thread history', async () => {
      const { sandbox } = createFakeSandbox();
      const asked: Array<string | undefined> = [];
      const { agent, prompts, memory } = createHarness(sandbox, {
        filter: ({ fileName }) => {
          asked.push(fileName);
          throw new Error('rule lookup failed');
        },
      });
      await seedHistory(memory, [storedFileRow('user', 10)]);

      const result = await agent.generate('What was in that file?', { memory: MEMORY });

      expect(result.tripwire).toBeUndefined();
      expect(asked).toEqual([]);
      expect(prompts).toHaveLength(1);
    });

    it('lets a file produced by the assistant through', async () => {
      const { sandbox } = createFakeSandbox();
      const { agent, prompts, memory } = createHarness(sandbox, {
        filter: ({ mimeType }) => mimeType === 'application/pdf',
      });
      await seedHistory(memory, [storedTextRow(20), storedFileRow('assistant', 10)]);

      const result = await agent.generate('Thanks', { memory: MEMORY });

      expect(result.tripwire).toBeUndefined();
      expect(prompts).toHaveLength(1);
    });
  });

  describe('files that only exist as attachments (AI SDK v4 UI messages)', () => {
    const attachment = (bytes: Buffer, name: string, contentType: string) => ({
      name,
      contentType,
      url: `data:${contentType};base64,${bytes.toString('base64')}`,
    });
    const uiMessage = (...attachments: Array<ReturnType<typeof attachment>>) => ({
      id: 'ui-message-1',
      role: 'user' as const,
      content: 'Read the attachments',
      parts: [{ type: 'text' as const, text: 'Read the attachments' }],
      experimental_attachments: attachments,
    });

    it('uploads them and replaces them with notes placed before the text, in order', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent, prompts, recall } = createHarness(sandbox);
      const first = Buffer.from('first attachment');
      const second = Buffer.from('second attachment');

      await agent.generate(
        [uiMessage(attachment(first, 'one.txt', 'text/plain'), attachment(second, 'two.txt', 'text/plain'))],
        { memory: MEMORY },
      );

      expect(writes[0]!.map(written => written.content)).toEqual([first, second]);
      expect(filePartsIn(prompts.at(-1))).toEqual([]);
      const texts = textsIn(prompts.at(-1));
      expect(texts).toHaveLength(3);
      expect(texts[0]).toMatch(uploadedPath('\\.txt'));
      expect(texts[0]).toContain('name: one.txt');
      expect(texts[1]).toMatch(uploadedPath('\\.txt'));
      expect(texts[1]).toContain('name: two.txt');
      expect(texts[2]).toBe('Read the attachments');
      expect(JSON.stringify(await recall())).not.toContain(first.toString('base64'));
    });

    it('leaves an attachment the filter rejects where it is', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent, prompts } = createHarness(sandbox, { filter: ({ mimeType }) => mimeType === 'application/pdf' });

      await agent.generate([uiMessage(attachment(Buffer.from('kept'), 'kept.txt', 'text/plain'))], {
        memory: MEMORY,
      });

      expect(writes).toEqual([]);
      expect(filePartsIn(prompts.at(-1))).toHaveLength(1);
    });
  });
});

describe('FileUploadProcessor.processInputStep', () => {
  it('aborts with MEMORY_REQUIRED, before writing anything, when memory is read-only', async () => {
    const { sandbox, writes, commands } = createFakeSandbox();
    const processor = new FileUploadProcessor({ workspace: new Workspace({ sandbox }) });
    const messageList = new MessageList({ threadId: MEMORY.thread, resourceId: MEMORY.resource });
    messageList.add(userMessage(file(Buffer.from('a'), 'a.txt', 'text/plain')), 'input');
    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', {
      thread: { id: MEMORY.thread },
      resourceId: MEMORY.resource,
      memoryConfig: { readOnly: true },
    });
    const abort = vi.fn((reason: string) => {
      throw new Error(reason);
    });
    const args = { messageList, requestContext, abort } as unknown as Parameters<
      FileUploadProcessor['processInputStep']
    >[0];

    await expect(processor.processInputStep(args)).rejects.toThrow('read-only');

    expect(abort).toHaveBeenCalledWith(expect.any(String), {
      metadata: { processorId: 'file-upload', code: FILE_UPLOAD_ERROR_CODES.MEMORY_REQUIRED },
    });
    expect(writes).toEqual([]);
    expect(commands).toEqual([]);
  });
});

describe('FileUploadProcessor.processLLMRequest', () => {
  const createAbort = () =>
    vi.fn((reason: string) => {
      throw new Error(reason);
    });
  const callArgs = (args: Record<string, unknown>) =>
    args as unknown as Parameters<FileUploadProcessor['processLLMRequest']>[0];

  it('stops the call with FILE_NOT_UPLOADED when a new message still holds a raw file the filter accepts', async () => {
    const { sandbox } = createFakeSandbox();
    const processor = new FileUploadProcessor({ workspace: new Workspace({ sandbox }) });
    const messageList = new MessageList({ threadId: MEMORY.thread, resourceId: MEMORY.resource });
    messageList.add(userMessage(file(Buffer.from('%PDF'), 'late.pdf', 'application/pdf')), 'input');
    const abort = createAbort();

    await expect(processor.processLLMRequest(callArgs({ prompt: [], messageList, abort }))).rejects.toThrow('late.pdf');

    expect(abort).toHaveBeenCalledWith(expect.any(String), {
      metadata: {
        processorId: 'file-upload',
        code: FILE_UPLOAD_ERROR_CODES.FILE_NOT_UPLOADED,
        fileName: 'late.pdf',
        mimeType: 'application/pdf',
      },
    });
  });

  it('checks nothing without a message list, since it cannot tell new files from the history', async () => {
    const { sandbox } = createFakeSandbox();
    const processor = new FileUploadProcessor({ workspace: new Workspace({ sandbox }) });
    const prompt = [
      {
        role: 'user' as const,
        content: [{ type: 'file' as const, data: new Uint8Array([37, 80, 68, 70]), mediaType: 'application/pdf' }],
      },
    ];
    const abort = createAbort();

    await processor.processLLMRequest(callArgs({ prompt, abort }));

    expect(abort).not.toHaveBeenCalled();
  });
});
