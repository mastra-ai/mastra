import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent, MessageList } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import type { MemoryConfig, WorkingMemoryTemplate } from '@mastra/core/memory';
import { WorkingMemory as WorkingMemoryProcessor } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from './index';

// Technical: agents get working memory from the core `WorkingMemory` input processor, which kept a private
// copy of the instruction text. Overriding the protected instruction methods on a `Memory` subclass changed
// `memory.getSystemMessage()` but never what the model received. (#29752)

const BUILT_IN_STORE_EVERYTHING = "If you're unsure whether to store something, store it";
const RESOURCE = 'user-1';

let llm: LLMock;

beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});
afterEach(() => {
  llm.clearFixtures();
  llm.clearRequests();
  llm.resetMatchCounts();
});
afterAll(async () => {
  await llm.stop();
});

type InstructionArgs = { template: WorkingMemoryTemplate; data: string | null };

/** A team's Memory subclass that tells the agent to keep only durable facts. */
class DurableFactsMemory extends Memory {
  readonly seen: Array<{ kind: string; format: string; data: string | null; autoUpdated?: boolean }> = [];

  protected override getWorkingMemoryToolInstruction({ template, data }: InstructionArgs): string {
    this.seen.push({ kind: 'tool', format: template.format, data });
    return `CUSTOM_WM (${template.format}): only store durable user facts, never one-off task details.\n${data ?? 'empty'}`;
  }

  protected override __experimental_getWorkingMemoryToolInstructionVNext({ template, data }: InstructionArgs): string {
    this.seen.push({ kind: 'vnext', format: template.format, data });
    return `CUSTOM_WM_VNEXT (${template.format}): only store durable user facts.\n${data ?? 'empty'}`;
  }

  protected override getReadOnlyWorkingMemoryInstruction({
    template,
    data,
    autoUpdated,
  }: InstructionArgs & { autoUpdated?: boolean }): string {
    this.seen.push({ kind: 'read-only', format: template.format, data, autoUpdated });
    return `CUSTOM_WM_READ_ONLY (autoUpdated: ${String(autoUpdated ?? false)}).\n${data ?? 'empty'}`;
  }
}

const markdownWorkingMemory = { enabled: true, template: '# Profile\n- Name:\n- Timezone:' } as const;
const schemaWorkingMemory = {
  enabled: true,
  schema: z.object({ name: z.string().optional(), timezone: z.string().optional() }),
} as const;
const vnextWorkingMemory = { enabled: true, template: '# Profile\n- Name:', version: 'vnext' } as const;

const configs = {
  markdown: { workingMemory: markdownWorkingMemory },
  schema: { workingMemory: schemaWorkingMemory },
  vnext: { workingMemory: vnextWorkingMemory },
  'read-only': { workingMemory: markdownWorkingMemory, readOnly: true },
  'app-managed': { workingMemory: { ...markdownWorkingMemory, agentManaged: false } },
} satisfies Record<string, MemoryConfig>;

type Case = keyof typeof configs;

function createMemory(MemoryClass: typeof Memory, config: MemoryConfig) {
  return new MemoryClass({
    storage: new InMemoryStore(),
    options: { lastMessages: 10, semanticRecall: false, generateTitle: false, ...config },
  });
}

function createAgent(memory: Memory) {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
  return new Agent({
    id: 'wm-agent',
    name: 'wm-agent',
    instructions: 'You are a helpful assistant.',
    model: openai.chat('wm-model'),
    memory,
  });
}

/** System prompt text the model received on its first request. */
function systemPromptSentToModel(): string {
  const requests = llm.getRequests().filter(req => (req.body as { model?: string })?.model === 'wm-model');
  expect(requests.length).toBeGreaterThan(0);
  const messages = (requests[0]!.body as { messages: Array<{ role: string; content: unknown }> }).messages;
  return messages
    .filter(message => message.role === 'system')
    .map(message => (typeof message.content === 'string' ? message.content : JSON.stringify(message.content)))
    .join('\n');
}

