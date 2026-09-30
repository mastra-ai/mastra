import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { CompositeFilesystem, LocalFilesystem, Workspace } from '../../workspace';
import type { AnyWorkspace } from '../../workspace';
import {
  formatWorkspaceAttachmentNote,
  WORKSPACE_REQUIRED_FOR_ATTACHMENT,
  WorkspaceAttachmentsProcessor,
} from './workspace-attachments';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff]);
const BASE64 = Buffer.from(BYTES).toString('base64');

const tempDirectories: string[] = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'mastra-attachments-'));
  tempDirectories.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

function textStream(text = 'ok') {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: text },
    { type: 'text-end', id: 't' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ] as any);
}

function recordingModel() {
  const prompts: any[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      return { rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [], stream: textStream() };
    },
  });
  return { model, prompts };
}

function promptParts(prompt: any[]) {
  return prompt.filter(m => m.role === 'user').flatMap(m => (Array.isArray(m.content) ? m.content : []));
}
function spreadsheetFileParts(prompt: any[]) {
  return promptParts(prompt).filter(p => p.type === 'file' && p.mediaType === XLSX);
}
function noteText(prompt: any[]): string {
  const note = promptParts(prompt).find(p => p.type === 'text' && p.text.startsWith('[Attachment'));
  if (!note) throw new Error(`No attachment note in ${JSON.stringify(prompt)}`);
  return note.text;
}
function uploadedPath(text: string): string {
  const match = text.match(/at (.+?)\. Use workspace tools/);
  if (!match) throw new Error(`No upload path in: ${text}`);
  return match[1]!;
}

function agentWith(workspace: AnyWorkspace | (() => AnyWorkspace) | undefined, extra: Record<string, any> = {}) {
  const { model, prompts } = recordingModel();
  const agent = new Agent({
    id: 'attachments-agent',
    name: 'attachments-agent',
    instructions: 'test',
    model,
    workspace: workspace as any,
    ...extra,
  });
  return { agent, prompts };
}

async function localWorkspace(options: { readOnly?: boolean } = {}) {
  const basePath = await tempDir();
  return { basePath, workspace: new Workspace({ filesystem: new LocalFilesystem({ basePath, ...options }) }) };
}

const xlsxMessage = (data: unknown = BASE64, filename = 'report.xlsx') => ({
  role: 'user' as const,
  content: [
    { type: 'text' as const, text: 'Summarize this' },
    { type: 'file' as const, data: data as any, mediaType: XLSX, filename },
  ],
});

