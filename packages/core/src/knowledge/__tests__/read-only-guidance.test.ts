import { createHash } from 'node:crypto';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { PinnedStateProcessor } from '../pinned-state-processor';

const EDIT_GUIDANCE = /edit one straight|To edit|knowledge_page|knowledge_note|expectedVersion/;
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
    expect(knowledge.createTools().knowledge_read!.description).toContain(
      'To edit part of a long body, pass the `range` a read gave you to knowledge_page.',
    );
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
