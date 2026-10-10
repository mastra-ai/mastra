import { Agent } from '@earendil-works/pi-agent-core';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from '@earendil-works/pi-ai';
import type { TranscriptContext } from '@earendil-works/pi-ai';
import { createFauxCore, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it } from 'vitest';

import type { PlatformMemoryClient } from './client';
import { withPlatformMemory } from './pi-agent';

function fakeClient(shouldObserve = false) {
  const saved: { messages: { id?: string; role: string; parts?: { type: string }[] }[] }[] = [];
  let observed = 0;
  const client = {
    getContext: async () => ({
      system: observed ? '<observations>Ada lives in Kyoto.</observations>' : null,
      messages: [
        { role: 'user', content: 'I like tea' },
        { role: 'assistant', content: 'Noted.' },
      ],
      observedAt: null,
    }),
    saveMessages: async (_threadId: string, body: (typeof saved)[number]) => {
      saved.push(body);
      return { messages: [] };
    },
    getObservationStatus: async () => ({ shouldObserve }),
    observe: async () => {
      observed++;
      return { observed: true, reflected: false, record: null };
    },
  } as unknown as PlatformMemoryClient;
  return { client, saved, observedCount: () => observed };
}

const textsOf = (context: TranscriptContext) =>
  context.messages.map(m =>
    typeof m.content === 'string'
      ? m.content
      : m.content.map(c => ('text' in c ? c.text : c.type === 'toolCall' ? `call:${c.name}` : '')).join(''),
  );

function setup(shouldObserve: boolean, responses: Parameters<ReturnType<typeof createFauxCore>['setResponses']>[0]) {
  const faux = createFauxCore({});
  const prompts: string[][] = [];
  faux.setResponses(
    responses.map(r => (context: TranscriptContext) => {
      prompts.push(textsOf(context));
      return typeof r === 'function' ? r(context, undefined, faux.state, faux.getModel()) : r;
    }),
  );
  const lookup: AgentTool = {
    name: 'lookup',
    label: 'lookup',
    description: 'Look something up',
    parameters: Type.Object({}),
    execute: async () => ({ content: [{ type: 'text', text: 'rows' }], details: {} }),
  };
  const agent = new Agent({
    streamFn: faux.streamSimple,
    initialState: { systemPrompt: 'You are helpful.', model: faux.getModel(), tools: [lookup] },
  });
  const memory = fakeClient(shouldObserve);
  withPlatformMemory(agent, { client: memory.client, threadId: 't1' });
  return { agent, prompts, ...memory };
}

describe('withPlatformMemory (pi)', () => {
  it('prepends memory and saves the turn at the end', async () => {
    const { agent, prompts, saved } = setup(false, [fauxAssistantMessage('You live in Kyoto.')]);
    await agent.prompt('Where do I live?');

    expect(prompts[0]).toEqual(['You are helpful.', 'I like tea', 'Noted.', 'Where do I live?']);
    expect(saved.at(-1)!.messages.map(m => m.role)).toEqual(['user', 'assistant']);
  });

  it('only sends the current turn plus memory on later prompts', async () => {
    const { agent, prompts } = setup(false, [fauxAssistantMessage('One.'), fauxAssistantMessage('Two.')]);
    await agent.prompt('First');
    await agent.prompt('Second');

    expect(prompts[1]).toEqual(['You are helpful.', 'I like tea', 'Noted.', 'Second']);
  });

  it('saves the tool loop as it goes and observes mid-loop over threshold', async () => {
    const { agent, prompts, saved, observedCount } = setup(true, [
      fauxAssistantMessage(fauxToolCall('lookup', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('Done.'),
    ]);
    await agent.prompt('Collect rows');

    expect(observedCount()).toBe(1);
    expect(prompts[1]![1]).toContain('Ada lives in Kyoto.');
    // Mid-loop the turn is served from memory, not appended again.
    expect(prompts[1]).not.toContain('Collect rows');
    const midIds = saved[0]!.messages.map(m => m.id);
    const finalIds = saved.at(-1)!.messages.map(m => m.id);
    // After observing, the rest of the turn goes into a new assistant message.
    expect(finalIds).not.toContain(midIds.at(-1));
    expect(saved[0]!.messages.at(-1)!.parts!.some(p => p.type === 'tool-invocation')).toBe(true);
  });
});
