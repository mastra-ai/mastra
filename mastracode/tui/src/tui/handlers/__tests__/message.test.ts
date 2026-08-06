import { Container, Text } from '@earendil-works/pi-tui';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { createSignal } from '@mastra/core/signals';
import stripAnsi from 'strip-ansi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantMessageComponent } from '../../components/assistant-message.js';
import { isChatBoundarySpacer } from '../../components/chat-boundary-spacer.js';
import { JudgeDisplayComponent } from '../../components/judge-display.js';
import { NotificationSummaryComponent } from '../../components/notification-summary.js';
import { NotificationComponent } from '../../components/notification.js';
import { ReactiveSignalComponent } from '../../components/reactive-signal.js';
import { StateSignalComponent } from '../../components/state-signal.js';
import { SubagentExecutionComponent } from '../../components/subagent-execution.js';
import { SystemReminderComponent } from '../../components/system-reminder.js';
import { TemporalGapComponent } from '../../components/temporal-gap.js';
import { ToolExecutionComponentEnhanced } from '../../components/tool-execution-enhanced.js';
import { UserMessageComponent } from '../../components/user-message.js';
import { addPendingUserMessage, addUserMessage as renderUserMessage } from '../../render-messages.js';
import type { TUIState } from '../../state.js';
import { handleGoalEvaluation } from '../agent-lifecycle.js';
import { handleMessageEnd, handleMessageStart, handleMessageUpdate } from '../message.js';
import type { EventHandlerContext } from '../types.js';

function visibleChildren(state: TUIState) {
  return state.chatContainer.children.filter(child => !isChatBoundarySpacer(child));
}

function addUserMessage(state: TUIState, message: MastraDBMessage): void {
  renderUserMessage(state, message);
}

type Part = Exclude<MastraDBMessage['content'], string>['parts'][number];

function assistantMessage(parts: Part[], id = 'msg-1'): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    content: { format: 2, parts },
  } as MastraDBMessage;
}

function terminalMessage(
  parts: Part[],
  metadata: { stopReason?: string; errorMessage?: string },
  id = 'msg-1',
): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    content: { format: 2, parts, metadata },
  } as MastraDBMessage;
}

function userMessage(text: string, id = 'user-1'): MastraDBMessage {
  return {
    id,
    role: 'user',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    content: { format: 2, parts: [{ type: 'text', text }] },
  } as MastraDBMessage;
}

function toolPart(input: {
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
  result?: unknown;
}): Part {
  const hasResult = input.result !== undefined;
  return {
    type: 'tool-invocation',
    toolInvocation: {
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      args: input.args ?? {},
      state: hasResult ? 'result' : 'call',
      ...(hasResult ? { result: input.result } : {}),
    },
  } as Part;
}

function signalMessage(input: Parameters<typeof createSignal>[0], id?: string): MastraDBMessage {
  const message = createSignal(input).toDBMessage();
  return id ? ({ ...message, id } as MastraDBMessage) : message;
}

function reminderSignal(
  attributes: {
    type?: string;
    path?: string;
    gapText?: string;
    precedesMessageId?: string;
  },
  contents = '',
  id?: string,
): MastraDBMessage {
  return signalMessage(
    {
      type: 'reactive',
      tagName: 'system-reminder',
      contents,
      attributes,
    } as Parameters<typeof createSignal>[0],
    id,
  );
}

