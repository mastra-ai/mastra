import { Container, Text } from '@earendil-works/pi-tui';
import type { AgentControllerMessage } from '@mastra/core/agent-controller';
import stripAnsi from 'strip-ansi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantMessageComponent } from '../../components/assistant-message.js';
import { isChatBoundarySpacer } from '../../components/chat-boundary-spacer.js';
import { NotificationSummaryComponent } from '../../components/notification-summary.js';
import { NotificationComponent } from '../../components/notification.js';
import { ReactiveSignalComponent } from '../../components/reactive-signal.js';
import { StateSignalComponent } from '../../components/state-signal.js';
import { SubagentExecutionComponent } from '../../components/subagent-execution.js';
import { SystemReminderComponent } from '../../components/system-reminder.js';
import { TemporalGapComponent } from '../../components/temporal-gap.js';
import { ToolExecutionComponentEnhanced } from '../../components/tool-execution-enhanced.js';
import { UserMessageComponent } from '../../components/user-message.js';
import { addPendingUserMessage, addUserMessage } from '../../render-messages.js';
import type { TUIState } from '../../state.js';
import { handleMessageEnd, handleMessageUpdate } from '../message.js';
import type { EventHandlerContext } from '../types.js';

function visibleChildren(state: TUIState) {
  return state.chatContainer.children.filter(child => !isChatBoundarySpacer(child));
}

