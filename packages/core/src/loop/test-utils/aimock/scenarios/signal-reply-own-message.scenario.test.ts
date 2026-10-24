/**
 * AIMock Scenario: the reply after a mid-tool signal is its own message (#27458)
 *
 * A processor keeps the step's `sendSignal` and fires it while a tool is
 * running. The signal seals the in-flight assistant message and rotates the
 * response id so the model's next reply lands in a fresh message after the
 * signal. The tool call and result stay in the sealed message. The reply must
 * not merge back into it, otherwise the next turn's prompt reads
 * tool call → tool result → reply → reminder, with the reply ahead of the
 * reminder it answers.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { AgentSignalInput } from '../../../../agent/signals';
import { MockMemory } from '../../../../memory/mock';
import type { InputProcessor } from '../../../../processors';
import { createTool } from '../../../../tools';
import {
  runLoopScenario,
  useLoopScenarioAimock,
  describeForAllEngines,
  isDurableEngineVariant,
} from '../aimock-scenario';
import type { EngineVariant } from '../types';

const REMINDER = 'Reminder: the deploy window closes in 5 minutes';
const REPLY = 'The api service is deployed.';
const NEXT_REPLY = 'Anything else?';

type Llm = ReturnType<ReturnType<typeof useLoopScenarioAimock>>;

/** One entry per stored message: its role plus the kinds of content it holds, in order. */
function layout(messages: any[]) {
  return messages.map(message => {
    const parts: any[] = message.content?.parts ?? [];
    const kinds: string[] = [];
    if (parts.some(p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === 'call_deploy')) {
      kinds.push('deploy-call');
    }
    if (parts.some(p => p.type === 'text' && p.text.includes(REMINDER))) kinds.push('reminder');
    if (JSON.stringify(message.content).includes(REMINDER) && !kinds.includes('reminder')) kinds.push('reminder');
    if (parts.some(p => p.type === 'text' && p.text.includes(REPLY))) kinds.push('reply');
    if (parts.some(p => p.type === 'text' && p.text.includes('Deploy the api service.'))) kinds.push('prompt');
    return { role: message.role, kinds };
  });
}

/** Index of the first request message whose serialized form contains `needle`. */
function indexOf(messages: any[], needle: string) {
  return messages.findIndex(m => JSON.stringify(m).includes(needle));
}

async function runDeploy(engine: EngineVariant, llm: Llm, { withSignal }: { withSignal: boolean }) {
  const threadId = `signal-reply-thread-${withSignal ? 'signal' : 'plain'}`;
  const resourceId = 'signal-reply-user';

  let heldSendSignal: ((signal: AgentSignalInput) => Promise<unknown>) | undefined;
  const reminderProcessor: InputProcessor = {
    id: 'background-reminder',
    processInputStep: async ({ sendSignal, stepNumber }) => {
      if (stepNumber === 0 && !heldSendSignal) heldSendSignal = sendSignal;
    },
  };

  const deploy = createTool({
    id: 'deploy',
    description: 'Deploys the service; slow',
    inputSchema: z.object({ service: z.string() }),
    execute: async ({ service }) => {
      // The reminder fires from background work while the deploy is in flight.
      if (withSignal) await heldSendSignal!({ type: 'reactive', contents: REMINDER });
      return { deployed: service };
    },
  });

  const memory = new MockMemory();
  const fixtures = (mock: any) => {
    mock.on({ endpoint: 'chat', userMessage: 'Next' }, { content: NEXT_REPLY });
    mock.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_deploy', name: 'deploy', arguments: { service: 'api' } }] },
    );
    mock.on({ endpoint: 'chat', hasToolResult: true }, { content: REPLY });
  };
  const common = {
    engine,
    llm,
    tools: { deploy },
    inputProcessors: [reminderProcessor],
    memory,
    threadId,
    resourceId,
    stopWhen: stepCountIs(5),
    fixtures,
  };

  const first = await runLoopScenario({ ...common, prompt: 'Deploy the api service.' });
  const text = await first.output.text;
  const { messages } = await memory.recall({ threadId, resourceId, hideSignals: false });

  const second = await runLoopScenario({ ...common, prompt: 'Next' });
  await second.output.text;
  const nextPrompt: any[] = second.requests.at(-1)?.body?.messages ?? [];

  return { text, requests: first.requests, messages, nextPrompt };
}

describeForAllEngines('AIMock scenario: reply after a mid-tool signal', engine => {
  const getMock = useLoopScenarioAimock();

  // Known gap (same as signal-during-tool-execution): durable/evented engines never
  // persist or deliver a processor's step-level sendSignal, so there is no reminder
  // for the reply to follow. Flip these to `it` once that gap is closed.
  const withReminder = isDurableEngineVariant(engine) ? it.fails : it;

  withReminder('stores the reply as its own message after the signal', async () => {
    const { text, requests, messages } = await runDeploy(engine, getMock(), { withSignal: true });

    expect(text).toContain(REPLY);
    expect(requests).toHaveLength(2);

    const stored = layout(messages);
    const callAt = stored.findIndex(m => m.kinds.includes('deploy-call'));
    const reminderAt = stored.findIndex(m => m.kinds.includes('reminder'));
    const replyAt = stored.findIndex(m => m.kinds.includes('reply'));
    expect(callAt, JSON.stringify(stored)).toBeGreaterThan(-1);
    expect(reminderAt, JSON.stringify(stored)).toBeGreaterThan(callAt);
    expect(replyAt, JSON.stringify(stored)).toBeGreaterThan(reminderAt);
    expect(stored[replyAt]).toEqual({ role: 'assistant', kinds: ['reply'] });
    expect(stored[callAt]).toEqual({ role: 'assistant', kinds: ['deploy-call'] });
  });

  withReminder("puts the reply after the reminder in the next turn's prompt", async () => {
    const { nextPrompt } = await runDeploy(engine, getMock(), { withSignal: true });

    const resultAt = nextPrompt.findIndex((m: any) => m.role === 'tool' && m.tool_call_id === 'call_deploy');
    const reminderAt = indexOf(nextPrompt, REMINDER);
    // The OpenAI Responses provider replays earlier assistant output by item
    // reference, so the reply shows up as an assistant entry without its text.
    const replyAt = nextPrompt.findIndex((m: any, i: number) => i > resultAt && m.role === 'assistant');
    const nextAt = nextPrompt.findIndex((m: any) => m.role === 'user' && JSON.stringify(m.content).includes('Next'));
    const order = JSON.stringify(nextPrompt.map((m: any) => m.role));
    expect(resultAt, order).toBeGreaterThan(-1);
    expect(reminderAt, order).toBeGreaterThan(resultAt);
    expect(replyAt, order).toBeGreaterThan(reminderAt);
    expect(nextAt, order).toBeGreaterThan(replyAt);
  });

  it('keeps the tool call and reply in one message when no signal arrives', async () => {
    const { text, messages, nextPrompt } = await runDeploy(engine, getMock(), { withSignal: false });

    expect(text).toContain(REPLY);
    expect(layout(messages)).toEqual([
      { role: 'user', kinds: ['prompt'] },
      { role: 'assistant', kinds: ['deploy-call', 'reply'] },
    ]);
    expect(nextPrompt.map((m: any) => m.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant', 'user']);
  });
});