async function seedWorkingMemory(memory: Memory, threadId: string, workingMemory: string) {
  await memory.saveThread({
    thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
  });
  await memory.updateWorkingMemory({ threadId, resourceId: RESOURCE, workingMemory });
}

/** The instruction core's WorkingMemory processor renders with its own built-in text (no instruction provider). */
async function renderBuiltInInstruction(memory: Memory, config: MemoryConfig, threadId: string): Promise<string> {
  const processor = new WorkingMemoryProcessor({
    storage: (await memory.storage.getStore('memory'))!,
    templateProvider: memory,
    useVNext: config.workingMemory !== undefined && 'version' in config.workingMemory,
  });
  const requestContext = new RequestContext();
  requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId: RESOURCE, memoryConfig: config });
  const messageList = new MessageList();
  await processor.processInput({
    messages: [],
    messageList,
    requestContext,
    abort: () => {
      throw new Error('aborted');
    },
  });
  return messageList
    .getSystemMessages('memory')
    .map(message => String(message.content))
    .join('\n');
}

describe('Memory subclass working memory instruction reaches the agent (#29752)', () => {
  const overrideMarkers: Record<Case, { marker: string; kind: string; format: string; autoUpdated?: boolean }> = {
    markdown: { marker: 'CUSTOM_WM (markdown)', kind: 'tool', format: 'markdown' },
    schema: { marker: 'CUSTOM_WM (json)', kind: 'tool', format: 'json' },
    vnext: { marker: 'CUSTOM_WM_VNEXT (markdown)', kind: 'vnext', format: 'markdown' },
    'read-only': { marker: 'CUSTOM_WM_READ_ONLY (autoUpdated: false)', kind: 'read-only', format: 'markdown' },
    'app-managed': {
      marker: 'CUSTOM_WM_READ_ONLY (autoUpdated: true)',
      kind: 'read-only',
      format: 'markdown',
      autoUpdated: true,
    },
  };

  it.each(Object.keys(configs) as Case[])(
    'agent.generate sends the overridden instruction to the model (%s working memory)',
    async name => {
      llm.on({ endpoint: 'chat' }, { content: 'ok' });
      const memory = createMemory(DurableFactsMemory, configs[name]) as DurableFactsMemory;
      const threadId = `thread-${name}`;
      const stored = name === 'schema' ? '{"name":"Ada"}' : '# Profile\n- Name: Ada';
      await seedWorkingMemory(memory, threadId, stored);

      await createAgent(memory).generate('I am searching Drive for the Q3 report', {
        memory: { thread: threadId, resource: RESOURCE },
      });

      const system = systemPromptSentToModel();
      const expected = overrideMarkers[name];
      expect(system).toContain(expected.marker);
      // The override is given the stored working memory, so it can still render it.
      expect(system).toContain(stored);
      expect(system).not.toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
      expect(system).not.toContain(BUILT_IN_STORE_EVERYTHING);
      expect(memory.seen).toContainEqual(
        expect.objectContaining({ kind: expected.kind, format: expected.format, data: stored }),
      );
      if (expected.kind === 'read-only') {
        expect(memory.seen.find(call => call.kind === 'read-only')?.autoUpdated ?? false).toBe(
          expected.autoUpdated ?? false,
        );
      }
      // memory.getSystemMessage() renders the same overridden instruction the agent sent.
      expect(system.match(/CUSTOM_WM/g)).toHaveLength(1);
      const fromMemory = await memory.getSystemMessage({ threadId, resourceId: RESOURCE });
      expect(fromMemory).toContain(expected.marker);
      expect(system).toContain(fromMemory!);
    },
  );

  it('agent.stream sends the overridden instruction to the model', async () => {
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const memory = createMemory(DurableFactsMemory, configs.markdown) as DurableFactsMemory;
    const stored = '# Profile\n- Name: Ada';
    await seedWorkingMemory(memory, 'thread-stream', stored);

    const stream = await createAgent(memory).stream('hello', {
      memory: { thread: 'thread-stream', resource: RESOURCE },
    });
    await stream.consumeStream();

    const system = systemPromptSentToModel();
    expect(system).toContain('CUSTOM_WM (markdown)');
    expect(system).toContain(stored);
    expect(system).not.toContain(BUILT_IN_STORE_EVERYTHING);
    expect(memory.seen).toContainEqual(expect.objectContaining({ kind: 'tool', format: 'markdown', data: stored }));
  });

  it.each(
    (['durable', 'evented'] as const).flatMap(engine =>
      (Object.keys(configs) as Case[]).map(name => [engine, name] as const),
    ),
  )('a %s agent sends the overridden instruction to the model (%s working memory)', async (engine, name) => {
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const memory = createMemory(DurableFactsMemory, configs[name]) as DurableFactsMemory;
    const threadId = `thread-${engine}-${name}`;
    const stored = name === 'schema' ? '{"name":"Ada"}' : '# Profile\n- Name: Ada';
    await seedWorkingMemory(memory, threadId, stored);
    const agent = createAgent(memory);
    const durable =
      engine === 'evented'
        ? createEventedAgent({ agent, pubsub: new EventEmitterPubSub() })
        : createDurableAgent({ agent });
    const mastra = new Mastra({ storage: new InMemoryStore(), logger: false, agents: { agent: durable } });
    try {
      const stream = await durable.stream('hello', { memory: { thread: threadId, resource: RESOURCE } });
      for await (const _event of stream.fullStream) {
        // drain
      }

      const system = systemPromptSentToModel();
      const expected = overrideMarkers[name];
      expect(system).toContain(expected.marker);
      expect(system).toContain(stored);
      expect(system).not.toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
      expect(memory.seen).toContainEqual(
        expect.objectContaining({ kind: expected.kind, format: expected.format, data: stored }),
      );
      if (expected.kind === 'read-only') {
        expect(memory.seen.find(call => call.kind === 'read-only')?.autoUpdated ?? false).toBe(
          expected.autoUpdated ?? false,
        );
      }
    } finally {
      await mastra.stopWorkers();
    }
  });

  it.each(Object.keys(configs) as Case[])(
    'without an override, the agent sends the same instruction memory.getSystemMessage() renders (%s working memory)',
    async name => {
      llm.on({ endpoint: 'chat' }, { content: 'ok' });
      const memory = createMemory(Memory, configs[name]);
      const threadId = `thread-default-${name}`;
      const stored = name === 'schema' ? '{"name":"Ada"}' : '# Profile\n- Name: Ada';
      await seedWorkingMemory(memory, threadId, stored);

      await createAgent(memory).generate('hello', { memory: { thread: threadId, resource: RESOURCE } });

      const expected = await memory.getSystemMessage({ threadId, resourceId: RESOURCE });
      expect(expected).toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
      expect(expected).toContain(stored);
      expect(systemPromptSentToModel()).toContain(expected!);
      // And it is the same text core's processor renders on its own, so the defaults did not change.
      const builtIn = await renderBuiltInInstruction(memory, configs[name], threadId);
      expect(builtIn).toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
      expect(expected).toBe(builtIn);
      expect(systemPromptSentToModel()).toContain(builtIn);
      expect(systemPromptSentToModel().match(/WORKING_MEMORY_SYSTEM_INSTRUCTION/g)).toHaveLength(1);
      if (name === 'markdown' || name === 'schema') {
        expect(systemPromptSentToModel()).toContain(BUILT_IN_STORE_EVERYTHING);
      }
    },
  );
});

