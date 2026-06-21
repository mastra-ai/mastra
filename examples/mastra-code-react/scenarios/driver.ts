import { MastraClient } from '@mastra/client-js';
import type { PlanResume, SendNotificationInput } from '@mastra/client-js';

import { initialTranscript, transcriptReducer } from '../web/transcript';
import type { ApprovalPrompt, NotificationEntry, SuspensionPrompt, TimelineEntry, TranscriptState } from '../web/transcript';

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
  /** Wait for a pending tool-approval prompt and return it. */
  waitForApproval: (timeoutMs?: number) => Promise<ApprovalPrompt>;
  approve: (approved: boolean) => Promise<void>;
  /** Wait for a suspended interactive tool (ask_user/plan/access). */
  waitForSuspension: (timeoutMs?: number) => Promise<SuspensionPrompt>;
  respond: (resumeData: string | string[] | PlanResume) => Promise<void>;
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
  const harness = client.getHarness('code');
  const session = harness.session(opts.resourceId);

  let state: TranscriptState = initialTranscript;
  const apply = (next: TranscriptState) => {
    state = next;
  };

  await session.create();
  const initial = await session.state();
  apply(transcriptReducer(state, { type: 'reset', modeId: initial.modeId, modelId: initial.modelId, threadId: initial.threadId }));

  const sub = await session.subscribe({
    onEvent: event => apply(transcriptReducer(state, { type: 'event', event })),
    onError: () => {},
  });

  const text = () =>
    state.entries
      .map(entryText)
      .filter(Boolean)
      .join('\n');

  const waitFor = async <T>(probe: () => T | undefined, label: string, timeoutMs = 15_000): Promise<T> => {
    const start = Date.now();
    for (;;) {
      const value = probe();
      if (value !== undefined) return value;
      if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${label}\n--- transcript ---\n${text()}`);
      await sleep(25);
    }
  };

  return {
    state: () => state,
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
    waitForApproval: timeoutMs =>
      waitFor(() => state.entries.find(e => e.kind === 'approval') as ApprovalPrompt | undefined, 'tool approval', timeoutMs),
    approve: async approved => {
      const prompt = state.entries.find(e => e.kind === 'approval') as ApprovalPrompt | undefined;
      if (!prompt) throw new Error('no pending approval');
      apply(transcriptReducer(state, { type: 'resolvePrompt', id: prompt.id }));
      await session.approveTool(prompt.toolCallId, approved);
    },
    waitForSuspension: timeoutMs =>
      waitFor(() => state.entries.find(e => e.kind === 'suspension') as SuspensionPrompt | undefined, 'tool suspension', timeoutMs),
    respond: async resumeData => {
      const prompt = state.entries.find(e => e.kind === 'suspension') as SuspensionPrompt | undefined;
      if (!prompt) throw new Error('no pending suspension');
      apply(transcriptReducer(state, { type: 'resolvePrompt', id: prompt.id }));
      await session.respondToToolSuspension(prompt.toolCallId, resumeData);
    },
    sendNotification: async input => {
      await session.sendNotification(input);
    },
    waitForNotification: timeoutMs =>
      waitFor(() => state.entries.find(e => e.kind === 'notification') as NotificationEntry | undefined, 'notification', timeoutMs),
    getClient: () => client,
    dispose: async () => {
      sub.unsubscribe();
    },
  };
}

function entryText(entry: TimelineEntry): string {
  switch (entry.kind) {
    case 'user':
    case 'assistant':
      return [entry.kind === 'assistant' ? (entry as { text: string }).text : (entry as { text: string }).text]
        .concat(entry.kind === 'assistant' ? (entry as { tools: { toolName: string; output: string }[] }).tools.flatMap(t => [t.toolName, t.output]) : [])
        .join(' ');
    case 'notice':
      return (entry as { text: string }).text;
    case 'approval':
      return `approve ${(entry as ApprovalPrompt).toolName}`;
    case 'suspension':
      return `suspend ${(entry as SuspensionPrompt).toolName}`;
    case 'notification':
      return `notification ${(entry as NotificationEntry).message}`;
    case 'notification_summary':
      return `notification_summary ${(entry as { message: string }).message}`;
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
