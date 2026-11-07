import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import type { ModelMessage } from '@internal/ai-sdk-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import type { DelegationConfig, MessageFilterContext } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Story: a supervisor on Claude with extended thinking calls one of its own tools, then
 * delegates to a sub-agent in the same run. Anthropic rejected every such delegation with
 * "`thinking` or `redacted_thinking` blocks in the latest assistant message cannot be
 * modified" (#29276).
 *
 * Technical: the delegation tool forwards the supervisor's in-flight messages to the
 * sub-agent with the tool calls removed. The signed thinking that produced those calls was
 * kept, so the sub-agent's request carried the supervisor's signed thinking with no
 * `tool_use` beside it (and `@ai-sdk/anthropic` merges the now-adjacent assistant steps into
 * one message). Anthropic treats that as a modified thinking block. The fix drops the
 * supervisor's reasoning from the forwarded context and keeps its text.
 *
 * Both agents use the real `@ai-sdk/anthropic` provider against AIMock's Messages endpoint,
 * and the assertions read the sub-agent's raw wire body.
 */

const MODEL_ID = 'claude-opus-5-5';
const SUB_AGENT_INSTRUCTIONS = 'You answer questions about the time.';
const THINKING = { anthropic: { thinking: { type: 'enabled', budgetTokens: 1024 } } } as const;

type WireBlock = { type: string; [key: string]: unknown };
type WireMessage = { role: string; content: string | WireBlock[] };
type WireBody = { system?: unknown; messages: WireMessage[] };

const isSubAgentRequest = (req: ChatCompletionRequest) =>
  JSON.stringify(req.messages.filter(m => m.role === 'system')).includes(SUB_AGENT_INSTRUCTIONS);

const hasToolResultFor = (req: ChatCompletionRequest, toolCallId: string) =>
  req.messages.some(m => m.role === 'tool' && m.tool_call_id === toolCallId);

function anthropicModel(llm: LLMock, sentBodies: WireBody[]) {
  return createAnthropic({
    apiKey: 'aimock-test-key',
    baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
    // AIMock normalizes Anthropic requests to chat format, so capture the raw wire body.
    fetch: async (url, init) => {
      sentBodies.push(JSON.parse(init!.body as string) as WireBody);
      return fetch(url, init);
    },
  })(MODEL_ID);
}

/**
 * Supervisor: think + call get_time, then think + delegate, then answer. Only the get_time step is
 * part of the forwarded context: the delegating step is still in flight when its tool runs.
 */
function supervisorFixtures(llm: LLMock, { textInToolStep }: { textInToolStep: boolean }) {
  llm.on({ endpoint: 'chat', predicate: isSubAgentRequest }, { content: 'It is noon.' });
  llm.on(
    { endpoint: 'chat', predicate: req => !isSubAgentRequest(req) && hasToolResultFor(req, 'toolu_helper') },
    { content: 'The helper says it is noon.' },
  );
  llm.on(
    { endpoint: 'chat', predicate: req => !isSubAgentRequest(req) && hasToolResultFor(req, 'toolu_time') },
    {
      reasoning: 'I have the time. Now I should delegate to the helper.',
      reasoningSignature: 'sig-supervisor-step-2',
      toolCalls: [{ id: 'toolu_helper', name: 'agent-helper', arguments: { prompt: 'What time is it?' } }],
    },
  );
  llm.on(
    { endpoint: 'chat', predicate: req => !isSubAgentRequest(req) },
    {
      ...(textInToolStep ? { content: 'Checking the clock first.' } : {}),
      reasoning: 'First I need the current time.',
      reasoningSignature: 'sig-supervisor-step-1',
      redactedThinking: ['redacted-supervisor-step-1'],
      toolCalls: [{ id: 'toolu_time', name: 'get_time', arguments: {} }],
    },
  );
}

const THREAD_ID = 'signed-reasoning-thread';
const RESOURCE_ID = 'signed-reasoning-user';
const CURRENT_PROMPT = 'What time is it? Check, then have the helper confirm.';
/** Earlier turns from a provider without signed reasoning: one plain answer, one tool step. */
const unsignedHistory: ModelMessage[] = [
  { role: 'user', content: 'Say hi.' },
  {
    role: 'assistant',
    content: [
      { type: 'reasoning', text: 'Unsigned plain-answer reasoning.' },
      { type: 'text', text: 'Hi there.' },
    ],
  },
  { role: 'user', content: 'What time was it earlier?' },
  {
    role: 'assistant',
    content: [
      { type: 'reasoning', text: 'Unsigned tool-step reasoning.' },
      { type: 'text', text: 'Looking it up.' },
      { type: 'tool-call', toolCallId: 'call_prior', toolName: 'get_time', input: {} },
    ],
  },
  {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'call_prior',
        toolName: 'get_time',
        output: { type: 'json', value: { time: '11:00' } },
      },
    ],
  },
  { role: 'assistant', content: [{ type: 'text', text: 'It was 11:00.' }] },
  { role: 'user', content: 'Ask the helper what time it is now.' },
];

