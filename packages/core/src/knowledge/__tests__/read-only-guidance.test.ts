import { createHash } from 'node:crypto';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { setRunAgentScopes } from '../../agent/scopes';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { PinnedStateProcessor } from '../pinned-state-processor';

const EDIT_GUIDANCE = /\bedit|write back|knowledge_page|knowledge_note|expectedVersion/i;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

const scopes = { 'team:$id': {} };

function pinnedGuidance(processor: PinnedStateProcessor): string {
  const result = processor.processInput({ messages: [], systemMessages: [] } as any) as any;
  return result.systemMessages.at(-1).content;
}

const deps = { principalsKey: () => '', readPins: async () => [] };

const TOOL_NAME = /\bknowledge_[a-z]+\b/g;

/** Runs one turn and returns the tools the model was handed and every tool name its prompt mentions. */
async function probe(id: string, tools: { read?: boolean; write?: boolean } | false) {
  let seen: { prompt: any[]; tools: any[] } | undefined;
  const agent = new Agent({
    id,
    name: id,
    instructions: 'You answer questions.',
    model: new MockLanguageModelV2({
      doGenerate: async ({ prompt, tools }) => {
        seen ??= { prompt: prompt as any[], tools: tools ?? [] };
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text' as const, text: 'Hi.' }],
          warnings: [],
        };
      },
    }),
    memory: new MockMemory(),
    knowledge: new Knowledge({
      storage: new InMemoryStore({ id }),
      scopes: knowledgeMemoryScopes(),
      tools,
      pinnedContext: true,
    }),
    scopes: ['org:acme'],
  });
  await agent.generate('Hi', { memory: { thread: 'thread-1', resource: 'user-1' } });
  const system = seen!.prompt
    .filter(message => message.role === 'system')
    .map(message => message.content)
    .join('\n');
  const registered = seen!.tools.map(tool => tool.name).sort();
  const promptText = [system, ...seen!.tools.map(tool => JSON.stringify(tool))].join('\n');
  const named = [...new Set(promptText.match(TOOL_NAME) ?? [])].sort();
  return { system, registered, named };
}

describe('Knowledge guidance for an agent without read tools', () => {
  it('gives a write-only agent pinned guidance that names only the tools it has', async () => {
    const { system, registered, named } = await probe('write-only', { write: true });
    expect(registered).toEqual(['knowledge_note', 'knowledge_page', 'knowledge_pin']);
    expect(system).toContain('To edit it, write from that body and pass that ref and version to knowledge_page');
    expect(system).not.toMatch(/knowledge_read|knowledge_search|knowledge_list/);
    expect(named.filter(name => !registered.includes(name))).toEqual([]);
  });

  it('gives a pinned-only agent excerpt guidance and names only knowledge_pin', async () => {
    const { system, registered, named } = await probe('pinned-only', false);
    expect(registered).toEqual(['knowledge_pin']);
    expect(system).toContain(
      'This pinned page is an excerpt. Use it as context, but do not treat it as the full page or use it to replace the page body.',
    );
    expect(system).not.toMatch(EDIT_GUIDANCE);
    expect(named).toEqual(['knowledge_pin']);
  });

  it('names knowledge_read and knowledge_search in pinned guidance only when read is on', () => {
    for (const write of [true, false]) {
      expect(pinnedGuidance(new PinnedStateProcessor({ ...deps, read: false, write }))).not.toMatch(
        /knowledge_read|knowledge_search/,
      );
      expect(pinnedGuidance(new PinnedStateProcessor({ ...deps, read: true, write }))).toContain(
        'Do not knowledge_search or knowledge_read a pinned page to confirm it.',
      );
    }
  });
});

