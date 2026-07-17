import { MastraClient } from '@mastra/client-js';
import type { KnownAgentControllerEvent, PlanResume, SendNotificationInput } from '@mastra/client-js';

import {
  createInitialTranscript,
  initialTranscript,
  transcriptReducer,
} from '../../src/web/ui/domains/chat/services/transcript';
import type {
  ApprovalPrompt,
  NotificationEntry,
  SubagentEntry,
  SuspensionPrompt,
  TimelineEntry,
  TranscriptState,
} from '../../src/web/ui/domains/chat/services/transcript';

/**
 * Scenario driver — the web equivalent of MastraCode's `McE2eTerminal`.
 *
 * It connects the real `@mastra/client-js` SDK to a running scenario server,
 * folds the live SSE event stream through the *same* `transcriptReducer` the
 * React app uses, and exposes a terminal-style API over the resulting UI state:
 * `submit`/`steer` to act, `waitForText`/`getText` to assert, and prompt
 * helpers to drive approvals / ask_user / plan flows.
 *
 * Because the transcript it folds is exactly what `<App>` renders, asserting on
 * it is asserting on the product's on-screen behavior — minus pixel layout.
 */

export interface ScenarioDriver {
  /** Current folded transcript (what the UI would render). */
  state: () => TranscriptState;
  /**
   * Session-level mode/model, mirroring what the app's session-state layer
   * (ChatModes/ChatModels providers) renders in the status line. Kept in sync
   * from the initial `session.state()` fetch plus mode_changed/model_changed
   * events — mode/model intentionally no longer live on the transcript.
   */
  sessionState: () => { modeId?: string; modelId?: string };
  /**
   * Whether a run is in flight, mirroring the app's connection-state layer.
   * Run state intentionally no longer lives on the transcript reducer, so the
   * driver tracks it from raw agent_start/agent_end events.
   */
  running: () => boolean;
  /** Flattened visible text of the transcript, for substring assertions. */
  text: () => string;
  /** Resolve once `pattern` appears in the transcript text (or throw on timeout). */
  waitForText: (pattern: string | RegExp, timeoutMs?: number) => Promise<void>;
  /** Send a normal user message. */
  submit: (text: string) => Promise<void>;
  /** Steer the in-flight run. */
  steer: (text: string) => Promise<void>;
  abort: () => Promise<void>;
  switchMode: (modeId: string) => Promise<void>;
  /** Switch the session model. */
  switchModel: (modelId: string) => Promise<void>;
  /** Wait for a pending tool-approval prompt and return it. */
  waitForApproval: (timeoutMs?: number) => Promise<ApprovalPrompt>;
  approve: (approved: boolean) => Promise<void>;
  /** Wait for a suspended interactive tool (ask_user/plan/access). */
  waitForSuspension: (timeoutMs?: number) => Promise<SuspensionPrompt>;
  respond: (resumeData: string | string[] | PlanResume) => Promise<void>;
  /** Queue a follow-up message (queued if running, sent if idle). */
  followUp: (text: string) => Promise<void>;
  /** Create a new thread (session binds to it). Returns the new thread. */
  createThread: (title?: string) => Promise<{ id: string; title?: string }>;
  /** Switch to an existing thread. */
  switchThread: (threadId: string) => Promise<void>;
  /** List threads for the session. */
  listThreads: () => Promise<{ id: string; title?: string }[]>;
  /** List messages for a thread. */
  listMessages: (threadId: string) => Promise<unknown[]>;
  /** Set a goal objective. */
  setGoal: (objective: string) => Promise<void>;
  /** Get the current goal. */
  getGoal: () => Promise<unknown>;
  /** Clear the current goal. */
  clearGoal: () => Promise<void>;
  /** Wait for a subagent entry in the transcript. */
  waitForSubagent: (timeoutMs?: number) => Promise<SubagentEntry>;
  /** Wait for the run to become idle (running → false). */
  waitForIdle: (timeoutMs?: number) => Promise<void>;
  /** Send a notification signal to the session. */
  sendNotification: (input: SendNotificationInput) => Promise<void>;
  /** Wait for a notification entry to appear in the transcript. */
  waitForNotification: (timeoutMs?: number) => Promise<NotificationEntry>;
  /** Access the underlying SDK session (for multi-session scenarios). */
  getClient: () => MastraClient;
  dispose: () => Promise<void>;
}