const getTime = createTool({
  id: 'get_time',
  description: 'Returns the current time',
  inputSchema: z.object({}),
  execute: async () => ({ time: '12:00' }),
});

/** Every thinking-type block in an assistant message that has no tool_use block of its own. */
function unpairedThinkingBlocks(body: WireBody): WireBlock[] {
  return body.messages.flatMap(message => {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) return [];
    if (message.content.some(block => block.type === 'tool_use')) return [];
    return message.content.filter(block => block.type === 'thinking' || block.type === 'redacted_thinking');
  });
}

describeForAllEngines('AIMock loop scenario: delegation after a signed-thinking tool step (#29276)', engine => {
  const getMock = useLoopScenarioAimock();

  async function delegate({
    textInToolStep,
    delegation,
    memory,
  }: {
    textInToolStep: boolean;
    delegation?: DelegationConfig;
    memory?: MockMemory;
  }) {
    const llm = getMock();
    const supervisorBodies: WireBody[] = [];
    const subAgentBodies: WireBody[] = [];

    const helper = new Agent({
      id: 'helper',
      name: 'helper',
      description: 'Answers a question',
      instructions: SUB_AGENT_INSTRUCTIONS,
      model: anthropicModel(llm, subAgentBodies),
      defaultOptions: { providerOptions: THINKING },
    });

    const { output } = await runLoopScenario({
      engine,
      llm,
      prompt: CURRENT_PROMPT,
      model: anthropicModel(llm, supervisorBodies),
      providerOptions: THINKING,
      tools: { get_time: getTime },
      agents: { helper },
      stopWhen: stepCountIs(4),
      ...(delegation ? { delegation } : {}),
      ...(memory ? { memory, threadId: THREAD_ID, resourceId: RESOURCE_ID } : {}),
      fixtures: mock => supervisorFixtures(mock, { textInToolStep }),
    });

    return { output, supervisorBodies, subAgentBodies };
  }

  it('delegates mid-run without sending the supervisor its signed thinking stripped of tool calls (#29276)', async () => {
    const { output, supervisorBodies, subAgentBodies } = await delegate({ textInToolStep: false });

    expect(output.error).toBeUndefined();
    expect(await output.text).toBe('The helper says it is noon.');
    // Precondition: the supervisor's own requests replay its signed thinking with the tool calls.
    expect(JSON.stringify(supervisorBodies)).toContain('sig-supervisor-step-1');
    expect(supervisorBodies.flatMap(body => body.messages).flatMap(m => m.content)).toContainEqual({
      type: 'redacted_thinking',
      data: 'redacted-supervisor-step-1',
    });

    expect(subAgentBodies).toHaveLength(1);
    const [subAgentBody] = subAgentBodies;
    expect(unpairedThinkingBlocks(subAgentBody!)).toEqual([]);
    const wire = JSON.stringify(subAgentBody);
    expect(wire).not.toContain('sig-supervisor-step-1');
    expect(wire).not.toContain('sig-supervisor-step-2');
    expect(wire).not.toContain('redacted-supervisor-step-1');
    // The rest of the parent context still reaches the sub-agent.
    expect(wire).toContain(CURRENT_PROMPT);
    expect(wire).toContain('What time is it?');
  });

  it('keeps the supervisor text from a tool step while dropping its signed thinking (#29276)', async () => {
    const { output, subAgentBodies } = await delegate({ textInToolStep: true });

    expect(output.error).toBeUndefined();
    expect(subAgentBodies).toHaveLength(1);
    const [subAgentBody] = subAgentBodies;
    expect(unpairedThinkingBlocks(subAgentBody!)).toEqual([]);
    const assistantText = subAgentBody!.messages
      .filter(message => message.role === 'assistant')
      .flatMap(message => (Array.isArray(message.content) ? message.content : []))
      .filter(block => block.type === 'text')
      .map(block => block.text);
    expect(assistantText).toEqual(['Checking the clock first.']);
  });

  it('drops signed thinking from earlier turns recalled from memory, including the answer after a tool step (#29276)', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    const earlierPrompt = 'What time was it earlier?';

    // Earlier run on the same thread: think + text + call get_time, then think + answer in text. Once the
    // tool call and result are removed, both steps become adjacent assistant messages that
    // `@ai-sdk/anthropic` merges into one, so the answer's signed thinking would sit mid-message.
    await runLoopScenario({
      engine,
      llm,
      prompt: earlierPrompt,
      model: anthropicModel(llm, []),
      providerOptions: THINKING,
      tools: { get_time: getTime },
      memory,
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      stopWhen: stepCountIs(3),
      fixtures: mock => {
        mock.on(
          { endpoint: 'chat', predicate: req => hasToolResultFor(req, 'toolu_prior') },
          { reasoning: 'The tool says 11:00.', reasoningSignature: 'sig-prior-plain-answer', content: 'It was 11:00.' },
        );
        mock.on(
          { endpoint: 'chat' },
          {
            content: 'Let me check.',
            reasoning: 'I should look it up.',
            reasoningSignature: 'sig-prior-tool-step',
            toolCalls: [{ id: 'toolu_prior', name: 'get_time', arguments: {} }],
          },
        );
      },
    });
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();

    const { output, supervisorBodies, subAgentBodies } = await delegate({ textInToolStep: false, memory });

    expect(output.error).toBeUndefined();
    // Precondition: memory recalled the earlier turn and the supervisor replays both signatures.
    const supervisorWire = JSON.stringify(supervisorBodies[0]);
    expect(supervisorWire).toContain(earlierPrompt);
    expect(supervisorWire).toContain('sig-prior-plain-answer');
    expect(supervisorWire).toContain('sig-prior-tool-step');

    expect(subAgentBodies).toHaveLength(1);
    const [subAgentBody] = subAgentBodies;
    expect(unpairedThinkingBlocks(subAgentBody!)).toEqual([]);
    const wire = JSON.stringify(subAgentBody);
    expect(wire).not.toContain('sig-prior-tool-step');
    expect(wire).not.toContain('sig-prior-plain-answer');
    expect(wire).not.toContain('sig-supervisor-step-1');
    expect(wire).toContain('Let me check.');
    expect(wire).toContain('It was 11:00.');
  });

  it('drops unsigned reasoning from the forwarded context on other providers too (#29276)', async () => {
    const llm = getMock();
    const messageFilter = vi.fn(({ messages }: MessageFilterContext) => messages);
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const helper = new Agent({
      id: 'helper',
      name: 'helper',
      description: 'Answers a question',
      instructions: SUB_AGENT_INSTRUCTIONS,
      model: openai(SCENARIO_MODEL_ID),
    });

    const { output } = await runLoopScenario({
      engine,
      llm,
      prompt: unsignedHistory,
      tools: { get_time: getTime },
      agents: { helper },
      delegation: { messageFilter },
      stopWhen: stepCountIs(3),
      fixtures: mock => {
        mock.on({ endpoint: 'chat', predicate: isSubAgentRequest }, { content: 'It is noon.' });
        mock.on(
          { endpoint: 'chat', predicate: req => hasToolResultFor(req, 'call_helper') },
          { content: 'The helper says it is noon.' },
        );
        mock.on(
          { endpoint: 'chat' },
          { toolCalls: [{ id: 'call_helper', name: 'agent-helper', arguments: { prompt: 'What time is it?' } }] },
        );
      },
    });

    expect(output.error).toBeUndefined();
    expect(messageFilter).toHaveBeenCalledTimes(1);
    const forwarded = messageFilter.mock.calls[0]![0].messages;
    const assistantParts = forwarded
      .filter(message => message.role === 'assistant')
      .map(message => (Array.isArray(message.content) ? message.content.map(part => part.type) : []));
    expect(assistantParts).toEqual([['text'], ['text'], ['text']]);
    const wire = JSON.stringify(forwarded);
    expect(wire).not.toContain('Unsigned plain-answer reasoning.');
    expect(wire).not.toContain('Unsigned tool-step reasoning.');
    expect(wire).toContain('Hi there.');
    expect(wire).toContain('Looking it up.');
  });

  it('passes messageFilter the context without the supervisor reasoning (#29276)', async () => {
    const messageFilter = vi.fn(({ messages }: MessageFilterContext) => messages);

    const { output, subAgentBodies } = await delegate({ textInToolStep: true, delegation: { messageFilter } });

    expect(output.error).toBeUndefined();
    expect(subAgentBodies).toHaveLength(1);
    expect(messageFilter).toHaveBeenCalledTimes(1);
    const forwarded = messageFilter.mock.calls[0]![0].messages;
    const forwardedParts = forwarded.flatMap(message => (Array.isArray(message.content) ? message.content : []));
    expect(forwardedParts.filter(part => part.type === 'reasoning')).toEqual([]);
    expect(JSON.stringify(forwarded)).toContain('Checking the clock first.');
    expect(JSON.stringify(forwarded)).toContain(CURRENT_PROMPT);
  });
});
