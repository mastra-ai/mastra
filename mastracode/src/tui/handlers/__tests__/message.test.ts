import { Container, Text } from '@mariozechner/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemReminderComponent } from '../../components/system-reminder.js';
import { TemporalGapComponent } from '../../components/temporal-gap.js';
import { UserMessageComponent } from '../../components/user-message.js';
import type { TUIState } from '../../state.js';
import { handleMessageUpdate } from '../message.js';
import type { EventHandlerContext } from '../types.js';

function createAssistantMessage(content: HarnessMessage['content']): HarnessMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content,
  } as HarnessMessage;
}

describe('handleMessageUpdate system reminders', () => {
  let state: TUIState;
  let ctx: EventHandlerContext;

  beforeEach(() => {
    const chatContainer = new Container();
    state = {
      chatContainer,
      followUpComponents: [],
      ui: { requestRender: vi.fn() },
      currentRunSystemReminderKeys: new Set(),
      pendingTools: new Map(),
      seenToolCallIds: new Set(),
      subagentToolCallIds: new Set(),
      allToolComponents: [],
      allSlashCommandComponents: [],
      allSystemReminderComponents: [],
      messageComponentsById: new Map(),
      pendingSubagents: new Map(),
      hideThinkingBlock: false,
      toolOutputExpanded: false,
    } as unknown as TUIState;

    ctx = {
      state,
      addChildBeforeFollowUps: (child: any) => {
        state.chatContainer.addChild(child);
      },
    } as EventHandlerContext;
  });

  it('renders a streamed placeholder when reminder content is not available yet', () => {
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'system_reminder',
          reminderType: 'dynamic-agents-md',
          path: '/repo/src/agents/nested/AGENTS.md',
        } as never,
      ]),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.allSystemReminderComponents).toHaveLength(1);
    const component = state.chatContainer.children[0];
    expect(component).toBeInstanceOf(SystemReminderComponent);
    expect(state.allSystemReminderComponents[0]).toBe(component);

    const rendered = (component as SystemReminderComponent).render(80).join('\n');

    expect(rendered).toContain('Loaded AGENTS.md');
    expect(rendered).toContain('Loading instruction file contents');
  });

  it('deduplicates repeated streamed reminders within the same assistant run', () => {
    const message = createAssistantMessage([
      {
        type: 'system_reminder',
        reminderType: 'dynamic-agents-md',
        path: '/repo/src/agents/nested/AGENTS.md',
      } as never,
    ]);

    handleMessageUpdate(ctx, message);
    handleMessageUpdate(ctx, message);

    expect(state.chatContainer.children).toHaveLength(1);
  });

  it('allows the same reminder to render again in a later assistant run', () => {
    const firstMessage = createAssistantMessage([
      {
        type: 'system_reminder',
        reminderType: 'dynamic-agents-md',
        path: '/repo/src/agents/nested/AGENTS.md',
      } as never,
    ]);

    const secondMessage = {
      ...firstMessage,
      id: 'msg-2',
    } as HarnessMessage;

    handleMessageUpdate(ctx, firstMessage);
    expect(state.chatContainer.children).toHaveLength(1);

    state.currentRunSystemReminderKeys.clear();

    handleMessageUpdate(ctx, secondMessage);
    expect(state.chatContainer.children).toHaveLength(2);
  });

  it('inserts temporal-gap reminders before the preceded user message', () => {
    const previousMessage = new Text('previous', 0, 0);
    const userMessage = new Text('user', 0, 0);
    const streamingMessage = new Text('streaming', 0, 0);

    state.chatContainer.addChild(previousMessage);
    state.chatContainer.addChild(userMessage);
    state.chatContainer.addChild(streamingMessage);
    state.messageComponentsById.set('user-1', userMessage);
    state.streamingComponent = streamingMessage as unknown as TUIState['streamingComponent'];

    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'system_reminder',
          reminderType: 'temporal-gap',
          message: '1 hour later — 04/20/2026, 03:35 PM PDT',
          gapText: '1 hour later',
          precedesMessageId: 'user-1',
        } as never,
      ]),
    );

    expect(state.chatContainer.children).toHaveLength(4);
    expect(state.chatContainer.children[1]).toBeInstanceOf(TemporalGapComponent);
    expect((state.chatContainer.children[1] as TemporalGapComponent).render(80).join('\n')).toContain(
      '⏳ 1 hour later',
    );
    expect(state.chatContainer.children[2]).toBe(userMessage);
    expect(state.chatContainer.children[3]).toBe(streamingMessage);
  });

  it('falls back to the latest rendered user message when a streamed temporal-gap anchor id is not mapped yet', () => {
    const earlierUserMessage = new UserMessageComponent('earlier user');
    const optimisticUserMessage = new UserMessageComponent('optimistic user');
    const streamingMessage = new Text('streaming', 0, 0);

    state.chatContainer.addChild(earlierUserMessage);
    state.chatContainer.addChild(optimisticUserMessage);
    state.chatContainer.addChild(streamingMessage);
    state.messageComponentsById.set('older-user-id', earlierUserMessage);
    state.streamingComponent = streamingMessage as unknown as TUIState['streamingComponent'];

    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'system_reminder',
          reminderType: 'temporal-gap',
          message: '30 minutes later — 04/20/2026, 03:35 PM PDT',
          gapText: '30 minutes later',
          precedesMessageId: 'actual-user-id-from-core',
        } as never,
      ]),
    );

    expect(state.chatContainer.children).toHaveLength(4);
    expect(state.chatContainer.children[0]).toBe(earlierUserMessage);
    expect(state.chatContainer.children[1]).toBeInstanceOf(TemporalGapComponent);
    expect(state.chatContainer.children[2]).toBe(optimisticUserMessage);
    expect(state.chatContainer.children[3]).toBe(streamingMessage);
  });
});
