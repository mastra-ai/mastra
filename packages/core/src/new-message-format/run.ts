import type { LanguageModel, ToolSet } from '@internal/ai-v7';
import { stepCountIs, streamText } from '@internal/ai-v7';
import { streamActions } from './from-ai-sdk';
import { trimResentInput } from './input-filter';
import { repairOpenRun, TOOL_NOT_STARTED_TEXT } from './repair';
import type { RepairCloser } from './repair';
import { createActionIdGenerator } from './storage';
import type { ListActionsQuery } from './storage';
import type { ActionDraft, AgentInput } from './to-actions';
import { toModelMessages } from './to-model-messages';
import type { ActionBase, MastraAction, PersistableAction } from './types';
import { isPersistable, isReadableAction, ToolNotStartedError } from './types';

export type ActionStore = {
  saveActions(args: { actions: PersistableAction[] }): Promise<void>;
  listActions(query: ListActionsQuery): Promise<PersistableAction[]>;
  getLatestActionId(threadId: string): Promise<string | null>;
};

export type RunAgentOptions = {
  model: Exclude<LanguageModel, string>;
  instructions?: string;
  tools?: ToolSet;
  input?: AgentInput;
  /** Actions appended after the input, e.g. a tool approval response when resuming. */
  append?: ActionDraft[];
  threadId: string;
  resourceId?: string;
  runId?: string;
  /** Recorded on the run's `run-start`. */
  agentId?: string;
  memory?: ActionStore;
  /** Prior actions to recall from the thread; defaults to all of them. */
  recall?: (history: PersistableAction[]) => PersistableAction[];
  maxTurns?: number;
  abortSignal?: AbortSignal;
  generateId?: () => string;
};

/** Recall window keeping the last `count` runs whole, so tool calls are never split from their results. */
export function lastRuns(count: number): (history: PersistableAction[]) => PersistableAction[] {
  return history => {
    const runs = [...new Set(history.map(a => a.runId))].slice(-count);
    return count > 0 ? history.filter(a => runs.includes(a.runId)) : [];
  };
}

/**
 * One agent run over actions: input → actions, thread recall → prompt, model stream → actions.
 * Every action is yielded.
 *
 * - Runs a crash left open are closed first (`repairOpenRun`), so the prompt is valid.
 * - `run-start` and the accepted input are saved before the model is called, so a crash mid-run can't
 *   lose them; a `tool-started` is saved before each tool executes; the rest is saved at each `turn-end`.
 * - If the run stops early (abort, error), the text streamed so far is stored marked `interrupted`, then
 *   the closers for this run: `run-aborted` on abort, `run-end` `interrupted` on error.
 * - Input the log already holds (a client resending the conversation) is dropped first.
 */
