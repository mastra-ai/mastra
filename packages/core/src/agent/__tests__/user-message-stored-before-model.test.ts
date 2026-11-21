/**
 * A person sends a message and reloads the page while the agent is still thinking. The reloaded
 * page reads thread history from storage, so the run has to store the message once it has taken
 * it: after the input processors accepted it and before the model is asked. A message the
 * processors block must never be stored.
 */
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { FGADeniedError } from '../../auth/ee/fga-check';
import type { IFGAProvider } from '../../auth/ee/interfaces/fga';
import { ModelRouterLanguageModel } from '../../llm/model/router';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';

vi.setConfig({ testTimeout: 20_000 });

const resourceId = 'stored-before-model-user';
const threadId = 'stored-before-model-thread';
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function textChunks(text: string) {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: `id-${text}`, modelId: 'mock', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage },
  ];
}

function toolCallChunks() {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id-tool', modelId: 'mock', timestamp: new Date(0) },
    { type: 'tool-call', toolCallId: 'call-1', toolName: 'wait', input: '{}' },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ];
}

function streamOf(chunks: unknown[]) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

type ScriptedResponse = { chunks?: unknown[]; error?: Error };

function promptText(prompt: unknown): string {
  return JSON.stringify(prompt);
}

function createHarness({
  blockText,
  blockIn = 'processInput',
  readOnly = false,
  fga,
  gatewayManaged = false,
  responses = [],
  tools,
  outputProcessors,
  inputProcessors,
}: {
  blockText?: string;
  blockIn?: 'processInput' | 'processInputStep' | 'processLLMRequest';
  readOnly?: boolean;
  fga?: IFGAProvider;
  gatewayManaged?: boolean;
  responses?: ScriptedResponse[];
  tools?: Record<string, ReturnType<typeof createTool>>;
  outputProcessors?: () => Processor[];
  inputProcessors?: Processor[];
} = {}) {
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });

  const storedUserTexts = async () => {
    const store = await storage.getStore('memory');
    const { messages } = await store!.listMessages({ threadId, perPage: false });
    return messages
      .filter(message => message.role === 'user' || message.role === 'signal')
      .map(message =>
        message.content.parts
          .filter(part => part.type === 'text')
          .map(part => (part as { text: string }).text)
          .join(''),
      );
  };

  const isBlocked = (text: string) => blockText !== undefined && text.includes(blockText);
  const blockingProcessor: Processor = {
    id: 'block-policy',
    ...(blockIn === 'processInput'
      ? {
          async processInput({ messages, abort }) {
            if (isBlocked(JSON.stringify(messages.at(-1)))) abort('blocked by policy');
            return messages;
          },
        }
      : blockIn === 'processInputStep'
        ? {
            async processInputStep({ messages, abort }) {
              if (isBlocked(JSON.stringify(messages.at(-1)))) abort('blocked by policy');
              return messages;
            },
          }
        : {
            async processLLMRequest({ prompt, abort }) {
              if (isBlocked(JSON.stringify(prompt.at(-1)))) abort('blocked by policy');
              return prompt;
            },
          }),
  } as Processor;

  /** What storage held, per model request, at the moment the model was asked. */
  const storedAtRequest: string[][] = [];
  const prompts: string[] = [];
  let call = 0;
  const model = new MockLanguageModelV2({
    doStream: async options => {
      storedAtRequest.push(await storedUserTexts());
      prompts.push(promptText(options.prompt));
      const response = responses[call++] ?? { chunks: textChunks('reply') };
      if (response.error) throw response.error;
      return { rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [], stream: streamOf(response.chunks!) };
    },
  });
  // A real gateway router answers the memory-ownership check; only its network call is scripted.
  let agentModel: MockLanguageModelV2 | ModelRouterLanguageModel = model;
  if (gatewayManaged) {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk_live_project_key');
    const router = new ModelRouterLanguageModel('mastra/openai/gpt-4o');
    Object.assign(router, { doStream: model.doStream.bind(model) });
    agentModel = router;
  }

  const agent = new Agent({
    id: 'stored-before-model-agent',
    name: 'Stored Before Model Agent',
    instructions: 'Reply briefly.',
    memory,
    model: agentModel,
    inputProcessors: inputProcessors ?? (blockText ? [blockingProcessor] : []),
    ...(outputProcessors ? { outputProcessors } : {}),
    ...(tools ? { tools } : {}),
  });
  const mastra = new Mastra({
    agents: { 'stored-before-model-agent': agent },
    logger: false,
    storage,
    ...(fga ? { server: { fga } } : {}),
  });

  const send = async (text: string, requestContext?: RequestContext) => {
    const output = await mastra.getAgent('stored-before-model-agent').stream(text, {
      memory: { resource: resourceId, thread: threadId, ...(readOnly ? { options: { readOnly: true } } : {}) },
      ...(requestContext ? { requestContext } : {}),
    });
    await output.consumeStream();
    return output;
  };

  return {
    agent: mastra.getAgent('stored-before-model-agent'),
    storage,
    memory,
    send,
    storedUserTexts,
    storedAtRequest,
    prompts,
  };
}

