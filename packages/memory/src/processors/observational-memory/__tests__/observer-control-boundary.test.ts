import { createSignal } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it, vi } from 'vitest';

import {
  buildMultiThreadObserverHistoryMessage,
  buildObserverHistoryMessage,
  formatMessagesForObserver,
} from '../observer-agent';
import { ObserverRunner } from '../observer-runner';

/**
 * Regression coverage for https://github.com/mastra-ai/mastra/issues/22195.
 *
 * The Observer must be able to tell the conversation it observes apart from its own
 * control input (task instructions, prior memory), and runtime control messages (system
 * reminders, signals) must not be presented as things the user said.
 */

function textMessage(text: string, role: 'user' | 'assistant' = 'user', id?: string): MastraDBMessage {
  return {
    id: id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content: { format: 2, parts: [{ type: 'text', text }] },
    type: 'text',
    createdAt: new Date('2026-07-19T17:00:00.000Z'),
  };
}

function createCapturingRunner() {
  const captured: { prompt?: any } = {};
  const runner = new ObserverRunner({
    observationConfig: {
      model: 'test-model',
      messageTokens: 1000,
      bufferTokens: false,
      previousObserverTokens: 1000,
    } as any,
    observedMessageIds: new Set(),
    resolveModel: () => ({ model: 'test-model' as any }),
    tokenCounter: { countMessages: () => 1 } as any,
  });

  vi.spyOn(runner as any, 'createAgent').mockReturnValue({
    stream: async (prompt: any) => {
      captured.prompt = prompt;
      return {
        getFullOutput: async () => ({
          text: '<observations>\n* 🔴 (17:00) User asked about billing\n</observations>',
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        }),
      };
    },
  });

  return { runner, captured };
}

/** Flattens a structured user message into the text a model would read, in order. */
function textOf(message: any): string {
  if (typeof message.content === 'string') return message.content;
  return message.content
    .filter((part: any) => part.type === 'text')
    .map((part: any) => part.text)
    .join('\n');
}

describe('observer request keeps control input apart from observed history (#22195)', () => {
  it('single-thread: sends one user message with prior memory, then history, then the task', async () => {
    const { runner, captured } = createCapturingRunner();

    await runner.call(
      '* 🔴 (09:00) User prefers terse answers',
      [textMessage('Can you look at my invoice?', 'user'), textMessage('Sure, checking now.', 'assistant')],
      undefined,
      { priorCurrentTask: 'Help the user with billing' },
    );

    const prompt = captured.prompt;
    expect(Array.isArray(prompt)).toBe(true);
    // No consecutive user turns: the control text is not a separate "user" message
    // sitting before the history.
    expect(prompt).toHaveLength(1);
    expect(prompt[0]).toMatchObject({ role: 'user' });

    const text = textOf(prompt[0]);
    const previousObservations = text.indexOf('## Previous Observations');
    const priorMetadata = text.indexOf('- prior current-task: Help the user with billing');
    const history = text.indexOf('## New Message History to Observe');
    const conversation = text.indexOf('Can you look at my invoice?');
    const task = text.indexOf('## Your Task');

    expect(previousObservations).toBeGreaterThanOrEqual(0);
    expect(priorMetadata).toBeGreaterThan(previousObservations);
    expect(history).toBeGreaterThan(priorMetadata);
    expect(conversation).toBeGreaterThan(history);
    // The task refers to "the message history above", so it must come after the history.
    expect(task).toBeGreaterThan(conversation);
    expect(text.slice(task)).toContain('message history above');
  });

  it('single-thread: keeps attachments inside the single user message', async () => {
    const { runner, captured } = createCapturingRunner();
    (runner as any).observationConfig.observeAttachments = true;

    const message = textMessage('ignored');
    message.content = {
      format: 2,
      parts: [
        { type: 'text', text: 'Please inspect this.' },
        { type: 'image', image: 'https://example.com/board.png', mimeType: 'image/png' } as any,
      ],
    };

    await runner.call(undefined, [message]);

    expect(captured.prompt).toHaveLength(1);
    const content = captured.prompt[0].content as any[];
    const imageIndex = content.findIndex(part => part.type === 'image');
    const taskIndex = content.findIndex(part => part.type === 'text' && part.text.includes('## Your Task'));
    expect(imageIndex).toBeGreaterThanOrEqual(0);
    expect(taskIndex).toBeGreaterThan(imageIndex);
  });

  it('multi-thread: sends one user message with prior memory, then history, then the task', async () => {
    const { runner, captured } = createCapturingRunner();

    await runner.callMultiThread(
      '* 🔴 (09:00) User prefers terse answers',
      new Map([
        ['thread-a', [textMessage('Thread A asks about invoices', 'user', 'a-1')]],
        ['thread-b', [textMessage('Thread B asks about deploys', 'user', 'b-1')]],
      ]),
      ['thread-a', 'thread-b'],
      undefined,
      undefined,
      new Map([['thread-a', { currentTask: 'Resolve invoice question' }]]),
    );

    const prompt = captured.prompt;
    expect(Array.isArray(prompt)).toBe(true);
    expect(prompt).toHaveLength(1);
    expect(prompt[0]).toMatchObject({ role: 'user' });

    const text = textOf(prompt[0]);
    const previousObservations = text.indexOf('## Previous Observations');
    const priorMetadata = text.indexOf('prior current-task: Resolve invoice question');
    const history = text.indexOf('## New Message History to Observe');
    const threadB = text.indexOf('Thread B asks about deploys');
    const task = text.indexOf('## Your Task');

    expect(previousObservations).toBeGreaterThanOrEqual(0);
    expect(priorMetadata).toBeGreaterThan(previousObservations);
    expect(history).toBeGreaterThan(priorMetadata);
    expect(threadB).toBeGreaterThan(history);
    expect(task).toBeGreaterThan(threadB);
  });

  it('multi-thread: does not put placeholder example observations in the user message', async () => {
    const { runner, captured } = createCapturingRunner();

    await runner.callMultiThread(
      undefined,
      new Map([
        ['thread-a', [textMessage('Thread A asks about invoices', 'user', 'a-1')]],
        ['thread-b', [textMessage('Thread B asks about deploys', 'user', 'b-1')]],
      ]),
      ['thread-a', 'thread-b'],
    );

    const text = textOf(captured.prompt[0]);
    // These placeholders read as user facts and a current task in the Observer's own
    // output format. The multi-thread system prompt already documents the format.
    expect(text).not.toContain('User prefers direct answers');
    expect(text).not.toContain('Working on feature X');
    expect(text).not.toContain('Discussing deployment options');
  });
});

