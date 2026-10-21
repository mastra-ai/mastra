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
  let calls = 0;
  return {
    messageList,
    advance(ms: number) {
      now += ms;
    },
    step(): string | undefined {
      processor.processInputStep({ messageList, tools, state } as unknown as ProcessInputStepArgs);
      const reminder = messageList.getSystemMessages('factory-reply-reminder');
      return reminder.length ? String(reminder[0]!.content) : undefined;
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
  it('stays out of runs without the reply tool', () => {
    const r = run({ tools: {} });
    r.step();
    r.advance(60 * MINUTE);
    expect(r.step()).toBeUndefined();
  });

  it('reminds a run that has worked five minutes without posting, with a way to stay silent', () => {
    const r = run();
    expect(r.step()).toBeUndefined();
    r.advance(4 * MINUTE);
    r.callTool('execute_command');
    expect(r.step()).toBeUndefined();

    r.advance(2 * MINUTE);
    const reminder = r.step();
    expect(reminder).toContain('It has been 6 minutes since you last posted in this thread.');
    expect(reminder).toContain('`staySilent: true`');
  });

  it('clears the reminder once the agent posts, and starts the clock again', () => {
    const r = run();
    r.step();
    r.advance(6 * MINUTE);
    expect(r.step()).toBeDefined();

    r.callTool(REPLY_TOOL_NAME);
    expect(r.step()).toBeUndefined();
    expect(r.messageList.getSystemMessages('factory-reply-reminder')).toHaveLength(0);

    r.advance(4 * MINUTE);
    expect(r.step()).toBeUndefined();
    r.advance(MINUTE);
    expect(r.step()).toContain('It has been 5 minutes');
  });

  it('keeps a single reminder in the prompt however many steps it stays overdue', () => {
    const r = run();
    r.step();
    r.advance(6 * MINUTE);
    r.step();
    r.advance(MINUTE);
    expect(r.step()).toContain('It has been 7 minutes');
    expect(r.messageList.getSystemMessages('factory-reply-reminder')).toHaveLength(1);
  });

  it('does not count a reply call that has not finished', () => {
    const r = run();
    r.step();
    r.advance(6 * MINUTE);
    r.callTool(REPLY_TOOL_NAME, 'call');
    expect(r.step()).toBeDefined();
  });
});
