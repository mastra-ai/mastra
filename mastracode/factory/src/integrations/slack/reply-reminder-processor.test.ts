import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import { describe, expect, it } from 'vitest';

import { FactoryReplyReminderProcessor } from './reply-reminder-processor.js';
import { REPLY_TOOL_NAME } from './reply-tool.js';

const MINUTE = 60_000;

function run({ tools = { [REPLY_TOOL_NAME]: {} } as Record<string, unknown> } = {}) {
  let now = 0;
  const processor = new FactoryReplyReminderProcessor({ afterMs: 5 * MINUTE, now: () => now });
  const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
  const state: Record<string, unknown> = {};
  const signals: Array<{ type: string; contents: unknown }> = [];
  const sendSignal = async (signal: { type: string; contents: unknown }) => {
    signals.push(signal);
    return signal as never;
  };
  let calls = 0;
  return {
    messageList,
    signals,
    advance(ms: number) {
      now += ms;
    },
    /** Runs one step and returns the nudge it sent, if any. */
    async step(): Promise<string | undefined> {
      const before = signals.length;
      await processor.processInputStep({ messageList, tools, state, sendSignal } as unknown as ProcessInputStepArgs);
      return signals.length > before ? String(signals.at(-1)!.contents) : undefined;
    },
    callTool(toolName: string, state: 'call' | 'result' = 'result') {
      calls += 1;
      const message: MastraDBMessage = {
        id: `assistant-${calls}`,
        role: 'assistant',
        createdAt: new Date(now),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state,
                toolCallId: `call-${calls}`,
                toolName,
                args: {},
                ...(state === 'result' ? { result: { posted: true } } : {}),
              },
            } as MastraDBMessage['content']['parts'][number],
          ],
        },
      };
      messageList.add(message, 'response');
    },
  };
}

describe('FactoryReplyReminderProcessor', () => {
  it('stays out of runs without the reply tool', async () => {
    const r = run({ tools: {} });
    await r.step();
    r.advance(60 * MINUTE);
    expect(await r.step()).toBeUndefined();
  });

  it('nudges a run that has worked five minutes without posting, as a reactive signal', async () => {
    const r = run();
    expect(await r.step()).toBeUndefined();
    r.advance(4 * MINUTE);
    r.callTool('execute_command');
    expect(await r.step()).toBeUndefined();

    r.advance(2 * MINUTE);
    expect(await r.step()).toBe(
      'It has been 6 minutes since you last posted in this thread. If the people there would want to know where things stand, post a short status with `reply_in_thread`. Otherwise keep working.',
    );
    expect(r.signals.at(-1)!.type).toBe('reactive');
  });

  it('leaves the system prompt alone, so the cached prompt prefix holds', async () => {
    const r = run();
    await r.step();
    r.advance(6 * MINUTE);
    expect(await r.step()).toBeDefined();
    expect(r.messageList.getAllSystemMessages()).toHaveLength(0);
  });

  it('nudges once, then waits another five minutes before nudging again', async () => {
    const r = run();
    await r.step();
    r.advance(6 * MINUTE);
    expect(await r.step()).toBeDefined();
    r.advance(MINUTE);
    expect(await r.step()).toBeUndefined();
    r.advance(4 * MINUTE);
    expect(await r.step()).toContain('It has been 5 minutes');
    expect(r.signals).toHaveLength(2);
  });

  it('starts the clock again once the agent posts', async () => {
    const r = run();
    await r.step();
    r.advance(4 * MINUTE);
    r.callTool(REPLY_TOOL_NAME);
    expect(await r.step()).toBeUndefined();
    r.advance(4 * MINUTE);
    expect(await r.step()).toBeUndefined();
    r.advance(MINUTE);
    expect(await r.step()).toContain('It has been 5 minutes');
  });

  it('does not count a reply call that has not finished', async () => {
    const r = run();
    await r.step();
    r.advance(6 * MINUTE);
    r.callTool(REPLY_TOOL_NAME, 'call');
    expect(await r.step()).toBeDefined();
  });
});
