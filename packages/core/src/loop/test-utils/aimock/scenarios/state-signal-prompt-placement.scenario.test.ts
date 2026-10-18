import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import type { Processor } from '../../../../processors';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

type ChatMessage = { role: string; content: unknown; tool_call_id?: string };

const contentText = (message: ChatMessage) =>
  typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

describeForAllEngines('AIMock loop scenario: state signal placement in the model prompt', engine => {
  const getMock = useLoopScenarioAimock();

  // Technical: a state signal is stored at the start of the step that first sees the state. When later steps of the
  // same run only add tool calls/results, the prompt ended on a tool result with the state message several turns
  // earlier, and some models (Gemini 3 Flash) answer that prompt with an empty reply. (#25220)
  it('the model reads the current state last when only tool steps followed it (#25220)', async () => {
    let currentUrl: string | undefined;

    const browserState: Processor = {
      id: 'browser',
      name: 'Browser state',
      computeStateSignal: () =>
        currentUrl ? { cacheKey: currentUrl, contents: `Browser is open. Active tab URL: ${currentUrl}` } : undefined,
    };

    const gotoTool = createTool({
      id: 'goto',
      description: 'Open a URL.',
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) => {
        currentUrl = url;
        return { success: true };
      },
    });
    const snapshotTool = createTool({
      id: 'snapshot',
      description: 'Snapshot the page.',
      inputSchema: z.object({}),
      execute: async () => ({ success: true, snapshot: '- link "Privacy policy" @e1573' }),
    });

    const memory = new MockMemory();

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'open the page and click the Privacy policy link',
      tools: { goto: gotoTool, snapshot: snapshotTool },
      inputProcessors: [browserState],
      stopWhen: stepCountIs(4),
      memory,
      threadId: `state-signal-placement-${engine}`,
      resourceId: 'state-signal-user',
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call_goto', name: 'goto', arguments: { url: 'https://example.com' } }] },
        );
        llm.on(
          { endpoint: 'chat', sequenceIndex: 1 },
          { toolCalls: [{ id: 'call_snapshot', name: 'snapshot', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Clicked the Privacy policy link.' });
      },
    });

    expect(await output.text).toBe('Clicked the Privacy policy link.');
    expect(requests).toHaveLength(3);

    const isState = (message: ChatMessage) => contentText(message).includes('Active tab URL: https://example.com');

    // Step 2: the state was just recorded, so it already sits last.
    const step2 = requests[1]!.body.messages as ChatMessage[];
    expect(step2.at(-1)!.role).toBe('user');
    expect(isState(step2.at(-1)!)).toBe(true);

    // Step 3: only a tool step followed the unchanged state; the model must still read it last.
    const step3 = requests[2]!.body.messages as ChatMessage[];
    expect(step3.filter(isState)).toHaveLength(1);
    expect(step3.at(-1)!.role).toBe('user');
    expect(isState(step3.at(-1)!)).toBe(true);
    // Tool calls/results keep their order ahead of it.
    const toolCallIds = step3.filter(message => message.role === 'tool').map(message => message.tool_call_id);
    expect(toolCallIds).toEqual(['call_goto', 'call_snapshot']);

    // Storage keeps the order the state was recorded in: after the goto result, before the snapshot step.
    const stored = (
      await memory.recall({ threadId: `state-signal-placement-${engine}`, resourceId: 'state-signal-user' })
    ).messages;
    const storedText = stored.map(message => JSON.stringify(message.content));
    const stateIndex = storedText.findIndex(text => text.includes('Active tab URL: https://example.com'));
    const snapshotIndex = storedText.findIndex(text => text.includes('call_snapshot'));
    expect(stateIndex).toBeGreaterThan(-1);
    expect(stateIndex).toBeLessThan(snapshotIndex);
  });

  it('a user message sent after the state keeps the state where it was (#25220)', async () => {
    let currentUrl: string | undefined;
    const browserState: Processor = {
      id: 'browser',
      name: 'Browser state',
      computeStateSignal: () =>
        currentUrl ? { cacheKey: currentUrl, contents: `Browser is open. Active tab URL: ${currentUrl}` } : undefined,
    };
    const gotoTool = createTool({
      id: 'goto',
      description: 'Open a URL.',
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) => {
        currentUrl = url;
        return { success: true };
      },
    });

    const memory = new MockMemory();
    const threadId = `state-signal-followup-${engine}`;
    const resourceId = 'state-signal-user';
    const common = {
      engine,
      tools: { goto: gotoTool },
      inputProcessors: [browserState],
      stopWhen: stepCountIs(3),
      memory,
      threadId,
      resourceId,
    } as const;

    await runLoopScenario({
      ...common,
      llm: getMock(),
      prompt: 'open the page',
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call_goto', name: 'goto', arguments: { url: 'https://example.com' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Opened.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    const { requests } = await runLoopScenario({
      ...common,
      llm: getMock(),
      prompt: 'which site was it?',
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'example.com' });
      },
    });

    const messages = requests[0]!.body.messages as ChatMessage[];
    expect(contentText(messages.at(-1)!)).toContain('which site was it?');
    const stateIndex = messages.findIndex(message => contentText(message).includes('Active tab URL'));
    const lastAssistantIndex = messages.findLastIndex(message => message.role === 'assistant');
    expect(stateIndex).toBeGreaterThan(-1);
    expect(stateIndex).toBeLessThan(lastAssistantIndex);
  });
});
