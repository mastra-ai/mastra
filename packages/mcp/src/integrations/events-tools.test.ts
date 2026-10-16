import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { MockMemory } from '@mastra/core/memory';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeEventsClient } from './__fixtures__/fake-events-client';
import { MCPEventsSignalProvider } from './events-signals';
import type { MCPEventsSignalProviderOptions } from './events-signals';

const thread = { resourceId: 'user-1', threadId: 'thread-1' };
const target = { server: 'github', event: 'repo.push', arguments: { repo: 'a' } };

const providers: MCPEventsSignalProvider[] = [];

afterEach(() => {
  for (const provider of providers.splice(0)) provider.stop();
});

function setup(tools: MCPEventsSignalProviderOptions['tools']) {
  const fake = createFakeEventsClient();
  const provider = new MCPEventsSignalProvider({ client: fake.client, tools });
  providers.push(provider);
  return { ...fake, provider, tools: provider.getTools() };
}

function agentContext(ids: { threadId?: string; resourceId?: string }): ToolExecutionContext {
  return { agent: { agentId: 'events-agent', toolCallId: 'call-1', messages: [], suspend: async () => {}, ...ids } };
}

/** A model that calls one tool with the given input, then answers with text. */
function toolCallingModel(toolName: string, input: unknown) {
  let step = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      step++;
      const parts =
        step === 1
          ? [
              { type: 'tool-call' as const, toolCallId: 'call-1', toolName, input: JSON.stringify(input) },
              {
                type: 'finish' as const,
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start' as const, id: 'text-1' },
              { type: 'text-delta' as const, id: 'text-1', delta: 'Subscribed.' },
              { type: 'text-end' as const, id: 'text-1' },
              {
                type: 'finish' as const,
                finishReason: 'stop' as const,
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: `id-${step}`, modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

describe('MCP events tools', () => {
  it('exposes no tools unless enabled', () => {
    expect(setup(undefined).tools).toEqual({});
    expect(setup(false).tools).toEqual({});
    expect(Object.keys(setup(true).tools).sort()).toEqual([
      'mcp_events_list',
      'mcp_events_subscribe',
      'mcp_events_unsubscribe',
    ]);
  });

  it('lists event descriptors projected to what a model needs', async () => {
    const { tools, listCalls } = setup(true);
    const result = await tools.mcp_events_list!.execute!({ server: 'github' }, agentContext(thread));
    expect(listCalls).toEqual(['github']);
    expect(result).toEqual({
      events: [
        {
          name: 'repo.push',
          description: 'A push to a repository',
          delivery: ['push', 'poll'],
          inputSchema: { type: 'object', properties: { repo: { type: 'string' } } },
        },
      ],
    });
  });

  it('subscribes the calling thread when a real agent run calls the tool, and delivers to it', async () => {
    const fake = createFakeEventsClient();
    const provider = new MCPEventsSignalProvider({ client: fake.client, tools: true });
    providers.push(provider);
    const agent = new Agent({
      id: 'events-agent',
      name: 'Events Agent',
      instructions: 'Subscribe when asked.',
      model: toolCallingModel('mcp_events_subscribe', target),
      memory: new MockMemory(),
      signals: [provider],
      notifications: { deliveryPolicy: { default: 'persist' } },
    });
    new Mastra({ agents: { agent }, logger: false });
    const send = vi.spyOn(agent, 'sendNotificationSignal');

    const stream = await agent.stream('Watch pushes to repo a', {
      memory: { thread: thread.threadId, resource: thread.resourceId },
      maxSteps: 3,
    });
    const toolResults = await stream.toolResults;

    expect(toolResults.map(toolResult => toolResult.payload.result)).toEqual([
      { subscribed: true, key: MCPEventsSignalProvider.key({ ...target, args: target.arguments }) },
    ]);
    expect(fake.subscriptions).toHaveLength(1);
    expect(fake.subscriptions[0]!.arguments).toEqual({ repo: 'a' });

    fake.subscriptions[0]!.push({ ref: 'main' }, { eventId: 'evt-1' });
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]![1]).toEqual(thread);
  });

  it('unsubscribes the calling thread and cancels the MCP subscription', async () => {
    const { tools, subscriptions } = setup(true);
    await expect(tools.mcp_events_subscribe!.execute!(target, agentContext(thread))).resolves.toMatchObject({
      subscribed: true,
    });
    await expect(tools.mcp_events_unsubscribe!.execute!(target, agentContext(thread))).resolves.toEqual({
      unsubscribed: true,
    });
    expect(subscriptions[0]!.cancelled).toBe(true);
    await expect(tools.mcp_events_unsubscribe!.execute!(target, agentContext(thread))).resolves.toEqual({
      unsubscribed: false,
    });
  });

  it('returns an error result without agent memory', async () => {
    const { tools, subscriptions } = setup(true);
    for (const context of [agentContext({}), agentContext({ threadId: 'thread-1' }), undefined]) {
      await expect(tools.mcp_events_subscribe!.execute!(target, context)).resolves.toMatchObject({
        isError: true,
        content: expect.stringContaining('require agent memory'),
      });
    }
    await expect(tools.mcp_events_unsubscribe!.execute!(target, agentContext({}))).resolves.toMatchObject({
      isError: true,
    });
    expect(subscriptions).toHaveLength(0);
  });

  it('rejects servers outside the allowlist', async () => {
    const { tools, subscriptions, listCalls } = setup({ servers: ['github'] });
    const other = { ...target, server: 'jira' };
    for (const result of [
      await tools.mcp_events_list!.execute!({ server: 'jira' }, agentContext(thread)),
      await tools.mcp_events_subscribe!.execute!(other, agentContext(thread)),
      await tools.mcp_events_unsubscribe!.execute!(other, agentContext(thread)),
    ]) {
      expect(result).toEqual({ isError: true, content: 'MCP server "jira" is not enabled for event tools.' });
    }
    expect(listCalls).toEqual([]);
    expect(subscriptions).toHaveLength(0);
    await expect(tools.mcp_events_subscribe!.execute!(target, agentContext(thread))).resolves.toMatchObject({
      subscribed: true,
    });
  });

  it('surfaces subscribe failures as an error result', async () => {
    const { tools, rejectNextSubscribe, provider } = setup(true);
    rejectNextSubscribe(new Error('Unknown event "repo.push"'));
    await expect(tools.mcp_events_subscribe!.execute!(target, agentContext(thread))).resolves.toEqual({
      isError: true,
      content: 'Unknown event "repo.push"',
    });
    expect(provider.subscriptionCount).toBe(0);
  });
});
