import { createHash } from 'node:crypto';
import { APICallError, UnsupportedFunctionalityError } from '@ai-sdk/provider-v5';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable/create-durable-agent';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage';
import type { SandboxFileInput, WorkspaceSandbox } from '../workspace/sandbox/sandbox';
import { Workspace } from '../workspace/workspace';
import type { WorkspaceSandboxResolver } from '../workspace/workspace';

const MEMORY = { thread: 'unsupported-file-thread', resource: 'unsupported-file-resource' };
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

type Rejection = (prompt: LanguageModelV2Prompt) => Error | undefined;

const userFileParts = (prompt: LanguageModelV2Prompt) =>
  prompt.flatMap(message => (message.role === 'user' ? message.content : [])).filter(part => part.type === 'file');
const userTexts = (prompt: LanguageModelV2Prompt) =>
  prompt
    .flatMap(message => (message.role === 'user' ? message.content : []))
    .flatMap(part => (part.type === 'text' ? [part.text] : []));

/** Rejects, like the OpenAI and Anthropic SDKs do before sending, any prompt holding a file of these types. */
const rejectsTypes =
  (...mediaTypes: string[]): Rejection =>
  prompt => {
    const rejected = userFileParts(prompt).find(part => mediaTypes.includes(part.mediaType));
    return rejected
      ? new UnsupportedFunctionalityError({ functionality: `file part media type ${rejected.mediaType}` })
      : undefined;
  };

function createModel(reject: Rejection) {
  const prompts: LanguageModelV2Prompt[] = [];
  const check = (prompt: LanguageModelV2Prompt) => {
    prompts.push(prompt);
    const error = reject(prompt);
    if (error) throw error;
  };
  const model = new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      check(prompt);
      return { content: [{ type: 'text', text: 'ok' }], finishReason: 'stop', usage, warnings: [] };
    },
    doStream: async ({ prompt }) => {
      check(prompt);
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'ok' });
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
            controller.close();
          },
        }),
      };
    },
  });
  return { model, prompts };
}

/** Sandbox double with the `writeFiles` fast path; records every write. */
function createFakeSandbox(overrides: Partial<Pick<WorkspaceSandbox, 'writeFiles'>> = {}) {
  const writes: SandboxFileInput[][] = [];
  const sandbox = {
    id: 'fake-sandbox',
    name: 'Fake Sandbox',
    provider: 'fake',
    status: 'running',
    snapshot: async () => {},
    writeFiles: async (files: SandboxFileInput[]) => {
      writes.push(files);
    },
    executeCommand: async () => ({ success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 0 }),
    ...overrides,
  } as unknown as WorkspaceSandbox;
  return { sandbox, writes };
}

function createAgent(
  reject: Rejection,
  options: { errorProcessorDefaults?: false; sandbox?: WorkspaceSandbox | WorkspaceSandboxResolver } = {},
) {
  const { model, prompts } = createModel(reject);
  const memory = new MockMemory();
  const { sandbox, ...agentOptions } = options;
  const agent = new Agent({
    id: 'unsupported-file-agent',
    name: 'unsupported-file-agent',
    instructions: 'Answer briefly.',
    model,
    memory,
    ...(sandbox ? { workspace: new Workspace({ sandbox }) } : {}),
    ...agentOptions,
  });
  const recall = async () => (await memory.recall({ threadId: MEMORY.thread, resourceId: MEMORY.resource })).messages;
  return { agent, prompts, memory, recall };
}

/** The 8-byte signature of a PNG file, so the image passes Mastra's check of image content. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const file = (bytes: string | Buffer, filename: string | undefined, mediaType: string) => ({
  type: 'file' as const,
  data: Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes),
  mediaType,
  ...(filename ? { filename } : {}),
});
const turnWith = (...files: Array<ReturnType<typeof file>>) => [
  { role: 'user' as const, content: [{ type: 'text' as const, text: 'Read these' }, ...files] },
];

/** The placeholder Mastra also uses for an attachment it can't use; a file without a name shows its type. */
const unsentNote = (name: string) => `[Attachment unavailable: ${name}]`;

const run = async (agent: Agent, mode: 'generate' | 'stream', input: Parameters<Agent['generate']>[0]) => {
  if (mode === 'generate') return (await agent.generate(input, { memory: MEMORY })).text;
  const output = await agent.stream(input, { memory: MEMORY });
  return (await output.getFullOutput()).text;
};

