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
    expect(sha(knowledge.createTools().knowledge_read!.description!)).toBe(
      '692561e732c23e2a1af8cb11ce765ec39c795b30503dbe0e3c7e37ece6f582ba',
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
