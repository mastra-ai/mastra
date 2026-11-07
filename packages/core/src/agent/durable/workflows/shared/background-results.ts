import { createRunScope, createRunScopeKey } from '../../../../mastra/run-scope';
import type { MessageList } from '../../../message-list';
import type { RunRegistryEntry } from '../../types';

/**
 * A background tool result this process applied, kept so later steps can write it into their transcript.
 *
 * `onResult` writes a finished task into the message list the tool-call step held. Later steps rebuild
 * the transcript from workflow state, which still holds the placeholder, so without this the next model
 * call would see the placeholder and the final save would write it over the stored result.
 */
export type BackgroundResultRecord = {
  toolCallId: string;
  /** Resolves once `onResult` has finished, whether or not it applied the result. */
  settled: Promise<unknown>;
  done?: boolean;
  /** Writes the result into a transcript without saving it. Set by `onResult`. */
  apply?: (messageList: MessageList) => Promise<void>;
};

const BACKGROUND_RESULTS = createRunScopeKey<Map<string, BackgroundResultRecord>>('durable-background-results');

/** Returns the record for `taskId`, replacing one left by an earlier attempt of the tool-call step. */
export function recordBackgroundResult(
  entry: RunRegistryEntry,
  taskId: string,
  toolCallId: string,
  settled: Promise<unknown>,
): BackgroundResultRecord {
  const scope = (entry.runScope ??= createRunScope());
  let records = scope.get(BACKGROUND_RESULTS);
  if (!records) scope.set(BACKGROUND_RESULTS, (records = new Map()));
  let record = records.get(taskId);
  if (record?.settled !== settled) {
    const created: BackgroundResultRecord = { toolCallId, settled };
    void settled.then(() => (created.done = true));
    records.set(taskId, (record = created));
  }
  return record;
}

/** Whether `onResult` has applied any result that a transcript may still need. */
export function hasAppliedBackgroundResults(entry: RunRegistryEntry | undefined): boolean {
  for (const record of entry?.runScope?.get(BACKGROUND_RESULTS)?.values() ?? []) {
    if (record.apply) return true;
  }
  return false;
}

function holdsPlaceholder(messageList: MessageList, taskId: string, toolCallId: string): boolean {
  return messageList.get.all.db().some(
    message =>
      message.role === 'assistant' &&
      message.content?.parts?.some(part => {
        if (part.type !== 'tool-invocation' || part.toolInvocation?.toolCallId !== toolCallId) return false;
        const backgroundTask = (part.providerMetadata as any)?.mastra?.backgroundTask;
        return backgroundTask?.taskId === taskId && backgroundTask.status === 'running';
      }),
  );
}

/**
 * Writes every result `onResult` has applied into `messageList` where it still shows that task's
 * placeholder. Returns whether anything changed.
 */
export async function foldBackgroundResults(
  entry: RunRegistryEntry | undefined,
  messageList: MessageList,
): Promise<boolean> {
  let changed = false;
  for (const [taskId, record] of entry?.runScope?.get(BACKGROUND_RESULTS) ?? []) {
    if (!record.apply || !holdsPlaceholder(messageList, taskId, record.toolCallId)) continue;
    await record.apply(messageList);
    changed = true;
  }
  return changed;
}

/**
 * A task's status turns terminal before its `onResult` hook runs. Waits for the hooks of recorded tasks
 * that `isFinished` reports done, giving up after `timeoutMs` so a lost completion event cannot hang the step.
 */
export async function settleFinishedBackgroundResults(
  entry: RunRegistryEntry | undefined,
  isFinished: (taskId: string) => Promise<boolean>,
  timeoutMs: number,
): Promise<void> {
  const finished: Promise<unknown>[] = [];
  for (const [taskId, record] of entry?.runScope?.get(BACKGROUND_RESULTS) ?? []) {
    if (!record.done && (await isFinished(taskId))) finished.push(record.settled);
  }
  if (finished.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([Promise.all(finished), new Promise(resolve => (timer = setTimeout(resolve, timeoutMs)))]);
  } finally {
    clearTimeout(timer);
  }
}