describe('WorkspaceAttachmentsProcessor', () => {
  describe('through agent.stream()', () => {
    it.each([
      ['base64', BASE64],
      ['a data URL', `data:${XLSX};base64,${BASE64}`],
      ['a Uint8Array', BYTES],
    ])('writes the exact bytes from %s and sends the model a note instead of the file', async (_label, data) => {
      const { basePath, workspace } = await localWorkspace();
      const { agent, prompts } = agentWith(workspace);

      await (await agent.stream([xlsxMessage(data)])).consumeStream();

      const prompt = prompts[0]!;
      expect(spreadsheetFileParts(prompt)).toHaveLength(0);
      const path = uploadedPath(noteText(prompt));
      expect(path).toMatch(/^uploads\/[0-9a-f-]{36}\/report\.xlsx$/);
      expect(new Uint8Array(await readFile(join(basePath, path)))).toEqual(BYTES);
    });

    it('leaves PDFs, images and text untouched', async () => {
      const { basePath, workspace } = await localWorkspace();
      const { agent, prompts } = agentWith(workspace);

      await (
        await agent.stream([
          {
            role: 'user',
            content: [
              { type: 'text', text: 'hello' },
              { type: 'file', data: 'JVBERi0=', mediaType: 'application/pdf', filename: 'doc.pdf' },
            ],
          },
        ])
      ).consumeStream();

      expect(promptParts(prompts[0]!).some(p => p.type === 'file' && p.mediaType === 'application/pdf')).toBe(true);
      expect(await readdir(basePath)).toEqual([]);
    });

    it('routes a UIMessage (parts[].url) input', async () => {
      const { basePath, workspace } = await localWorkspace();
      const { agent, prompts } = agentWith(workspace);

      await (
        await agent.stream([
          {
            id: 'ui-1',
            role: 'user',
            parts: [{ type: 'file', mediaType: XLSX, filename: 'ui.xlsx', url: `data:${XLSX};base64,${BASE64}` }],
          } as any,
        ])
      ).consumeStream();

      expect(spreadsheetFileParts(prompts[0]!)).toHaveLength(0);
      const path = uploadedPath(noteText(prompts[0]!));
      expect(new Uint8Array(await readFile(join(basePath, path)))).toEqual(BYTES);
    });

    it('routes a format-2 experimental_attachments input', async () => {
      const { basePath, workspace } = await localWorkspace();
      const { agent, prompts } = agentWith(workspace);

      await (
        await agent.stream([
          {
            id: 'v4-1',
            role: 'user',
            createdAt: new Date(),
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'see attached' }],
              experimental_attachments: [
                { name: 'legacy.xlsx', contentType: XLSX, url: `data:${XLSX};base64,${BASE64}` },
              ],
            },
          } as any,
        ])
      ).consumeStream();

      expect(spreadsheetFileParts(prompts[0]!)).toHaveLength(0);
      const path = uploadedPath(noteText(prompts[0]!));
      expect(new Uint8Array(await readFile(join(basePath, path)))).toEqual(BYTES);
    });

    it('routes spreadsheets passed through the context option', async () => {
      const { basePath, workspace } = await localWorkspace();
      const { agent, prompts } = agentWith(workspace);

      await (await agent.stream('hello', { context: [xlsxMessage()] })).consumeStream();

      expect(spreadsheetFileParts(prompts[0]!)).toHaveLength(0);
      const path = uploadedPath(noteText(prompts[0]!));
      expect(new Uint8Array(await readFile(join(basePath, path)))).toEqual(BYTES);
    });

    it('writes to the same workspace instance the tools use when the factory returns a fresh instance per call', async () => {
      const basePath = await tempDir();
      const factory = vi.fn(() => new Workspace({ filesystem: new LocalFilesystem({ basePath: join(basePath) }) }));
      let toolRead: Uint8Array | undefined;
      const readTool = createTool({
        id: 'read-upload',
        description: 'read',
        inputSchema: z.object({ path: z.string() }),
        execute: async ({ path }, { workspace }) => {
          toolRead = new Uint8Array((await workspace!.filesystem!.readFile(path)) as Buffer);
          return 'read';
        },
      });
      let pathFromNote = '';
      let call = 0;
      const model = new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          call++;
          if (call === 1) {
            pathFromNote = uploadedPath(noteText(prompt as any));
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'tool-call',
                  toolCallId: 'c1',
                  toolName: 'readUpload',
                  input: JSON.stringify({ path: pathFromNote }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ] as any),
            };
          }
          return { rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [], stream: textStream() };
        },
      });
      const agent = new Agent({
        id: 'factory-agent',
        name: 'factory-agent',
        instructions: 'test',
        model,
        workspace: factory as any,
        tools: { readUpload: readTool },
      });

      await (await agent.stream([xlsxMessage()])).consumeStream();

      expect(pathFromNote).not.toBe('');
      expect(toolRead).toEqual(BYTES);
    });

    it('persists the path note, not the binary, to memory', async () => {
      const { workspace } = await localWorkspace();
      const memory = new MockMemory();
      const { agent } = agentWith(workspace, { memory });

      await (
        await agent.stream([xlsxMessage()], { memory: { thread: 'thread-1', resource: 'user-1' } })
      ).consumeStream();

      const { messages } = await memory.recall({ threadId: 'thread-1', resourceId: 'user-1' });
      const userParts = messages.filter(m => m.role === 'user').flatMap(m => m.content.parts);
      expect(userParts.some(p => p.type === 'file')).toBe(false);
      expect(userParts.some(p => p.type === 'text' && p.text.includes('uploads/'))).toBe(true);
    });

    it('aborts without calling the model when the agent has no workspace', async () => {
      const { agent, prompts } = agentWith(undefined);

      const result = await agent.stream([xlsxMessage()]);
      await result.consumeStream();

      expect(prompts).toHaveLength(0);
      const tripwire = await result.tripwire;
      expect(tripwire?.processorId).toBe('workspace-attachments-processor');
      expect(tripwire?.metadata).toEqual({ code: WORKSPACE_REQUIRED_FOR_ATTACHMENT, mediaType: XLSX });
    });

    it('aborts when the single filesystem is read-only', async () => {
      const { basePath, workspace } = await localWorkspace({ readOnly: true });
      const { agent, prompts } = agentWith(workspace);

      const result = await agent.stream([xlsxMessage()]);
      await result.consumeStream();

      expect(prompts).toHaveLength(0);
      expect((await result.tripwire)?.metadata).toMatchObject({ code: WORKSPACE_REQUIRED_FOR_ATTACHMENT });
      expect(await readdir(basePath)).toEqual([]);
    });
  });

  describe('through the legacy generate/stream APIs', () => {
    const CONTENT = 'hello-sheet';
    const readFileTool = 'mastra_workspace_read_file';

    // Every factory call returns a workspace over a different directory, so a file written
    // to one instance is invisible to tools bound to another instance.
    async function freshInstanceAgent() {
      const dirs: string[] = [];
      const factory = vi.fn(async () => {
        const basePath = await tempDir();
        dirs.push(basePath);
        return new Workspace({ filesystem: new LocalFilesystem({ basePath }) });
      });
      const prompts: any[] = [];
      const respond = async ({ prompt }: any) => {
        prompts.push(prompt);
        if (prompts.length === 1) {
          const path = uploadedPath(legacyNoteText(prompt));
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { promptTokens: 1, completionTokens: 1 },
            toolCalls: [
              {
                toolCallType: 'function' as const,
                toolCallId: 'c1',
                toolName: readFileTool,
                args: JSON.stringify({ path }),
              },
            ],
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { promptTokens: 1, completionTokens: 1 },
          text: 'done',
        };
      };
      const model = new MockLanguageModelV1({
        doGenerate: respond,
        doStream: async args => {
          const result = await respond(args);
          const chunks: any[] = result.toolCalls
            ? result.toolCalls.map(call => ({ type: 'tool-call', ...call }))
            : [{ type: 'text-delta', textDelta: result.text }];
          chunks.push({ type: 'finish', finishReason: result.finishReason, usage: result.usage });
          return {
            rawCall: result.rawCall,
            stream: new ReadableStream({
              start(controller) {
                chunks.forEach(chunk => controller.enqueue(chunk));
                controller.close();
              },
            }),
          };
        },
      });
      const agent = new Agent({
        id: 'legacy-agent',
        name: 'legacy-agent',
        instructions: 'test',
        model,
        workspace: factory as any,
      });
      return { agent, prompts, factory };
    }

    function legacyNoteText(prompt: any[]): string {
      const note = prompt
        .filter(m => m.role === 'user')
        .flatMap(m => (Array.isArray(m.content) ? m.content : []))
        .find(p => p.type === 'text' && p.text.startsWith('[Attachment'));
      if (!note) throw new Error(`No attachment note in ${JSON.stringify(prompt)}`);
      return note.text;
    }
    function toolResult(prompt: any[]): string {
      const part = prompt.filter(m => m.role === 'tool').flatMap(m => m.content)[0];
      return JSON.stringify(part?.result);
    }
    const legacyMessage = {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: 'Summarize this' },
        {
          type: 'file' as const,
          data: Buffer.from(CONTENT).toString('base64'),
          mimeType: XLSX,
          filename: 'report.xlsx',
        },
      ],
    };

    it('generateLegacy writes to the workspace instance its tools read from', async () => {
      const { agent, prompts } = await freshInstanceAgent();
      await agent.generateLegacy([legacyMessage] as any, { maxSteps: 2 });
      expect(prompts).toHaveLength(2);
      expect(toolResult(prompts[1])).toContain(`report.xlsx (${CONTENT.length} bytes`);
    });

    it('streamLegacy writes to the workspace instance its tools read from', async () => {
      const { agent, prompts } = await freshInstanceAgent();
      const result = await agent.streamLegacy([legacyMessage] as any, { maxSteps: 2 });
      await result.consumeStream();
      expect(prompts).toHaveLength(2);
      expect(toolResult(prompts[1])).toContain(`report.xlsx (${CONTENT.length} bytes`);
    });
  });

  describe('processInputStep', () => {
    async function run(workspace: AnyWorkspace | undefined, parts: any[], requestContext = new RequestContext()) {
      const { MessageList } = await import('../../agent/message-list');
      const messageList = new MessageList();
      messageList.add([{ role: 'user', content: parts }], 'input');
      const abort = vi.fn((reason: string, options?: any) => {
        throw Object.assign(new Error(reason), { options });
      }) as any;
      await new WorkspaceAttachmentsProcessor({ workspace }).processInputStep({
        messageList,
        requestContext,
        abort,
      } as any);
      return { parts: messageList.get.all.db()[0]!.content.parts as any[], abort };
    }
    const file = (data: unknown, filename = 'report.xlsx', mediaType: string | undefined = XLSX) => ({
      type: 'file',
      data,
      filename,
      ...(mediaType ? { mediaType } : {}),
    });

    it('sanitizes path traversal in filenames and keeps writes under uploads/', async () => {
      const { basePath, workspace } = await localWorkspace();
      const { parts } = await run(workspace, [file(BASE64, '../../evil.xlsx')]);
      const path = uploadedPath(parts[0].text);
      expect(path).toMatch(/^uploads\/[0-9a-f-]{36}\/evil\.xlsx$/);
      expect(resolve(basePath, path).startsWith(resolve(basePath, 'uploads'))).toBe(true);
    });

    it('routes multiple spreadsheets and detects by extension alone', async () => {
      const { workspace } = await localWorkspace();
      const { parts } = await run(workspace, [
        file(BASE64, 'a.xlsx'),
        { type: 'text', text: 'between' },
        file(BASE64, 'b.xls', 'application/octet-stream'),
      ]);
      expect(parts.map(p => p.type)).toEqual(['text', 'text', 'text']);
      expect(parts[0].text).toContain('uploads/');
      expect(parts[2].text).toContain('"b.xls" (application/vnd.ms-excel)');
    });

    it('leaves a CSV reported as application/vnd.ms-excel untouched', async () => {
      const { basePath, workspace } = await localWorkspace();
      const { parts } = await run(workspace, [file(BASE64, 'data.csv', 'application/vnd.ms-excel')]);
      expect(parts[0].type).toBe('file');
      expect(await readdir(basePath)).toEqual([]);
    });

    it.each([
      ['malformed base64', '!!!!'],
      ['a non-base64 data URL', `data:${XLSX},not-base64`],
      ['a remote URL', 'https://example.com/report.xlsx'],
    ])('aborts on %s before writing', async (_label, data) => {
      const { basePath, workspace } = await localWorkspace();
      await expect(run(workspace, [file(data)])).rejects.toThrow();
      expect(await readdir(basePath)).toEqual([]);
    });

    it('writes to the first writable mount of a composite filesystem', async () => {
      const readOnlyDir = await tempDir();
      const dataDir = await tempDir();
      const workspace = new Workspace({
        mounts: {
          '/docs': new LocalFilesystem({ basePath: readOnlyDir, readOnly: true }),
          '/data': new LocalFilesystem({ basePath: dataDir }),
        },
      });
      const { parts } = await run(workspace, [file(BASE64)]);
      const path = uploadedPath(parts[0].text);
      expect(path).toMatch(/^\/data\/uploads\//);
      expect(new Uint8Array(await readFile(join(dataDir, path.replace(/^\/data\//, ''))))).toEqual(BYTES);
    });

    it('aborts when every mount is read-only', async () => {
      const workspace = new Workspace({
        mounts: { '/docs': new LocalFilesystem({ basePath: await tempDir(), readOnly: true }) },
      });
      await expect(run(workspace, [file(BASE64)])).rejects.toThrow(/writable workspace/);
    });

    it('resolves dynamic filesystems with the request context', async () => {
      const basePath = await tempDir();
      const requestContext = new RequestContext();
      const resolver = vi.fn(() => new LocalFilesystem({ basePath }));
      const workspace = new Workspace({ filesystem: resolver as any });
      const { parts } = await run(workspace, [file(BASE64)], requestContext);
      expect(resolver).toHaveBeenCalledWith(expect.objectContaining({ requestContext }));
      expect(new Uint8Array(await readFile(join(basePath, uploadedPath(parts[0].text))))).toEqual(BYTES);
    });

    it('falls back to sandbox.writeFiles when the workspace only has a sandbox', async () => {
      const writeFiles = vi.fn(async () => {});
      const workspace = { id: 'w', name: 'w', sandbox: { writeFiles } } as unknown as AnyWorkspace;
      const { parts } = await run(workspace, [file(BASE64)]);
      const path = uploadedPath(parts[0].text);
      expect(writeFiles).toHaveBeenCalledWith([{ path, content: Buffer.from(BYTES) }]);
    });

    describe('given a sandbox-only workspace whose sandbox has no writeFiles', () => {
      /** A sandbox that really runs `sh -c` in a temp directory, optionally with extra PATH entries first. */
      async function shellSandbox(options: { pathPrefix?: string; failWhen?: (script: string) => boolean } = {}) {
        const cwd = await tempDir();
        const scripts: string[] = [];
        const executeCommand = vi.fn(async (command: string, args: string[] = []) => {
          const script = args[1] ?? '';
          scripts.push(script);
          if (options.failWhen?.(script)) {
            return { success: false, exitCode: 1, stdout: '', stderr: 'boom', executionTimeMs: 0 };
          }
          const { spawnSync } = await import('node:child_process');
          const env = { ...process.env, PATH: [options.pathPrefix, process.env.PATH].filter(Boolean).join(':') };
          const result = spawnSync(command, args, { cwd, env, encoding: 'utf8' });
          const exitCode = result.status ?? 1;
          return {
            success: exitCode === 0,
            exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            executionTimeMs: 0,
          };
        });
        const workspace = { id: 'w', name: 'w', sandbox: { executeCommand } } as unknown as AnyWorkspace;
        return { cwd, workspace, executeCommand, scripts };
      }

      it('writes the exact bytes through executeCommand', async () => {
        const { cwd, workspace, executeCommand } = await shellSandbox();
        const { parts } = await run(workspace, [file(BASE64)]);
        const path = uploadedPath(parts[0].text);
        expect(path).toMatch(/^uploads\/[0-9a-f-]{36}\/report\.xlsx$/);
        expect(new Uint8Array(await readFile(join(cwd, path)))).toEqual(BYTES);
        expect(executeCommand).toHaveBeenCalledWith('sh', ['-c', expect.any(String)]);
      });

      it('splits large files into several commands and reassembles them byte for byte', async () => {
        const { cwd, workspace, executeCommand } = await shellSandbox();
        const large = new Uint8Array(300_000).map((_, i) => (i * 7919) % 256);
        const { parts } = await run(workspace, [file(Buffer.from(large).toString('base64'))]);
        expect(executeCommand.mock.calls.length).toBeGreaterThan(3);
        expect(new Uint8Array(await readFile(join(cwd, uploadedPath(parts[0].text))))).toEqual(large);
      });

      it('leaves no temporary base64 file behind', async () => {
        const { cwd, workspace } = await shellSandbox();
        const { parts } = await run(workspace, [file(BASE64)]);
        const dir = uploadedPath(parts[0].text).replace(/\/[^/]+$/, '');
        expect(await readdir(join(cwd, dir))).toEqual(['report.xlsx']);
      });

      it('quotes filenames so shell metacharacters stay literal', async () => {
        const { cwd, workspace } = await shellSandbox();
        const { parts } = await run(workspace, [file(BASE64, "it's $(touch pwned) `x`.xlsx")]);
        expect(new Uint8Array(await readFile(join(cwd, uploadedPath(parts[0].text))))).toEqual(BYTES);
        expect(await readdir(cwd)).toEqual(['uploads']);
      });

      it('falls back to openssl when base64 cannot decode', async () => {
        const bin = await tempDir();
        const { writeFile, chmod } = await import('node:fs/promises');
        await writeFile(join(bin, 'base64'), '#!/bin/sh\nexit 1\n');
        await chmod(join(bin, 'base64'), 0o755);
        const { cwd, workspace } = await shellSandbox({ pathPrefix: bin });
        const { parts } = await run(workspace, [file(BASE64)]);
        expect(new Uint8Array(await readFile(join(cwd, uploadedPath(parts[0].text))))).toEqual(BYTES);
      });

      it('removes the upload directory and rethrows when a command fails', async () => {
        let calls = 0;
        const { cwd, workspace, scripts } = await shellSandbox({
          failWhen: script => !script.startsWith('rm ') && ++calls === 3,
        });
        const large = Buffer.alloc(200_000, 1).toString('base64');
        await expect(run(workspace, [file(large)])).rejects.toThrow(/boom/);
        expect(scripts.at(-1)).toMatch(/^rm -rf 'uploads\/[0-9a-f-]{36}'$/);
        expect(await readdir(join(cwd, 'uploads'))).toEqual([]);
      });

      it('removes files written for earlier attachments when a later one fails', async () => {
        const { cwd, workspace } = await shellSandbox({ failWhen: script => script.includes('b.xlsx') });
        await expect(run(workspace, [file(BASE64, 'a.xlsx'), file(BASE64, 'b.xlsx')])).rejects.toThrow();
        expect(await readdir(join(cwd, 'uploads'))).toEqual([]);
      });

      it('prefers writeFiles when the sandbox has both', async () => {
        const writeFiles = vi.fn(async () => {});
        const executeCommand = vi.fn();
        const workspace = { id: 'w', name: 'w', sandbox: { writeFiles, executeCommand } } as unknown as AnyWorkspace;
        await run(workspace, [file(BASE64)]);
        expect(writeFiles).toHaveBeenCalledOnce();
        expect(executeCommand).not.toHaveBeenCalled();
      });

      it('aborts without a workspace destination when the sandbox has neither writeFiles nor executeCommand', async () => {
        const workspace = { id: 'w', name: 'w', sandbox: {} } as unknown as AnyWorkspace;
        const { abort } = await run(workspace, [file(BASE64)]).catch(error => ({ abort: error }));
        expect(abort.options.metadata.code).toBe(WORKSPACE_REQUIRED_FOR_ATTACHMENT);
      });

      it('writes through a real LocalSandbox', async () => {
        const { LocalSandbox } = await import('../../workspace');
        const cwd = await tempDir();
        const workspace = new Workspace({ sandbox: new LocalSandbox({ workingDirectory: cwd }) });
        const { parts } = await run(workspace, [file(BASE64)]);
        expect(new Uint8Array(await readFile(join(cwd, uploadedPath(parts[0].text))))).toEqual(BYTES);
      });
    });

    it('deletes files written earlier in the call when a later write fails', async () => {
      const { basePath, workspace } = await localWorkspace();
      const fs = workspace.filesystem!;
      const original = fs.writeFile.bind(fs);
      let writes = 0;
      fs.writeFile = async (...args) => {
        if (++writes === 2) throw new Error('disk full');
        return original(...args);
      };
      await expect(run(workspace, [file(BASE64, 'a.xlsx'), file(BASE64, 'b.xlsx')])).rejects.toThrow('disk full');
      const uploads = await readdir(join(basePath, 'uploads')).catch(() => []);
      for (const dir of uploads) expect(await readdir(join(basePath, 'uploads', dir))).toEqual([]);
    });

    it('is a no-op on later steps once spreadsheets are replaced', async () => {
      const { workspace } = await localWorkspace();
      const { MessageList } = await import('../../agent/message-list');
      const messageList = new MessageList();
      messageList.add([{ role: 'user', content: [file(BASE64) as any] }], 'input');
      const processor = new WorkspaceAttachmentsProcessor({ workspace });
      const write = vi.spyOn(workspace.filesystem!, 'writeFile');
      const args = { messageList, requestContext: new RequestContext(), abort: vi.fn() } as any;
      await processor.processInputStep(args);
      await processor.processInputStep(args);
      expect(write).toHaveBeenCalledTimes(1);
    });
  });

  describe('through thread message APIs', () => {
    const target = (thread: string) => ({
      resourceId: 'user',
      threadId: thread,
      ifIdle: { streamOptions: { memory: { resource: 'user', thread } } },
    });
    const contents = [
      { type: 'text' as const, text: 'Summarize this' },
      { type: 'file' as const, data: BASE64, mediaType: XLSX, filename: 'report.xlsx' },
    ];

    it.each([
      ['sendSignal', (agent: Agent) => agent.sendSignal({ type: 'user-message', contents } as any, target('sig'))],
      ['sendMessage', (agent: Agent) => agent.sendMessage({ contents } as any, target('send') as any)],
      ['queueMessage', (agent: Agent) => agent.queueMessage({ contents } as any, target('queue') as any)],
    ])('routes spreadsheets sent with %s', async (_label, send) => {
      const { basePath, workspace } = await localWorkspace();
      const { agent, prompts } = agentWith(workspace, { memory: new MockMemory() });

      await (send(agent) as any).accepted;
      await vi.waitFor(() => expect(prompts.length).toBeGreaterThan(0), { timeout: 5000 });

      const prompt = prompts[0]!;
      expect(spreadsheetFileParts(prompt)).toHaveLength(0);
      const text = JSON.stringify(prompt);
      const path = text.match(/uploads\/[0-9a-f-]{36}\/report\.xlsx/)![0];
      expect(new Uint8Array(await readFile(join(basePath, path)))).toEqual(BYTES);
    });
  });

  it('encodes filenames with quotes and brackets so they round-trip', () => {
    const name = 'report "final" [v2].xlsx';
    const note = formatWorkspaceAttachmentNote(name, XLSX, 'uploads/x/y');
    expect(JSON.parse(note.match(/^\[Attachment ("(?:[^"\\]|\\.)*")/)![1]!)).toBe(name);
  });

  it('skips auto-wiring when the processor is already configured', async () => {
    const { workspace } = await localWorkspace();
    const custom = new WorkspaceAttachmentsProcessor({ workspace });
    const { agent } = agentWith(workspace, { inputProcessors: [custom] });
    const processors = await agent.listInputProcessors();
    const ids = JSON.stringify(processors, (_k, v) => (v instanceof Workspace ? undefined : v));
    expect(ids.match(/workspace-attachments-processor/g)?.length ?? 0).toBeGreaterThan(0);
  });
});
