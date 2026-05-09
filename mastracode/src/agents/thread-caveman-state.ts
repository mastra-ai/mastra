import type { Harness, HarnessThread } from '@mastra/core/harness';

const META_KEY = 'cavemanObservations';

function getStateCaveman(harness: Harness<Record<string, unknown>>): boolean | undefined {
  const value = (harness.getState() as Record<string, unknown>)[META_KEY];
  return typeof value === 'boolean' ? value : undefined;
}

async function findThread(
  harness: Harness<Record<string, unknown>>,
  threadId: string,
): Promise<HarnessThread | undefined> {
  const threads = await harness.listThreads({ allResources: true });
  return threads.find(t => t.id === threadId);
}

/**
 * Restores `cavemanObservations` for the given thread:
 * - If the thread already has a value in metadata, mirror it into harness state.
 * - Otherwise, persist the current harness-state value to the thread so future
 *   sessions see the user's last-selected setting.
 */
async function restoreCavemanForThread(harness: Harness<Record<string, unknown>>, threadId: string): Promise<void> {
  const thread = await findThread(harness, threadId);
  if (harness.getCurrentThreadId() !== threadId) return;

  const persisted = thread?.metadata?.[META_KEY];

  if (typeof persisted === 'boolean') {
    if (getStateCaveman(harness) !== persisted) {
      await harness.setState({ [META_KEY]: persisted });
    }
    return;
  }

  const current = getStateCaveman(harness);
  if (typeof current === 'boolean') {
    await harness.setThreadSetting({ key: META_KEY, value: current });
  }
}

/**
 * Wires the `cavemanObservations` toggle into harness thread events so it
 * persists per-thread and new threads inherit the most recent value.
 *
 * This is intentionally implemented in mastracode rather than core: the toggle
 * is a mastracode-specific OM concept, so persistence stays scoped to the host.
 */
export function attachCavemanThreadStatePersistence(harness: Harness<Record<string, unknown>>): void {
  harness.subscribe(event => {
    if (event.type === 'thread_changed' || event.type === 'thread_created') {
      const threadId = event.type === 'thread_changed' ? event.threadId : event.thread.id;
      void restoreCavemanForThread(harness, threadId).catch(() => {
        // Persistence is best-effort; don't crash the TUI if storage hiccups.
      });
    }
  });
}

/**
 * Eagerly restores `cavemanObservations` for the currently-selected thread.
 * Called once at TUI startup after the initial thread is selected, since the
 * subscription set up later misses the startup `thread_changed` event.
 */
export async function restoreCavemanForCurrentThread(harness: Harness<Record<string, unknown>>): Promise<void> {
  const threadId = harness.getCurrentThreadId();
  if (!threadId) return;
  await restoreCavemanForThread(harness, threadId);
}
