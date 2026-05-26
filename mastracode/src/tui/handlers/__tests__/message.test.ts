import { Container, Text } from '@mariozechner/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';
import stripAnsi from 'strip-ansi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantMessageComponent } from '../../components/assistant-message.js';
import { isChatBoundarySpacer } from '../../components/chat-boundary-spacer.js';
import { SystemReminderComponent } from '../../components/system-reminder.js';
import { TemporalGapComponent } from '../../components/temporal-gap.js';
import { ToolExecutionComponentEnhanced } from '../../components/tool-execution-enhanced.js';
import { UserMessageComponent } from '../../components/user-message.js';
import { addPendingUserMessage, addUserMessage } from '../../render-messages.js';
import type { TUIState } from '../../state.js';
import { handleMessageUpdate } from '../message.js';
import type { EventHandlerContext } from '../types.js';

function visibleChildren(state: TUIState) {
  return state.chatContainer.children.filter(child => !isChatBoundarySpacer(child));
}

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
      pendingSignalMessageComponentsById: new Map(),
      harness: {
        getDisplayState: () => ({ isRunning: true }),
      },
    } as unknown as TUIState;

    ctx = {
      state,
      addChildBeforeFollowUps: (child: any) => {
        state.chatContainer.addChild(child);
      },
    } as EventHandlerContext;
  });

  it('adds spacing as soon as assistant text starts after a user message', () => {
    addUserMessage(state, {
      id: 'user-1',
      role: 'user',
      content: [{ type: 'text', text: 'hello' }],
    } as HarnessMessage);

    handleMessageUpdate(ctx, createAssistantMessage([{ type: 'text', text: 'assistant text' }]));

    const rendered = state.chatContainer.render(100);
    expect(rendered).toContain('');
  });

  it('renders a streamed loaded instruction path reminder', () => {
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

    const rendered = stripAnsi((component as SystemReminderComponent).render(80).join('\n'));

    expect(rendered).toContain('  loaded /repo/src/agents/nested/AGENTS.md');
    expect(rendered).not.toContain('Loading instruction file contents');
  });

  it('keeps spacing when a streamed reminder is inserted before pending assistant text', () => {
    addUserMessage(state, {
      id: 'user-1',
      role: 'user',
      content: [{ type: 'text', text: 'hello' }],
    } as HarnessMessage);
    state.streamingComponent = new AssistantMessageComponent(undefined, false);
    state.chatContainer.addChild(state.streamingComponent);

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

    expect(visibleChildren(state)).toEqual([
      state.messageComponentsById.get('user-1'),
      state.allSystemReminderComponents[0],
      state.streamingComponent,
    ]);
    expect(isChatBoundarySpacer(state.chatContainer.children[1]!)).toBe(true);
    expect(state.chatContainer.children).toHaveLength(4);
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

  it('does not render streamed goal-judge continuation signals because the judge result is already shown', () => {
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'system_reminder',
          reminderType: 'goal-judge',
          message: '[Goal attempt 1/500] Continue with Fact 2.',
        } as never,
      ]),
    );

    expect(state.chatContainer.children).toHaveLength(0);
    expect(state.allSystemReminderComponents).toHaveLength(0);
    expect(state.currentRunSystemReminderKeys.size).toBe(0);
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
    expect(visibleChildren(state)).toHaveLength(2);
  });

  it('starts a new assistant component below an echoed signal user message', () => {
    const streamingMessage = new Text('streaming', 0, 0);
    state.streamingComponent = streamingMessage as unknown as TUIState['streamingComponent'];
    state.streamingMessage = createAssistantMessage([{ type: 'text', text: 'first assistant text' }]);
    state.chatContainer.addChild(streamingMessage);

    addPendingUserMessage(state, 'signal-1', 'follow up');
    const pending = visibleChildren(state)[1];

    addUserMessage(state, {
      id: 'signal-1',
      role: 'user',
      content: [{ type: 'text', text: 'follow up' }],
    } as HarnessMessage);

    let children = visibleChildren(state);
    expect(children[0]).toBe(streamingMessage);
    expect(children[1]).toBeInstanceOf(UserMessageComponent);
    expect(children[1]).not.toBe(pending);
    expect(state.streamingComponent).toBeUndefined();

    handleMessageUpdate(ctx, createAssistantMessage([{ type: 'text', text: 'second assistant text' }]));

    children = visibleChildren(state);
    expect(children).toHaveLength(3);
    expect(children[0]).toBe(streamingMessage);
    expect(children[1]).toBeInstanceOf(UserMessageComponent);
    expect(children[2]).toBeInstanceOf(AssistantMessageComponent);
    expect(state.streamingComponent).toBe(children[2]);
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

    const children = visibleChildren(state);
    expect(children).toHaveLength(4);
    expect(children[1]).toBeInstanceOf(TemporalGapComponent);
    expect((children[1] as TemporalGapComponent).render(80).join('\n')).toContain('⏳ 1 hour later');
    expect(children[2]).toBe(userMessage);
    expect(children[3]).toBe(streamingMessage);
  });

  it('adds boundary spacing between a quiet tool preview and assistant text', () => {
    const tool = new ToolExecutionComponentEnhanced(
      'write_file',
      {},
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      state.ui,
    );
    tool.updateArgs({ path: 'src/example.ts', content: 'first line\nsecond line' });
    tool.updateResult({ content: [{ type: 'text', text: 'done' }], isError: false });

    const assistant = new AssistantMessageComponent(undefined, false);
    state.chatContainer.addChild(tool);
    state.chatContainer.addChild(assistant);
    state.streamingComponent = assistant;

    handleMessageUpdate(ctx, createAssistantMessage([{ type: 'text', text: 'assistant text' }]));

    const rendered = state.chatContainer.render(100);
    const toolLineIndex = rendered.findIndex(line => line.includes('write'));
    const textLineIndex = rendered.findIndex(line => line.includes('assistant text'));
    expect(rendered.slice(toolLineIndex + 1, textLineIndex)).toContain('');
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

    expect(visibleChildren(state)).toEqual([
      earlierUserMessage,
      state.allSystemReminderComponents[0],
      optimisticUserMessage,
      streamingMessage,
    ]);
    expect(state.allSystemReminderComponents[0]).toBeInstanceOf(TemporalGapComponent);
    expect(isChatBoundarySpacer(state.chatContainer.children[1]!)).toBe(true);
  });
});