export async function* runAgent(options: RunAgentOptions): AsyncGenerator<MastraAction> {
  const { model, threadId, resourceId, memory } = options;
  const runId = options.runId ?? crypto.randomUUID();
  const generateId = options.generateId ?? (await createActionIdGenerator(memory, threadId));
  const modelId = typeof model === 'object' && 'modelId' in model ? model.modelId : 'unknown';

  const stored = memory ? await memory.listActions({ threadId }) : [];
  // Rows this reader can't read (a newer format version) are skipped, as projection skips them; a required
  // one throws here, as it would there.
  const history = stored.filter(isReadableAction);
  const { system, actions: drafts } = trimResentInput(options.input ?? [], history);
  const stamp = (forRunId: string | undefined = runId): ActionBase => ({
    id: generateId(),
    threadId,
    createdAt: new Date(),
    ...(forRunId !== undefined ? { runId: forRunId } : {}),
    ...(resourceId !== undefined ? { resourceId } : {}),
  });
  const close = (closers: RepairCloser[]) =>
    closers.map(c => ({ ...stamp(c.runId), ...c.action }) as PersistableAction);

  // A resumed run (an approval answer) continues under its runId and already has a run-start.
  const resuming = history.some(a => a.runId === runId);
  const additions = [...drafts, ...(options.append ?? [])];
  const repairs = close(
    repairOpenRun(history, {
      ...(resuming ? { resumingRunId: runId } : {}),
      answeredCallIds: answeredCalls(additions),
    }),
  );
  const recalled = options.recall ? options.recall([...history, ...repairs]) : [...history, ...repairs];

  const runStart: PersistableAction[] = resuming
    ? []
    : [
        {
          ...stamp(),
          type: 'run-start',
          agentId: options.agentId ?? 'unknown',
          modelId,
          settings: {
            ...(options.maxTurns !== undefined ? { maxSteps: options.maxTurns } : {}),
            ...(options.tools ? { toolNames: Object.keys(options.tools) } : {}),
          },
        },
      ];
  const input = additions.map(draft => ({ ...stamp(), ...draft }) as PersistableAction);

  let pending: PersistableAction[] = [...repairs, ...runStart, ...input];
  /** Everything of this run that was saved or is about to be, for closing it if it stops early. */
  const own: PersistableAction[] = [...runStart, ...input];
  // One write queue: batches commit in the order their ids were minted, so a reader paging by id never
  // passes a row that lands later. Each batch is taken when its turn in the queue comes, so a failed batch
  // goes back to the front of `pending` and the next flush retries it together with whatever followed: no
  // row ever lands without the rows before it. A failure also shuts the start gate for the rest of the run,
  // so a failed batch's tool-starteds are dropped: those tools never run, and their calls close as not
  // started. A flush whose write fails rejects; callers that await it fail the run.
  const extra: MastraAction[] = [];
  let writes: Promise<void> = Promise.resolve();
  let writeFailed = false;
  const flush = (): Promise<void> => {
    if (!memory) return writes;
    const write = writes.then(async () => {
      if (pending.length === 0) return;
      const batch = pending;
      pending = [];
      try {
        await memory.saveActions({ actions: batch });
      } catch (error) {
        writeFailed = true;
        const refused = new Set(batch.filter(a => a.type === 'tool-started'));
        pending = [...batch.filter(a => !refused.has(a)), ...pending];
        for (const list of [own, extra])
          for (let i = list.length - 1; i >= 0; i--) if (refused.has(list[i] as PersistableAction)) list.splice(i, 1);
        throw error;
      }
    });
    writes = write.catch(() => {});
    return write;
  };

  // The start gate. A tool runs only once its `tool-call` and `tool-started` are both saved and the run is
  // still going; otherwise its execute throws `ToolNotStartedError` instead of running. So `tool-started`
  // in the log means the tool may have run, and its absence means it did not.
  const seen = new Map<string, () => void>();
  const seenCall = new Map<string, Promise<void>>();
  // Calls already in the log (an approved call executing on resume) need no wait.
  for (const a of history) if (a.type === 'tool-call') seenCall.set(a.toolCallId, Promise.resolve());
  const callSeen = (toolCallId: string) => {
    if (!seenCall.has(toolCallId)) seenCall.set(toolCallId, new Promise(resolve => seen.set(toolCallId, resolve)));
    return seenCall.get(toolCallId)!;
  };
  const read = new Set(history.flatMap(a => (a.type === 'tool-call' ? [a.toolCallId] : [])));
  let stopped = false;
  let markStopped!: () => void;
  const whenStopped = new Promise<void>(resolve => (markStopped = resolve));
  const halted = () => stopped || !!options.abortSignal?.aborted;
  const mayRun = new Set<string>();
  /** Calls the gate refused at execute. Their tool-started may be saved, but they did not run. */
  const notRun = new Set<string>();
  const onToolExecutionStart = async (event: { toolCall: { toolCallId: string; toolName: string } }) => {
    const { toolCallId, toolName } = event.toolCall;
    await Promise.race([callSeen(toolCallId), aborted(options.abortSignal), whenStopped]);
    if (halted() || !read.has(toolCallId)) return;
    const started: PersistableAction = { ...stamp(), type: 'tool-started', toolCallId, toolName };
    pending.push(started);
    own.push(started);
    extra.push(started);
    try {
      await flush();
    } catch {
      return;
    }
    if (!writeFailed && !halted()) mayRun.add(toolCallId);
  };
  const tools = options.tools
    ? gateTools(
        options.tools,
        // Checked again at execute: an abort or a failed write between the grant and the call still stops it.
        toolCallId => {
          if (mayRun.has(toolCallId) && !halted() && !writeFailed) return true;
          notRun.add(toolCallId);
          return false;
        },
      )
    : undefined;

  const converter: { drain?: () => MastraAction[] } = {};
  let ended = false;
  // The stream's run-aborted is held back so the run's closers come before it.
  let abortedBy: PersistableAction | undefined;
  let failure: { error: unknown } | undefined;
  /** Every queued tool-started minted before `id` (all of them when `id` is undefined), in id order. */
  const takeExtra = (id?: string) => {
    const out: MastraAction[] = [];
    while (extra.length && (id === undefined || ('id' in extra[0]! && (extra[0].id as string) < id)))
      out.push(extra.shift()!);
    return out;
  };
  /**
   * The actions that close a run the stream didn't finish, queued for writing in log order: queued
   * tool-starteds, the text so far marked interrupted, open calls, an open turn, then run-aborted (on abort)
   * or run-end. Stops the start gate first, with no await before the closers are computed, so a late
   * tool-started is either already in `own` or refused.
   */
  const closeRun = (streamFailed: boolean): MastraAction[] => {
    stopped = true;
    markStopped();
    const wasAborted = !!abortedBy || !!options.abortSignal?.aborted;
    const out: MastraAction[] = takeExtra();
    for (const action of converter.drain?.() ?? []) {
      out.push(action);
      if (!isPersistable(action)) continue;
      pending.push(action);
      own.push(action);
    }
    // A refused call's tool-started is in the log, so repair would say its outcome is unknown; the gate knows
    // it did not run.
    const closers = close(repairOpenRun([...history, ...repairs, ...own], { resumingRunId: runId })).map(a =>
      a.type === 'tool-error' && notRun.has(a.toolCallId)
        ? ({ ...a, code: 'TOOL_NOT_STARTED', errorText: TOOL_NOT_STARTED_TEXT } as PersistableAction)
        : a,
    );
    if (wasAborted) {
      const runAborted = { ...(abortedBy ?? { type: 'run-aborted' }), ...stamp() } as PersistableAction;
      const runEnd = closers.findIndex(a => a.type === 'run-end');
      if (runEnd >= 0) closers.splice(runEnd, 1, runAborted);
      else closers.push(runAborted);
    } else if (streamFailed || failure) {
      // A provider error or a throw. A consumer's early return is not an error: its run-end stays interrupted.
      const runEnd = closers.findIndex(a => a.type === 'run-end');
      if (runEnd >= 0) closers[runEnd] = { ...closers[runEnd]!, finishReason: 'error' } as PersistableAction;
    }
    pending.push(...closers);
    own.push(...closers);
    return [...out, ...closers];
  };
  try {
    await flush();
    for (const action of [...repairs, ...runStart, ...input]) yield action;

    // A run with several approval requests resumes only once every one of them has an answer.
    const runLog = [...history.filter(a => a.runId === runId), ...input];
    const answered = new Set(runLog.flatMap(a => (a.type === 'tool-approval-responded' ? [a.approvalId] : [])));
    if (runLog.some(a => a.type === 'tool-approval-requested' && !answered.has(a.approvalId))) return;

    const instructions = [options.instructions, ...system].filter(Boolean).join('\n\n');
    const result = streamText({
      model,
      ...(instructions ? { system: instructions } : {}),
      messages: toModelMessages([...recalled, ...input]),
      tools,
      stopWhen: stepCountIs(options.maxTurns ?? 5),
      abortSignal: options.abortSignal,
      onToolExecutionStart,
    });

    for await (const action of streamActions(result.fullStream, {
      threadId,
      resourceId,
      runId,
      modelId,
      generateId,
      open: converter,
    })) {
      if (action.type === 'run-aborted') {
        abortedBy = action;
        continue;
      }
      if (isPersistable(action)) {
        pending.push(action);
        own.push(action);
      }
      if (action.type === 'tool-call') {
        read.add(action.toolCallId);
        void callSeen(action.toolCallId);
        seen.get(action.toolCallId)?.();
      }
      if (action.type === 'run-end') ended = true;
      // Yield in id order: a tool-started minted before this action goes first. Live readers (useChat,
      // Studio) then see what a reload of the log shows.
      yield* takeExtra(isPersistable(action) ? action.id : undefined);
      yield action;
      if (action.type === 'turn-end') await flush();
    }
    // The stream ended without a finish part: an abort, or a provider error (no throw). The consumer is
    // still reading, so it's told how the run closed, in the order the log holds it: the text so far,
    // open calls and the turn, then run-aborted or run-end with reason error. `finally` handles only an
    // early return, where nothing more can be yielded.
    if (!ended) {
      // Marked first: a consumer that returns while these are yielded must not close the run twice.
      ended = true;
      for (const closer of closeRun(true)) yield closer;
    }
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    // An early return or a throw: close the run without yielding. Writes still in flight (a tool-started)
    // land first: the queue keeps id order.
    if (!ended) closeRun(false);
    try {
      await flush();
    } catch (error) {
      // A failing closer write must not mask why the run stopped.
      if (!failure) throw error;
    }
  }
}