describe('UnsupportedFileHandler, a default error processor of every agent', () => {
  describe.each(['generate', 'stream'] as const)('with %s()', mode => {
    it('replaces a file the model rejects with a note, and calls the model again', async () => {
      const { agent, prompts } = createAgent(rejectsTypes(XLSX));

      const text = await run(agent, mode, turnWith(file('PK workbook', 'leads.xlsx', XLSX)));

      expect(text).toBe('ok');
      expect(prompts).toHaveLength(2);
      expect(userFileParts(prompts[0]!)).toMatchObject([{ mediaType: XLSX, filename: 'leads.xlsx' }]);
      expect(userFileParts(prompts[1]!)).toEqual([]);
      expect(userTexts(prompts[1]!)).toEqual(['Read these', unsentNote('leads.xlsx')]);
    });

    it('sends a file the model accepts unchanged, in a single call', async () => {
      const { agent, prompts } = createAgent(rejectsTypes(XLSX));

      const text = await run(agent, mode, turnWith(file('%PDF report', 'report.pdf', 'application/pdf')));

      expect(text).toBe('ok');
      expect(prompts).toHaveLength(1);
      expect(userFileParts(prompts[0]!)).toMatchObject([{ mediaType: 'application/pdf', filename: 'report.pdf' }]);
    });
  });

  it('keeps the images, PDFs, and text files of the request when it replaces the rejected one', async () => {
    const { agent, prompts } = createAgent(rejectsTypes(XLSX));

    await agent.generate(
      turnWith(
        file('PK workbook', 'leads.xlsx', XLSX),
        file('%PDF report', 'report.pdf', 'application/pdf'),
        file(PNG, 'chart.png', 'image/png'),
        file('a,b', 'data.csv', 'text/csv'),
      ),
      { memory: MEMORY },
    );

    expect(userFileParts(prompts.at(-1)!).map(part => part.mediaType)).toEqual([
      'application/pdf',
      'image/png',
      'text/csv',
    ]);
  });

  it('replaces every other file type the model may not read too, since it only tries again once', async () => {
    const { agent, prompts } = createAgent(rejectsTypes(XLSX, 'application/zip'));

    const result = await agent.generate(
      turnWith(file('PK workbook', 'leads.xlsx', XLSX), file('PK archive', undefined, 'application/zip')),
      { memory: MEMORY },
    );

    expect(result.text).toBe('ok');
    expect(prompts).toHaveLength(2);
    expect(userTexts(prompts[1]!)).toEqual(['Read these', unsentNote('leads.xlsx'), unsentNote('application/zip')]);
  });

  it('keeps the rejected file in the stored message', async () => {
    const { agent, recall } = createAgent(rejectsTypes(XLSX));

    await agent.generate(turnWith(file('PK workbook', 'leads.xlsx', XLSX)), { memory: MEMORY });

    const stored = (await recall()).find(message => message.role === 'user');
    expect(stored?.content.parts.map(part => part.type)).toEqual(['text', 'file']);
  });

  it('recovers a thread that already stores a file the model rejects, on every turn', async () => {
    const { agent, prompts, memory } = createAgent(rejectsTypes(XLSX));
    await memory.createThread({ threadId: MEMORY.thread, resourceId: MEMORY.resource });
    await memory.saveMessages({
      messages: [
        {
          id: 'stored-xlsx',
          role: 'user',
          type: 'text',
          threadId: MEMORY.thread,
          resourceId: MEMORY.resource,
          createdAt: new Date(Date.now() - 10_000),
          content: {
            format: 2,
            parts: [
              {
                type: 'file',
                data: `data:${XLSX};base64,${Buffer.from('PK stored').toString('base64')}`,
                mimeType: XLSX,
                filename: 'old.xlsx',
              },
            ],
          },
        },
      ],
    });

    const first = await agent.generate('Hello', { memory: MEMORY });
    const second = await agent.generate('Hello again', { memory: MEMORY });

    expect([first.text, second.text]).toEqual(['ok', 'ok']);
    expect(prompts).toHaveLength(4);
    expect(userTexts(prompts[1]!)).toContain(unsentNote('old.xlsx'));
    expect(userTexts(prompts[3]!)).toContain(unsentNote('old.xlsx'));
  });

  // A provider can reject a file in its HTTP response with no file-specific text, like Gemini's 502.
  describe('when the provider rejects the request over HTTP', () => {
    const httpError = () =>
      new APICallError({
        message: '[Google AI Studio] An internal error has occurred',
        url: 'https://example.com/v1/chat',
        requestBodyValues: {},
        statusCode: 502,
        isRetryable: false,
      });
    const rejectsOverHttp =
      (...mediaTypes: string[]): Rejection =>
      prompt =>
        userFileParts(prompt).some(part => mediaTypes.includes(part.mediaType)) ? httpError() : undefined;

    it('replaces a file the model may not read, and calls the model again', async () => {
      const { agent, prompts } = createAgent(rejectsOverHttp(XLSX));

      const result = await agent.generate(turnWith(file('PK workbook', 'leads.xlsx', XLSX)), { memory: MEMORY });

      expect(result.text).toBe('ok');
      expect(prompts).toHaveLength(2);
      expect(userTexts(prompts[1]!)).toEqual(['Read these', unsentNote('leads.xlsx')]);
    });

    it('keeps the next text-only turn of the thread working', async () => {
      const { agent, prompts } = createAgent(rejectsOverHttp(XLSX));

      await agent.generate(turnWith(file('PK workbook', 'leads.xlsx', XLSX)), { memory: MEMORY });
      const next = await agent.generate('Just say hi', { memory: MEMORY });

      expect(next.text).toBe('ok');
      expect(userTexts(prompts.at(-1)!)).toContain(unsentNote('leads.xlsx'));
    });

    it('leaves the error alone when the request holds no file the model may not read', async () => {
      const { agent, prompts } = createAgent(() => httpError());

      await expect(
        agent.generate(turnWith(file('%PDF report', 'report.pdf', 'application/pdf')), { memory: MEMORY }),
      ).rejects.toThrow('An internal error has occurred');
      expect(prompts).toHaveLength(1);
    });
  });

  it('leaves a rejection that is not about a file alone', async () => {
    const { agent, prompts } = createAgent(
      () => new UnsupportedFunctionalityError({ functionality: 'tool choice type: required' }),
    );

    await expect(agent.generate(turnWith(file('PK workbook', 'leads.xlsx', XLSX)), { memory: MEMORY })).rejects.toThrow(
      'tool choice type: required',
    );
    expect(prompts).toHaveLength(1);
  });

  it('tries again only once, so a rejection the note does not fix still fails', async () => {
    const { agent, prompts } = createAgent(
      () => new UnsupportedFunctionalityError({ functionality: `file part media type ${XLSX}` }),
    );

    await expect(agent.generate(turnWith(file('PK workbook', 'leads.xlsx', XLSX)), { memory: MEMORY })).rejects.toThrow(
      `file part media type ${XLSX}`,
    );
    expect(prompts).toHaveLength(2);
  });

  it('does nothing for an agent that turns the default error processors off', async () => {
    const { agent, prompts } = createAgent(rejectsTypes(XLSX), { errorProcessorDefaults: false });

    await expect(agent.generate(turnWith(file('PK workbook', 'leads.xlsx', XLSX)), { memory: MEMORY })).rejects.toThrow(
      `file part media type ${XLSX}`,
    );
    expect(prompts).toHaveLength(1);
  });

  describe('when the agent has a sandbox', () => {
    const workbook = 'PK workbook';
    const uploadedNote = (path: string) =>
      [
        '[File uploaded to the sandbox]',
        `path: ${path}`,
        'name: leads.xlsx',
        `type: ${XLSX}`,
        `size: ${workbook.length} bytes`,
      ].join('\n');
    const workbookPath = `uploads/${MEMORY.thread}/${createHash('sha256').update(workbook).digest('hex')}.xlsx`;

    it('uploads the rejected file to the sandbox and gives the model its path instead', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent, prompts, recall } = createAgent(rejectsTypes(XLSX), { sandbox });

      const result = await agent.generate(turnWith(file(workbook, 'leads.xlsx', XLSX)), { memory: MEMORY });

      expect(result.text).toBe('ok');
      expect(writes.flat().map(written => written.content.toString())).toEqual([workbook]);
      expect(userTexts(prompts[1]!)).toEqual(['Read these', uploadedNote(workbookPath)]);
      const stored = (await recall()).find(message => message.role === 'user');
      expect(stored?.content.parts.map(part => part.type)).toEqual(['text', 'file']);
    });

    it('uploads the rejected file on a durable agent too', async () => {
      const { sandbox, writes } = createFakeSandbox();
      const { agent, prompts } = createAgent(rejectsTypes(XLSX), { sandbox });
      void new Mastra({ agents: { 'unsupported-file-agent': agent }, storage: new InMemoryStore() });
      const pubsub = new EventEmitterPubSub();

      try {
        const result = await createDurableAgent({ agent, pubsub }).stream(
          turnWith(file(workbook, 'leads.xlsx', XLSX)),
          {
            memory: MEMORY,
            maxSteps: 1,
          },
        );
        for await (const _chunk of result.fullStream) {
          // drain
        }
      } finally {
        await pubsub.close();
      }

      expect(writes.flat().map(written => written.content.toString())).toEqual([workbook]);
      expect(userTexts(prompts.at(-1)!)).toEqual(['Read these', uploadedNote(workbookPath)]);
    });

    it('falls back to a note when the workspace resolves no sandbox', async () => {
      const { agent, prompts } = createAgent(rejectsTypes(XLSX), {
        sandbox: (() => undefined) as unknown as WorkspaceSandboxResolver,
      });

      const result = await agent.generate(turnWith(file(workbook, 'leads.xlsx', XLSX)), { memory: MEMORY });

      expect(result.text).toBe('ok');
      expect(userTexts(prompts[1]!)).toEqual(['Read these', unsentNote('leads.xlsx')]);
    });

    it('falls back to a note when the upload fails, without stopping the turn', async () => {
      const { sandbox } = createFakeSandbox({
        writeFiles: async () => {
          throw new Error('disk full');
        },
      });
      const { agent, prompts } = createAgent(rejectsTypes(XLSX), { sandbox });

      const result = await agent.generate(turnWith(file(workbook, 'leads.xlsx', XLSX)), { memory: MEMORY });

      expect(result.text).toBe('ok');
      expect(result.tripwire).toBeUndefined();
      expect(userTexts(prompts[1]!)).toEqual(['Read these', unsentNote('leads.xlsx')]);
    });
  });
});