describe('a sent message is stored once the run has taken it', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('the message is in storage when the model is asked', async () => {
    const h = createHarness();

    await h.send('hello there');

    expect(h.storedAtRequest).toEqual([['hello there']]);
    expect(await h.storedUserTexts()).toEqual(['hello there']);
  });

  it('the message stays stored when the model request fails', async () => {
    const h = createHarness({ responses: [{ error: new Error('provider down') }] });

    await h.send('hello there').catch(() => {});

    expect(h.storedAtRequest).toEqual([['hello there']]);
    expect(await h.storedUserTexts()).toEqual(['hello there']);
  });

  it.each(['processInput', 'processInputStep', 'processLLMRequest'] as const)(
    'a message blocked in %s is never stored and never reaches the next prompt',
    async blockIn => {
      const h = createHarness({ blockText: 'forbidden', blockIn });

      await h.send('a forbidden request');
      expect(await h.storedUserTexts()).toEqual([]);

      await h.send('a fine request');
      expect(await h.storedUserTexts()).toEqual(['a fine request']);
      expect(h.prompts.at(-1)).not.toContain('forbidden');
    },
  );

  it('a reply blocked by an output processor leaves no message stored and out of the next prompt', async () => {
    let block = true;
    const blockReply: Processor = {
      id: 'block-reply',
      async processOutputResult({ messages, abort }) {
        if (block) abort('reply blocked');
        return messages;
      },
    };
    const h = createHarness({ outputProcessors: () => [blockReply] });

    await h.send('tell me the secret');
    block = false;
    expect(h.storedAtRequest).toEqual([['tell me the secret']]);
    expect(await h.storedUserTexts()).toEqual([]);

    await h.send('a fine request');
    expect(await h.storedUserTexts()).toEqual(['a fine request']);
    expect(h.prompts.at(-1)).not.toContain('secret');
  });

  it('a reply blocked while it streams keeps the message, stored once, as the turn save always has', async () => {
    const blockStep: Processor = {
      id: 'block-step',
      async processOutputStep({ messages, abort }) {
        abort('step blocked');
        return messages;
      },
    };
    const h = createHarness({ outputProcessors: () => [blockStep] });

    const output = await h.send('tell me the secret');

    expect(output.tripwire?.reason).toBe('step blocked');
    expect(h.storedAtRequest).toEqual([['tell me the secret']]);
    expect(await h.storedUserTexts()).toEqual(['tell me the secret']);
  });

  it('a run blocked by an input processor on a later step leaves no message stored', async () => {
    const blockSecondStep: Processor = {
      id: 'block-second-step',
      async processInputStep({ messages, stepNumber, abort }) {
        if (stepNumber > 0) abort('later step blocked');
        return messages;
      },
    };
    const wait = createTool({
      id: 'wait',
      description: 'Waits.',
      inputSchema: z.object({}),
      execute: async () => 'waited',
    });
    const h = createHarness({
      inputProcessors: [blockSecondStep],
      tools: { wait },
      responses: [{ chunks: toolCallChunks() }, { chunks: textChunks('never asked') }],
    });

    const output = await h.send('start working');

    expect(output.tripwire?.reason).toBe('later step blocked');
    expect(h.storedAtRequest).toEqual([['start working']]);
    expect(await h.storedUserTexts()).toEqual([]);
  });

  it('configured output processors are resolved once per run', async () => {
    let resolved = 0;
    const agent = new Agent({
      id: 'no-memory-agent',
      name: 'No Memory Agent',
      instructions: 'Reply briefly.',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: streamOf(textChunks('reply')),
        }),
      }),
      outputProcessors: () => {
        resolved++;
        return [];
      },
    });

    await (await agent.stream('hello there')).consumeStream();

    expect(resolved).toBe(1);
  });

  it('a message delivered mid-run is in storage before the model request that reads it', async () => {
    const toolStarted = deferred();
    const toolGate = deferred();
    const wait = createTool({
      id: 'wait',
      description: 'Waits.',
      inputSchema: z.object({}),
      execute: async () => {
        toolStarted.resolve();
        await toolGate.promise;
        return 'waited';
      },
    });
    const h = createHarness({
      tools: { wait },
      responses: [{ chunks: toolCallChunks() }, { chunks: textChunks('after steer') }],
    });

    const run = h.send('start working');
    await toolStarted.promise;
    const delivered = h.agent.sendMessage({ contents: 'change direction' }, { resourceId, threadId });
    expect((await delivered.accepted).action).toBe('deliver');
    toolGate.resolve();
    await run;

    expect(h.storedAtRequest[1]).toEqual(['start working', 'change direction']);
  });

  it('read-only memory stores nothing, before or after the model request', async () => {
    const h = createHarness({ readOnly: true });

    await h.send('hello there');

    expect(h.storedAtRequest).toEqual([[]]);
    expect(await h.storedUserTexts()).toEqual([]);
  });

  it('gateway-managed memory stores nothing before the model request', async () => {
    const h = createHarness({ gatewayManaged: true });

    await h.send('hello there');

    expect(h.storedAtRequest).toEqual([[]]);
    // Same as before this change: the turn save still stores it.
    expect(await h.storedUserTexts()).toEqual(['hello there']);
  });

  it('a denied memory write stores nothing before the model request', async () => {
    const fga: IFGAProvider = {
      check: vi.fn(async () => true),
      require: vi.fn(async (_user, input) => {
        if (input.permission === 'memory:write') {
          throw new FGADeniedError({ id: 'user-1' }, input.resource, input.permission);
        }
      }),
      filterAccessible: vi.fn(async (_user, resources) => resources),
    } as unknown as IFGAProvider;
    const h = createHarness({ fga });
    await h.memory.saveThread({
      thread: { id: threadId, resourceId, title: 'stored', createdAt: new Date(), updatedAt: new Date() },
    });
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'user-1' });

    await h.send('hello there', requestContext).catch(() => {});

    expect(h.storedAtRequest).toEqual([[]]);
    // Same as before this change: the turn save, which does not check MEMORY_WRITE, still stores it.
    expect(await h.storedUserTexts()).toEqual(['hello there']);
  });
});