describe('vnext working memory with a JSON template object (#29752)', () => {
  // Technical: a getWorkingMemoryTemplate override may return JSON content as an object. The vnext
  // instruction must serialize it, not render "[object Object]", now that the agent uses Memory's renderer.
  class ObjectTemplateMemory extends Memory {
    override async getWorkingMemoryTemplate(): Promise<WorkingMemoryTemplate> {
      return {
        format: 'json',
        content: { type: 'object', properties: { favoriteColor: { type: 'string' } } },
      };
    }
  }

  it('the model receives the template schema', async () => {
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const memory = createMemory(ObjectTemplateMemory, configs.vnext);

    await createAgent(memory).generate('hello', { memory: { thread: 'thread-object-template', resource: RESOURCE } });

    const system = systemPromptSentToModel();
    expect(system).toContain('"favoriteColor":{"type":"string"}');
    expect(system).not.toContain('[object Object]');
  });
});

describe('instruction overrides outside the system-message path (#29752)', () => {
  it('an override that returns an empty string sends no working memory instruction', async () => {
    class NoInstructionMemory extends Memory {
      protected override getWorkingMemoryToolInstruction(): string {
        return '';
      }
    }
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const memory = createMemory(NoInstructionMemory, configs.markdown);
    await seedWorkingMemory(memory, 'thread-empty', '# Profile\n- Name: Ada');

    await createAgent(memory).generate('hello', { memory: { thread: 'thread-empty', resource: RESOURCE } });

    const system = systemPromptSentToModel();
    expect(system).toContain('You are a helpful assistant.');
    expect(system).not.toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
    expect(system).not.toContain('- Name: Ada');
    expect(await memory.getSystemMessage({ threadId: 'thread-empty', resourceId: RESOURCE })).toBeNull();
  });

  it('a getWorkingMemoryInstruction override that returns undefined keeps the built-in instruction', async () => {
    class BuiltInMemory extends Memory {
      override getWorkingMemoryInstruction(): string | undefined {
        return undefined;
      }
    }
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const memory = createMemory(BuiltInMemory, configs.markdown);
    await seedWorkingMemory(memory, 'thread-undefined', '# Profile\n- Name: Ada');

    await createAgent(memory).generate('hello', { memory: { thread: 'thread-undefined', resource: RESOURCE } });

    const fromMemory = await memory.getSystemMessage({ threadId: 'thread-undefined', resourceId: RESOURCE });
    expect(fromMemory).toContain(BUILT_IN_STORE_EVERYTHING);
    expect(fromMemory).toContain('- Name: Ada');
    expect(systemPromptSentToModel()).toContain(fromMemory!);
  });

  it('returning undefined uses the built-in text in both paths, even with an instruction method override', async () => {
    class MixedMemory extends DurableFactsMemory {
      override getWorkingMemoryInstruction(): string | undefined {
        return undefined;
      }
    }
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const memory = createMemory(MixedMemory, configs.markdown);
    await seedWorkingMemory(memory, 'thread-mixed', '# Profile\n- Name: Ada');

    await createAgent(memory).generate('hello', { memory: { thread: 'thread-mixed', resource: RESOURCE } });

    const fromMemory = await memory.getSystemMessage({ threadId: 'thread-mixed', resourceId: RESOURCE });
    expect(fromMemory).toContain(BUILT_IN_STORE_EVERYTHING);
    expect(fromMemory).not.toContain('CUSTOM_WM');
    expect(systemPromptSentToModel()).toContain(fromMemory!);
    expect(systemPromptSentToModel()).not.toContain('CUSTOM_WM');
  });

  it('with useStateSignals the instruction methods are not used', async () => {
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const memory = createMemory(DurableFactsMemory, {
      workingMemory: { ...markdownWorkingMemory, useStateSignals: true },
    }) as DurableFactsMemory;

    await createAgent(memory).generate('hello', { memory: { thread: 'thread-signals', resource: RESOURCE } });

    expect(systemPromptSentToModel()).not.toContain('CUSTOM_WM');
    expect(memory.seen).toEqual([]);
  });
});