export async function createDriver(opts: {
  baseUrl: string;
  resourceId: string;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}): Promise<ScenarioDriver> {
  const client = new MastraClient({ baseUrl: opts.baseUrl, fetch: opts.fetch as typeof fetch });
  const controller = client.getAgentController('code');
  const session = controller.session(opts.resourceId);

  let state: TranscriptState = initialTranscript;
  const apply = (next: TranscriptState) => {
    state = next;
  };

  await session.create();
  const initial = await session.state();
  let sessionState: { modeId?: string; modelId?: string } = {
    modeId: initial.modeId,
    modelId: initial.modelId,
  };
  let running = initial.running === true;
  apply(transcriptReducer(state, { type: 'reset', threadId: initial.threadId }));

  const sub = await session.subscribe({
    onEvent: event => {
      // Mirror the app: mode/model changes update the session-state layer
      // (query invalidation → refetch in React), not the transcript.
      const known = event as KnownAgentControllerEvent;
      if (known.type === 'mode_changed') {
        sessionState = { ...sessionState, modeId: known.modeId };
      } else if (known.type === 'model_changed') {
        sessionState = { ...sessionState, modelId: known.modelId };
      } else if (known.type === 'agent_start') {
        running = true;
      } else if (known.type === 'agent_end') {
        running = false;
      }
      apply(transcriptReducer(state, { type: 'event', event }));
    },
    onError: () => {},
  });

  const text = () => state.entries.map(entryText).filter(Boolean).join('\n');

  const waitFor = async <T>(probe: () => T | undefined, label: string, timeoutMs = 15_000): Promise<T> => {
    const start = Date.now();
    for (;;) {
      const value = probe();
      if (value !== undefined) return value;
      if (Date.now() - start > timeoutMs)
        throw new Error(`timeout waiting for ${label}\n--- transcript ---\n${text()}`);
      await sleep(25);
    }
  };

  return {
    state: () => state,
    sessionState: () => sessionState,
    running: () => running,
    text,
    waitForText: (pattern, timeoutMs) =>
      waitFor(() => (matches(text(), pattern) ? true : undefined), `text ${pattern}`, timeoutMs).then(() => undefined),
    submit: async t => {
      apply(transcriptReducer(state, { type: 'localUser', text: t }));
      await session.sendMessage(t);
    },
    steer: async t => {
      apply(transcriptReducer(state, { type: 'localUser', text: t, steer: true }));
      await session.steer(t);
    },
    abort: () => session.abort(),
    switchMode: modeId => session.switchMode(modeId),
    switchModel: modelId => session.switchModel(modelId),
    waitForApproval: timeoutMs =>
      waitFor(
        () => state.entries.find(e => e.kind === 'approval') as ApprovalPrompt | undefined,
        'tool approval',
        timeoutMs,
      ),
    approve: async approved => {
      const prompt = state.entries.find(e => e.kind === 'approval') as ApprovalPrompt | undefined;
      if (!prompt) throw new Error('no pending approval');
      apply(transcriptReducer(state, { type: 'resolvePrompt', id: prompt.id }));
      await session.approveTool(prompt.toolCallId, approved);
    },
    waitForSuspension: timeoutMs =>
      waitFor(
        () => state.entries.find(e => e.kind === 'suspension') as SuspensionPrompt | undefined,
        'tool suspension',
        timeoutMs,
      ),
    respond: async resumeData => {
      const prompt = state.entries.find(e => e.kind === 'suspension') as SuspensionPrompt | undefined;
      if (!prompt) throw new Error('no pending suspension');
      apply(transcriptReducer(state, { type: 'resolvePrompt', id: prompt.id }));
      await session.respondToToolSuspension(prompt.toolCallId, resumeData);
    },
    followUp: async t => {
      apply(transcriptReducer(state, { type: 'localUser', text: t }));
      await session.followUp(t);
    },
    createThread: async title => {
      const thread = await session.createThread(title);
      apply(transcriptReducer(state, { type: 'reset', threadId: thread.id }));
      return { id: thread.id, title: thread.title };
    },
    switchThread: async threadId => {
      await session.switchThread(threadId);
      // Mirror the hook: rebuild the transcript from the thread's persisted
      // history (its messages aren't replayed over the event stream).
      try {
        const [messages, snap] = await Promise.all([session.listMessages(threadId), session.state()]);
        sessionState = { modeId: snap.modeId, modelId: snap.modelId };
        apply(createInitialTranscript({ messages, threadId }));
      } catch {
        apply(transcriptReducer(state, { type: 'reset', threadId }));
      }
    },
    listThreads: async () => session.listThreads(),
    listMessages: async threadId => session.listMessages(threadId),
    setGoal: async objective => {
      await session.setGoal(objective);
    },
    getGoal: async () => {
      return session.getGoal();
    },
    clearGoal: async () => {
      await session.clearGoal();
    },
    waitForSubagent: timeoutMs =>
      waitFor(
        () => state.entries.find(e => e.kind === 'subagent') as SubagentEntry | undefined,
        'subagent entry',
        timeoutMs,
      ),
    waitForIdle: (timeoutMs = 15_000) =>
      waitFor(() => (!running ? true : undefined), 'idle', timeoutMs).then(() => undefined),
    sendNotification: async input => {
      await session.sendNotification(input);
    },
    waitForNotification: timeoutMs =>
      waitFor(
        () => state.entries.find(e => e.kind === 'notification') as NotificationEntry | undefined,
        'notification',
        timeoutMs,
      ),
    getClient: () => client,
    dispose: async () => {
      sub.unsubscribe();
    },
  };
}

function entryText(entry: TimelineEntry): string {
  switch (entry.kind) {
    case 'message': {
      const parts: string[] = [];
      for (const part of entry.message.content.parts) {
        if (part.type === 'text') {
          parts.push(part.text);
        } else if (part.type === 'reasoning') {
          parts.push(part.reasoning);
        } else if (part.type === 'tool-invocation') {
          const invocation = part.toolInvocation;
          const runtimeTool = entry.runtimeTools?.[invocation.toolCallId];
          parts.push(
            runtimeTool?.toolName ?? invocation.toolName,
            runtimeTool?.output ?? '',
            runtimeTool?.result === undefined ? '' : String(runtimeTool.result),
            invocation.state === 'result' && invocation.result !== undefined ? String(invocation.result) : '',
          );
        }
      }
      return parts.filter(Boolean).join(' ');
    }
    case 'notice':
      return entry.text;
    case 'approval':
      return `approve ${entry.toolName}`;
    case 'suspension':
      return `suspend ${entry.toolName}`;
    case 'notification':
      return `notification ${entry.message}`;
    case 'notification_summary':
      return `notification_summary ${entry.message}`;
    case 'subagent':
      return `subagent ${entry.agentType} ${entry.task}`;
    default:
      return '';
  }
}

function matches(haystack: string, pattern: string | RegExp): boolean {
  return typeof pattern === 'string' ? haystack.includes(pattern) : pattern.test(haystack);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