function createAssistantMessage(content: AgentControllerMessage['content']): AgentControllerMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content,
  } as AgentControllerMessage;
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
      session: { displayState: { get: () => ({ isRunning: true }) } },
      controller: { session: { displayState: { get: () => ({ isRunning: true }) } } },
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
    } as AgentControllerMessage);

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

  it('renders streamed generic reactive signals', () => {
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'reactive_signal',
          tagName: 'build-status',
          message: 'Build is still running',
        } as never,
      ]),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(ReactiveSignalComponent);

    const rendered = stripAnsi((state.chatContainer.children[0] as ReactiveSignalComponent).render(80).join('\n'));
    expect(rendered).toContain('Signal: build-status');
    expect(rendered).toContain('Build is still running');
  });

  it('does not render streamed GitHub subscribe operation signals', () => {
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'reactive_signal',
          tagName: 'github-subscribe-pr',
          message: 'Subscribe to GitHub PR #17241',
        } as never,
      ]),
    );

    expect(state.chatContainer.children).toHaveLength(0);
  });

  it('keeps spacing when a streamed reminder is inserted before pending assistant text', () => {
    addUserMessage(state, {
      id: 'user-1',
      role: 'user',
      content: [{ type: 'text', text: 'hello' }],
    } as AgentControllerMessage);
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

  it('anchors a streamed state signal before pending assistant text', () => {
    addUserMessage(state, {
      id: 'user-1',
      role: 'user',
      content: [{ type: 'text', text: 'open the browser' }],
    } as AgentControllerMessage);
    state.streamingComponent = new AssistantMessageComponent(undefined, false);
    state.chatContainer.addChild(state.streamingComponent);

    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'state_signal',
          stateId: 'browser',
          mode: 'delta',
          cacheKey: 'browser:v1',
          message: 'changed: browser opened',
        } as never,
        { type: 'text', text: 'Done.' },
      ]),
    );

    const stateSignal = state.chatContainer.children.find(child => child instanceof StateSignalComponent);
    expect(visibleChildren(state)).toEqual([
      state.messageComponentsById.get('user-1'),
      stateSignal,
      state.streamingComponent,
    ]);
    expect(isChatBoundarySpacer(state.chatContainer.children[1]!)).toBe(true);
    expect(stripAnsi(state.streamingComponent!.render(80).join('\n'))).toContain('Done.');
  });

  it('does not render the tasks state signal inline (the pinned task UI shows it)', () => {
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'state_signal',
          stateId: 'tasks',
          mode: 'snapshot',
          cacheKey: 'tasks:v1',
          message: '<current-task-list>\n  ○ [pending] {id: alpha} Alpha\n</current-task-list>',
        } as never,
        { type: 'text', text: 'Tasks created.' },
      ]),
    );

    expect(state.chatContainer.children.some(child => child instanceof StateSignalComponent)).toBe(false);
  });

  it('does not render the goal state signal inline (the goal/judge UI shows it)', () => {
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'state_signal',
          stateId: 'goal',
          mode: 'snapshot',
          cacheKey: 'goal:v1',
          message: '<current-objective>\n  Ship the goal feature\n</current-objective>',
        } as never,
        { type: 'text', text: 'Goal set.' },
      ]),
    );

    expect(state.chatContainer.children.some(child => child instanceof StateSignalComponent)).toBe(false);
  });

  it('renders a streamed notification summary as an inline component', () => {
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'notification_summary',
          message: 'mastracode: 1',
          pending: 1,
          bySource: { mastracode: 1 },
        } as never,
      ]),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    const component = state.chatContainer.children[0];
    expect(component).toBeInstanceOf(NotificationSummaryComponent);
    const rendered = stripAnsi((component as NotificationSummaryComponent).render(80).join('\n'));
    expect(rendered).toContain('Notification summary: 1 pending');
    expect(rendered).toContain('mastracode: 1');
  });

  it('renders a streamed full notification as an inline component', () => {
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'notification',
          message: 'CI failed on main',
          source: 'github',
          kind: 'ci-status',
          priority: 'high',
          status: 'delivered',
        } as never,
      ]),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    const component = state.chatContainer.children[0];
    expect(component).toBeInstanceOf(NotificationComponent);
    const rendered = stripAnsi((component as NotificationComponent).render(100).join('\n'));
    expect(rendered).toContain('notification from github');
    expect(rendered).toContain('╭');
    expect(rendered).toContain('╰');
    expect(rendered).toContain('high · ci-status · delivered');
    expect(rendered).toContain('CI failed on main');
  });

  it('wraps long streamed full notifications within the terminal width', () => {
    const originalColumns = process.stdout.columns;
    process.stdout.columns = 80;

    try {
      handleMessageUpdate(
        ctx,
        createAssistantMessage([
          {
            type: 'notification',
            message:
              'mastra-ai/mastra#17449: feat(storage): add notification storage adapters was merged. This thread has been automatically unsubscribed from this PR. Resubscribe if you still need updates.',
            source: 'github',
            kind: 'pull-request-merged',
            priority: 'high',
            status: 'delivered',
          } as never,
        ]),
      );
    } finally {
      process.stdout.columns = originalColumns;
    }

    const component = state.chatContainer.children[0];
    expect(component).toBeInstanceOf(NotificationComponent);
    const renderedLines = stripAnsi((component as NotificationComponent).render(80).join('\n')).split('\n');
    expect(renderedLines.some(line => line.includes('automatically unsubscribed'))).toBe(true);
    expect(Math.max(...renderedLines.map(line => line.length))).toBeLessThanOrEqual(80);
  });

  it('splits parent assistant text around static plugin subagent renderers', () => {
    state.pluginManager = {
      getToolRenderConfig: vi.fn(() => ({ type: 'subagent', agentType: 'alexandria' })),
    } as unknown as TUIState['pluginManager'];

    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        { type: 'text', text: 'before plugin' },
        {
          type: 'tool_call',
          id: 'tool-1',
          name: 'mastra_expert',
          args: { question: 'Explain the agent loop' },
        } as never,
        { type: 'text', text: 'after plugin' },
      ]),
    );

    const children = visibleChildren(state);
    expect(children).toHaveLength(3);
    expect(children[0]).toBeInstanceOf(AssistantMessageComponent);
    expect(children[1]).toBeInstanceOf(SubagentExecutionComponent);
    expect(children[2]).toBeInstanceOf(AssistantMessageComponent);
    expect(stripAnsi((children[0] as AssistantMessageComponent).render(100).join('\n'))).toContain('before plugin');
    expect(stripAnsi((children[1] as SubagentExecutionComponent).render(100).join('\n'))).toContain(
      'Explain the agent loop',
    );
    expect(stripAnsi((children[2] as AssistantMessageComponent).render(100).join('\n'))).toContain('after plugin');
    expect(state.streamingComponent).toBe(children[2]);
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
    } as AgentControllerMessage;

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
    } as AgentControllerMessage);

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
    // TemporalGapComponent now participates in spacing, so boundary spacers
    // are placed above both the temporal gap and the optimistic user message.
    expect(isChatBoundarySpacer(state.chatContainer.children[1]!)).toBe(true);
    expect(isChatBoundarySpacer(state.chatContainer.children[3]!)).toBe(true);
  });

  it('surfaces failed pending tools in quiet mode when the assistant run errors', () => {
    state.quietMode = true;
    state.quietModeMaxToolPreviewLines = 2;

    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'tool_call',
          id: 'tool-1',
          name: 'ask_user',
          args: { question: 'Deploy now?' },
        } as never,
      ]),
    );

    const tool = state.pendingTools.get('tool-1');
    expect(tool).toBeInstanceOf(ToolExecutionComponentEnhanced);

    handleMessageEnd(ctx, {
      id: 'msg-1',
      role: 'assistant',
      content: [],
      stopReason: 'error',
      errorMessage: 'Tool execution failed: permission denied',
      createdAt: new Date(),
    } as AgentControllerMessage);

    expect(state.pendingTools.size).toBe(0);
    const output = stripAnsi((tool as ToolExecutionComponentEnhanced).render(100).join('\n'));
    expect(output).toContain('ask_user');
    expect(output).toContain('✗');
    expect(output).toContain('Tool execution failed: permission denied');
    expect(output).not.toContain('╭──');
  });

  it('dedupes state signals with same stateId but different cacheKey/mode', () => {
    const assistant = new AssistantMessageComponent(undefined, false);
    state.chatContainer.addChild(assistant);
    state.streamingComponent = assistant;

    // First state signal with cacheKey 'a'
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'state_signal',
          stateId: 'browser',
          mode: 'snapshot',
          cacheKey: 'session-a',
          message: 'Page A',
        } as never,
      ]),
    );
    const firstStateComponents = state.chatContainer.children.filter(c => c instanceof StateSignalComponent);
    expect(firstStateComponents).toHaveLength(1);

    // Same stateId + cacheKey + mode → deduped
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'state_signal',
          stateId: 'browser',
          mode: 'snapshot',
          cacheKey: 'session-a',
          message: 'Page A',
        } as never,
      ]),
    );
    const afterDupe = state.chatContainer.children.filter(c => c instanceof StateSignalComponent);
    expect(afterDupe).toHaveLength(1);

    // Same stateId but different cacheKey → NOT deduped
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'state_signal',
          stateId: 'browser',
          mode: 'snapshot',
          cacheKey: 'session-b',
          message: 'Page B',
        } as never,
      ]),
    );
    const afterDifferentCacheKey = state.chatContainer.children.filter(c => c instanceof StateSignalComponent);
    expect(afterDifferentCacheKey).toHaveLength(2);
  });
});