describe('observer history labels runtime control messages by tag, not as the user (#22195)', () => {
  const reminderText = 'AGENTS.md says: always run tests';

  const conversation = (): MastraDBMessage[] => {
    const metadataUserReminder = textMessage(`${reminderText} (metadata)`);
    metadataUserReminder.content.metadata = { systemReminder: { type: 'dynamic-agents-md' } };

    const legacyUserReminder = textMessage(`${reminderText} (legacy)`);
    legacyUserReminder.content.metadata = { dynamicAgentsMdReminder: { path: '/repo/AGENTS.md' } };

    return [
      textMessage('Please fix the login bug', 'user', 'u-1'),
      createSignal({ id: 'sig-reminder', type: 'system-reminder', contents: `${reminderText} (signal)` }).toDBMessage({
        threadId: 'thread-a',
      }),
      createSignal({ id: 'sig-notification', type: 'notification', contents: 'Build finished' }).toDBMessage({
        threadId: 'thread-a',
      }),
      createSignal({ id: 'sig-user', type: 'user', contents: 'Also check the signup page' }).toDBMessage({
        threadId: 'thread-a',
      }),
      textMessage(`<system-reminder type="dynamic-agents-md">${reminderText} (tagged)</system-reminder>`),
      metadataUserReminder,
      legacyUserReminder,
      createSignal({
        id: '__temporal_gap_test',
        type: 'reactive',
        tagName: 'system-reminder',
        contents: '10 minutes later — 9:10 AM',
        metadata: {
          reminderType: 'temporal-gap',
          gapText: '10 minutes later',
          systemReminder: { type: 'temporal-gap', gapText: '10 minutes later' },
        },
      }).toDBMessage({ threadId: 'thread-a' }),
      textMessage('On it — looking at auth.ts', 'assistant', 'a-1'),
    ];
  };

  /** Returns the formatted line that contains `needle`. */
  const lineWith = (text: string, needle: string) => text.split('\n').find(line => line.includes(needle));

  const expectLabeled = (text: string) => {
    expect(lineWith(text, 'Please fix the login bug')).toMatch(/^User\b/);
    expect(lineWith(text, 'On it — looking at auth.ts')).toMatch(/^Assistant\b/);
    for (const variant of ['signal', 'tagged', 'metadata', 'legacy']) {
      expect(lineWith(text, `${reminderText} (${variant})`)).toMatch(/^system-reminder\b/);
    }
    expect(lineWith(text, 'Build finished')).toMatch(/^notification\b/);
    expect(lineWith(text, 'Also check the signup page')).toMatch(/^User\b/);
    expect(lineWith(text, '10 minutes later')).not.toContain('<system-reminder');
  };

  it('labels reminders and signals by tag in the formatted history', () => {
    expectLabeled(formatMessagesForObserver(conversation()));
  });

  it('labels reminders and signals by tag in the single-thread history message', () => {
    expectLabeled(textOf(buildObserverHistoryMessage(conversation())));
  });

  it('labels reminders and signals by tag in the multi-thread history message', () => {
    expectLabeled(
      textOf(
        buildMultiThreadObserverHistoryMessage(
          new Map([
            ['thread-a', conversation()],
            ['thread-b', [textMessage('Thread B message', 'user', 'b-1')]],
          ]),
          ['thread-a', 'thread-b'],
        ),
      ),
    );
  });

  it('keeps ordinary user messages that merely mention system reminders labeled as the user', () => {
    const text = 'Why does my agent get a <system-reminder> tag in its prompt?';
    expect(lineWith(formatMessagesForObserver([textMessage(text, 'user')]), text)).toMatch(/^User\b/);
  });
});