describe('Knowledge guidance for an agent without write tools', () => {
  it('leaves edit guidance out of the instructions when only read tools are handed out', () => {
    const knowledge = new Knowledge({ scopes, tools: { read: true } });
    const options = { write: false, pinnedContext: false };
    expect(Object.keys(knowledge.createTools(options)).sort()).toEqual([
      'knowledge_list',
      'knowledge_read',
      'knowledge_search',
    ]);
    const instructions = knowledge.getInstructions(options);
    expect(instructions).toContain('answer from their bodies without searching for or reading them again. Read a');
    expect(instructions).not.toMatch(EDIT_GUIDANCE);
    expect(knowledge.createTools(options).knowledge_read!.description).not.toMatch(EDIT_GUIDANCE);
  });

  it('leaves edit guidance out of the pinned-context system message when write is false', () => {
    expect(pinnedGuidance(new PinnedStateProcessor({ ...deps, write: false }))).not.toMatch(EDIT_GUIDANCE);
    expect(pinnedGuidance(new PinnedStateProcessor({ ...deps, write: true }))).toContain('To edit it, write');
  });

  it('keeps write-enabled guidance byte-identical, with and without the write flag', () => {
    const knowledge = new Knowledge({ scopes: {}, tools: true, pinnedContext: true });
    expect(sha(knowledge.getInstructions())).toBe('362be6d8c07098e2d5a0d9be0ddaccd101704b37755fd84268ad51eccd1f7a38');
    expect(sha(knowledge.getInstructions({ pinnedContext: false }))).toBe(
      '2acc14ae3e460e441be881b0d17314e15916ec65a97851cc633230abc0bd56b2',
    );
    const preamble = '916ebf0f1ebead5a7eda8a76cafae9f44afacf47cad0af8dadf012befb950326';
    expect(sha(pinnedGuidance(new PinnedStateProcessor(deps)))).toBe(preamble);
    expect(sha(pinnedGuidance(new PinnedStateProcessor({ ...deps, write: true })))).toBe(preamble);
    expect(sha(pinnedGuidance(new PinnedStateProcessor({ ...deps, read: true, write: true })))).toBe(preamble);
    const tools = knowledge.createTools();
    expect(sha(tools.knowledge_read!.description!)).toBe(
      '692561e732c23e2a1af8cb11ce765ec39c795b30503dbe0e3c7e37ece6f582ba',
    );
    expect(sha(tools.knowledge_page!.description!)).toBe(
      '3967b4fb4cce10cccbb67254ab53cdeee32d558095fb359e9265052879c66a9f',
    );
    expect(sha(JSON.stringify((tools.knowledge_page as any).inputSchema))).toBe(
      'c84acb585d2dd6fccc638eb9af4723e166ebae3530a2d6f35b2c8a0d6538dd0f',
    );
    expect(sha(tools.knowledge_pin!.description!)).toBe(
      '42c38c1b671ed6aab2f2f3ba7671235a3c9c64865f7ef7f7fec4591d8c6ba881',
    );
  });

  it('leaves the edit hint out of a long page read only when write tools are off', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore(), scopes: knowledgeMemoryScopes(), tools: true });
    const lines: string[] = [];
    for (let i = 0; i < 12; i++) lines.push(`## Part ${i}`, '', 'Lorem ipsum dolor sit amet. '.repeat(400), '');
    await knowledge.upsertPage({ scope: 'org:acme', path: 'long', name: 'Long', body: lines.join('\n') });
    const firstMore = async (write: boolean) => {
      const requestContext = new RequestContext();
      setRunAgentScopes(requestContext, ['org:acme']);
      const read = knowledge.createTools({ write }).knowledge_read!;
      const result = (await read.execute!(
        { page: 'org:acme#long' } as never,
        {
          requestContext,
          agent: { agentId: 'a' },
        } as never,
      )) as any;
      return result.more[0] as string;
    };
    const withWrite = await firstMore(true);
    expect(withWrite).toMatch(/shows every heading and the first lines under it/);
    expect(withWrite).toContain('To edit, read that part first: this view has no range to write back.');
    const readOnly = await firstMore(false);
    expect(readOnly).toBe(
      withWrite.replace(' To edit, read that part first: this view has no range to write back.', ''),
    );
    expect(readOnly).not.toMatch(EDIT_GUIDANCE);
  });

  it('sends a read-only agent with pinned context no edit guidance in its prompt', async () => {
    const prompts: any[][] = [];
    const toolNames: string[][] = [];
    const agent = new Agent({
      id: 'reader',
      name: 'reader',
      instructions: 'You answer questions.',
      model: new MockLanguageModelV2({
        doGenerate: async ({ prompt, tools }) => {
          prompts.push(prompt as any[]);
          toolNames.push((tools ?? []).map(tool => tool.name).sort());
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            content: [{ type: 'text' as const, text: 'Hi.' }],
            warnings: [],
          };
        },
      }),
      memory: new MockMemory(),
      knowledge: new Knowledge({
        storage: new InMemoryStore({ id: 'read-only-guidance' }),
        scopes: knowledgeMemoryScopes(),
        tools: { read: true },
        pinnedContext: true,
      }),
      scopes: ['org:acme'],
    });

    await agent.generate('Hi', { memory: { thread: 'thread-1', resource: 'user-1' } });
    expect(toolNames[0]).toEqual(['knowledge_list', 'knowledge_pin', 'knowledge_read', 'knowledge_search']);
    const system = prompts[0]!
      .filter(message => message.role === 'system')
      .map(message => message.content)
      .join('\n');
    expect(system).toContain('Pinned knowledge may appear in the conversation');
    expect(system).toContain('answer from their bodies without searching');
    expect(system).not.toMatch(EDIT_GUIDANCE);
  });
});