describe('handleMessageStart signals', () => {
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
      addUserMessage: message => renderUserMessage(state, message),
      addChildBeforeFollowUps: (child: any) => {
        state.chatContainer.addChild(child);
      },
    } as EventHandlerContext;
  });

  it('renders a streamed loaded instruction path reminder', () => {
    handleMessageStart(ctx, reminderSignal({ type: 'dynamic-agents-md', path: '/repo/src/agents/nested/AGENTS.md' }));

    expect(visibleChildren(state)).toHaveLength(1);
    expect(state.allSystemReminderComponents).toHaveLength(1);
    const component = visibleChildren(state)[0];
    expect(component).toBeInstanceOf(SystemReminderComponent);
    expect(state.allSystemReminderComponents[0]).toBe(component);

    const rendered = stripAnsi((component as SystemReminderComponent).render(80).join('\n'));
    expect(rendered).toContain('  loaded /repo/src/agents/nested/AGENTS.md');
    expect(rendered).not.toContain('Loading instruction file contents');
  });

  it('renders streamed generic reactive signals', () => {
    handleMessageStart(
      ctx,
      signalMessage({ type: 'reactive', tagName: 'build-status', contents: 'Build is still running' }),
    );

    expect(visibleChildren(state)).toHaveLength(1);
    expect(visibleChildren(state)[0]).toBeInstanceOf(ReactiveSignalComponent);

    const rendered = stripAnsi((visibleChildren(state)[0] as ReactiveSignalComponent).render(80).join('\n'));
    expect(rendered).toContain('Signal: build-status');
    expect(rendered).toContain('Build is still running');
  });

  it('confirms pending steering from the delivered DB-native user signal', () => {
    addPendingUserMessage(state, 'steer-1', 'Change direction', [{ data: 'image-data', mimeType: 'image/png' }], {
      isInterjection: true,
    });

    handleMessageStart(
      ctx,
      signalMessage(
        {
          id: 'steer-1',
          type: 'user',
          contents: [
            { type: 'text', text: 'Change direction' },
            { type: 'file', data: 'image-data', mediaType: 'image/png' },
          ],
          attributes: { delivery: 'while-active' },
        },
        'steer-1',
      ),
    );

    expect(state.pendingSignalMessageComponentsById.has('steer-1')).toBe(false);
    const component = state.messageComponentsById.get('steer-1');
    expect(component).toBeInstanceOf(UserMessageComponent);
    const rendered = stripAnsi((component as UserMessageComponent).render(100).join('\n'));
    expect(rendered).toContain('steer');
    expect(rendered).toContain('[1 image] Change direction');
  });

  it('does not render streamed GitHub subscribe operation signals', () => {
    handleMessageStart(
      ctx,
      signalMessage({ type: 'reactive', tagName: 'github-subscribe-pr', contents: 'Subscribe to GitHub PR #17241' }),
    );

    expect(visibleChildren(state)).toHaveLength(0);
  });

  it('anchors a streamed state signal before pending assistant text', () => {
    addUserMessage(state, userMessage('open the browser'));
    state.streamingComponent = new AssistantMessageComponent(undefined, false);
    state.chatContainer.addChild(state.streamingComponent);

    handleMessageStart(
      ctx,
      signalMessage({
        type: 'state',
        tagName: 'browser',
        contents: 'changed: browser opened',
        metadata: { state: { id: 'browser', mode: 'delta' } },
      } as Parameters<typeof createSignal>[0]),
    );

    const stateSignal = visibleChildren(state).find(child => child instanceof StateSignalComponent);
    expect(stateSignal).toBeInstanceOf(StateSignalComponent);
    const rendered = stripAnsi((stateSignal as StateSignalComponent).render(80).join('\n'));
    expect(rendered).toContain('browser');
    expect(rendered).toContain('changed: browser opened');
  });

  it('does not render the tasks state signal inline (the pinned task UI shows it)', () => {
    handleMessageStart(
      ctx,
      signalMessage({
        type: 'state',
        tagName: 'tasks',
        contents: '<current-task-list>\n  ○ [pending] {id: alpha} Alpha\n</current-task-list>',
        metadata: { state: { id: 'tasks', mode: 'snapshot' } },
      } as Parameters<typeof createSignal>[0]),
    );

    expect(state.chatContainer.children.some(child => child instanceof StateSignalComponent)).toBe(false);
  });

  it('does not render the goal state signal inline (the goal/judge UI shows it)', () => {
    handleMessageStart(
      ctx,
      signalMessage({
        type: 'state',
        tagName: 'goal',
        contents: '<current-objective>\n  Ship the goal feature\n</current-objective>',
        metadata: { state: { id: 'goal', mode: 'snapshot' } },
      } as Parameters<typeof createSignal>[0]),
    );

    expect(state.chatContainer.children.some(child => child instanceof StateSignalComponent)).toBe(false);
  });

  it('renders a streamed notification summary as an inline component', () => {
    handleMessageStart(
      ctx,
      signalMessage({
        type: 'notification',
        tagName: 'notification-summary',
        contents: 'mastracode: 1',
        metadata: { notificationSummary: { pending: 1, bySource: { mastracode: 1 } } },
      } as Parameters<typeof createSignal>[0]),
    );

    expect(visibleChildren(state)).toHaveLength(1);
    const component = visibleChildren(state)[0];
    expect(component).toBeInstanceOf(NotificationSummaryComponent);
    const rendered = stripAnsi((component as NotificationSummaryComponent).render(80).join('\n'));
    expect(rendered).toContain('Notification summary: 1 pending');
    expect(rendered).toContain('mastracode: 1');
  });

  it('renders a streamed full notification as an inline component', () => {
    handleMessageStart(
      ctx,
      signalMessage({
        type: 'notification',
        tagName: 'notification',
        contents: 'CI failed on main',
        attributes: { source: 'github', kind: 'ci-status', priority: 'high', status: 'delivered' },
      } as Parameters<typeof createSignal>[0]),
    );

    expect(visibleChildren(state)).toHaveLength(1);
    const component = visibleChildren(state)[0];
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
      handleMessageStart(
        ctx,
        signalMessage({
          type: 'notification',
          tagName: 'notification',
          contents:
            'mastra-ai/mastra#17449: feat(storage): add notification storage adapters was merged. This thread has been automatically unsubscribed from this PR. Resubscribe if you still need updates.',
          attributes: { source: 'github', kind: 'pull-request-merged', priority: 'high', status: 'delivered' },
        } as Parameters<typeof createSignal>[0]),
      );
    } finally {
      process.stdout.columns = originalColumns;
    }

    const component = visibleChildren(state)[0];
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
      assistantMessage([
        { type: 'text', text: 'before plugin' } as Part,
        toolPart({ toolCallId: 'tool-1', toolName: 'mastra_expert', args: { question: 'Explain the agent loop' } }),
        { type: 'text', text: 'after plugin' } as Part,
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

  it('deduplicates repeated streamed reminders by message id', () => {
    const message = reminderSignal(
      { type: 'dynamic-agents-md', path: '/repo/src/agents/nested/AGENTS.md' },
      '',
      'rem-1',
    );

    handleMessageStart(ctx, message);
    handleMessageStart(ctx, message);

    expect(visibleChildren(state)).toHaveLength(1);
  });

  it('does not render streamed goal-judge continuation signals because the judge result is already shown', () => {
    handleMessageStart(ctx, reminderSignal({ type: 'goal-judge' }, '[Goal attempt 1/500] Continue with Fact 2.'));

    expect(visibleChildren(state)).toHaveLength(0);
    expect(state.allSystemReminderComponents).toHaveLength(0);
  });

  it('allows two distinct reminders to render', () => {
    handleMessageStart(
      ctx,
      reminderSignal({ type: 'dynamic-agents-md', path: '/repo/src/agents/nested/AGENTS.md' }, '', 'rem-1'),
    );
    expect(visibleChildren(state)).toHaveLength(1);

    handleMessageStart(
      ctx,
      reminderSignal({ type: 'dynamic-agents-md', path: '/repo/src/agents/nested/AGENTS.md' }, '', 'rem-2'),
    );
    expect(visibleChildren(state)).toHaveLength(2);
  });

  it('inserts temporal-gap reminders before the preceded user message', () => {
    const previousMessage = new Text('previous', 0, 0);
    const userComponent = new Text('user', 0, 0);
    const streamingMessage = new Text('streaming', 0, 0);

    state.chatContainer.addChild(previousMessage);
    state.chatContainer.addChild(userComponent);
    state.chatContainer.addChild(streamingMessage);
    state.messageComponentsById.set('user-1', userComponent);
    state.streamingComponent = streamingMessage as unknown as TUIState['streamingComponent'];

    handleMessageStart(
      ctx,
      reminderSignal(
        {
          type: 'temporal-gap',
          gapText: '1 hour later',
          precedesMessageId: 'user-1',
        },
        '1 hour later — 04/20/2026, 03:35 PM PDT',
      ),
    );

    const children = visibleChildren(state);
    expect(children).toHaveLength(4);
    expect(children[1]).toBeInstanceOf(TemporalGapComponent);
    expect((children[1] as TemporalGapComponent).render(80).join('\n')).toContain('⏳ 1 hour later');
    expect(children[2]).toBe(userComponent);
    expect(children[3]).toBe(streamingMessage);
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

    handleMessageStart(
      ctx,
      reminderSignal(
        {
          type: 'temporal-gap',
          gapText: '30 minutes later',
          precedesMessageId: 'actual-user-id-from-core',
        },
        '30 minutes later — 04/20/2026, 03:35 PM PDT',
      ),
    );

    expect(visibleChildren(state)).toEqual([
      earlierUserMessage,
      state.allSystemReminderComponents[0],
      optimisticUserMessage,
      streamingMessage,
    ]);
    expect(state.allSystemReminderComponents[0]).toBeInstanceOf(TemporalGapComponent);
    expect(isChatBoundarySpacer(state.chatContainer.children[1]!)).toBe(true);
    expect(isChatBoundarySpacer(state.chatContainer.children[3]!)).toBe(true);
  });
});

describe('goal evaluation live rendering ownership', () => {
  const evaluation = {
    objective: 'List whale facts',
    iteration: 2,
    maxRuns: 20,
    passed: false,
    status: 'active',
    results: [],
    reason: 'Need another fact.',
    duration: 0,
    timedOut: false,
    maxRunsReached: false,
    suppressFeedback: false,
  } as Parameters<typeof handleGoalEvaluation>[1];

  function createGoalJudgeSignal(): MastraDBMessage {
    return signalMessage(
      {
        type: 'reactive',
        tagName: 'system-reminder',
        contents: '[Goal attempt 2/20] Continue.',
        attributes: { type: 'goal-judge' },
        metadata: { goalEvaluation: evaluation },
      } as Parameters<typeof createSignal>[0],
      'goal-judge-signal',
    );
  }

  function createContext(): EventHandlerContext {
    const state = {
      chatContainer: new Container(),
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
      goalManager: {
        getGoal: vi.fn(() => ({ id: 'goal-1', judgeModelId: 'openai/gpt-5.4-mini' })),
        applyEvaluation: vi.fn(),
      },
      session: { displayState: { get: () => ({ isRunning: true }) } },
      controller: { session: { displayState: { get: () => ({ isRunning: true }) } } },
    } as unknown as TUIState;

    return {
      state,
      addUserMessage: (message: MastraDBMessage) => renderUserMessage(state, message),
      updateStatusLine: vi.fn(),
      addChildBeforeFollowUps: (child: any) => state.chatContainer.addChild(child),
    } as unknown as EventHandlerContext;
  }

  it.each([
    ['goal_evaluation then live signal', true],
    ['live signal then goal_evaluation', false],
  ])('renders one judge component when delivery order is %s', (_label, lifecycleFirst) => {
    const ctx = createContext();
    const renderLifecycle = () => {
      handleGoalEvaluation(ctx, evaluation);
    };
    const renderSignal = () => {
      const signal = createGoalJudgeSignal();
      handleMessageStart(ctx, signal);
      handleMessageUpdate(ctx, signal);
      handleMessageEnd(ctx, signal);
    };

    if (lifecycleFirst) {
      renderLifecycle();
      renderSignal();
    } else {
      renderSignal();
      renderLifecycle();
    }

    const children = visibleChildren(ctx.state);
    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(JudgeDisplayComponent);
    expect(ctx.state.messageComponentsById.has('goal-judge-signal')).toBe(false);
    expect(ctx.state.goalManager.applyEvaluation).toHaveBeenCalledTimes(1);
  });
});

describe('handleMessageUpdate assistant streaming', () => {
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
      pendingTaskToolIds: new Set(),
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
      addUserMessage: message => renderUserMessage(state, message),
      addChildBeforeFollowUps: (child: any) => {
        state.chatContainer.addChild(child);
      },
    } as EventHandlerContext;
  });

  it('adds spacing as soon as assistant text starts after a user message', () => {
    addUserMessage(state, userMessage('hello'));

    handleMessageUpdate(ctx, assistantMessage([{ type: 'text', text: 'assistant text' }]));

    const rendered = state.chatContainer.render(100);
    expect(rendered).toContain('');
  });

  it('starts a new assistant component below an echoed signal user message', () => {
    const streamingMessage = new Text('streaming', 0, 0);
    state.streamingComponent = streamingMessage as unknown as TUIState['streamingComponent'];
    state.streamingMessage = assistantMessage([{ type: 'text', text: 'first assistant text' }]);
    state.chatContainer.addChild(streamingMessage);

    addPendingUserMessage(state, 'signal-1', 'follow up');
    const pending = visibleChildren(state)[1];

    addUserMessage(state, userMessage('follow up', 'signal-1'));

    let children = visibleChildren(state);
    expect(children[0]).toBe(streamingMessage);
    expect(children[1]).toBeInstanceOf(UserMessageComponent);
    expect(children[1]).not.toBe(pending);
    expect(state.streamingComponent).toBeUndefined();

    handleMessageUpdate(ctx, assistantMessage([{ type: 'text', text: 'second assistant text' }]));

    children = visibleChildren(state);
    expect(children).toHaveLength(3);
    expect(children[0]).toBe(streamingMessage);
    expect(children[1]).toBeInstanceOf(UserMessageComponent);
    expect(children[2]).toBeInstanceOf(AssistantMessageComponent);
    expect(state.streamingComponent).toBe(children[2]);
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

    handleMessageUpdate(ctx, assistantMessage([{ type: 'text', text: 'assistant text' }]));

    const rendered = state.chatContainer.render(100);
    const toolLineIndex = rendered.findIndex(line => line.includes('write'));
    const textLineIndex = rendered.findIndex(line => line.includes('assistant text'));
    expect(rendered.slice(toolLineIndex + 1, textLineIndex)).toContain('');
  });

  it('surfaces failed pending tools in quiet mode when the assistant run errors', () => {
    state.quietMode = true;
    state.quietModeMaxToolPreviewLines = 2;

    handleMessageUpdate(
      ctx,
      assistantMessage([toolPart({ toolCallId: 'tool-1', toolName: 'ask_user', args: { question: 'Deploy now?' } })]),
    );

    const tool = state.pendingTools.get('tool-1');
    expect(tool).toBeInstanceOf(ToolExecutionComponentEnhanced);

    handleMessageEnd(
      ctx,
      terminalMessage([], { stopReason: 'error', errorMessage: 'Tool execution failed: permission denied' }),
    );

    expect(state.pendingTools.size).toBe(0);
    const output = stripAnsi((tool as ToolExecutionComponentEnhanced).render(100).join('\n'));
    expect(output).toContain('ask_user');
    expect(output).toContain('✗');
    expect(output).toContain('Tool execution failed: permission denied');
    expect(output).not.toContain('╭──');
  });
});