/**
 * Wraps each executable tool so it runs only when `mayRun` says so. The SDK awaits `onToolExecutionStart`
 * before calling execute, so the decision is made by then. The original's return value (a promise, a value,
 * or an async iterable for streaming tools) passes through untouched.
 */
function gateTools(tools: ToolSet, mayRun: (toolCallId: string) => boolean): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => {
      const execute = (tool as { execute?: (...args: unknown[]) => unknown }).execute;
      if (!execute) return [name, tool];
      return [
        name,
        {
          ...tool,
          execute: (...args: unknown[]) => {
            const { toolCallId } = (args[1] ?? {}) as { toolCallId?: string };
            if (!toolCallId || !mayRun(toolCallId)) throw new ToolNotStartedError();
            return execute.apply(tool, args);
          },
        },
      ];
    }),
  ) as ToolSet;
}

/** Calls the incoming input answers (tool outcomes, approval answers): repair must leave them open. */
function answeredCalls(actions: ActionDraft[]): Set<string> {
  const ids = new Set<string>();
  for (const a of actions) {
    if (
      a.type === 'tool-result' ||
      a.type === 'tool-error' ||
      a.type === 'tool-denied' ||
      a.type === 'tool-approval-responded'
    )
      ids.add(a.toolCallId);
  }
  return ids;
}

const aborted = (signal: AbortSignal | undefined) =>
  new Promise<void>(resolve => {
    if (!signal) return;
    if (signal.aborted) return resolve();
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
