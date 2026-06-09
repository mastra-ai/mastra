import type { Harness, HarnessThread } from '@mastra/core/harness';

interface ThreadStateSetting {
  key: string;
  isValid(value: unknown): boolean;
}

const THREAD_STATE_SETTINGS: ThreadStateSetting[] = [
  {
    key: 'cavemanObservations',
    isValid: (value: unknown): value is boolean => typeof value === 'boolean',
  },
  {
    key: 'observeAttachments',
    isValid: (value: unknown): value is 'auto' | boolean => value === 'auto' || typeof value === 'boolean',
  },
];

function getStateValue(harness: Harness<Record<string, unknown>>, setting: ThreadStateSetting): unknown {
  const value = (harness.getState() as Record<string, unknown>)[setting.key];
  return setting.isValid(value) ? value : undefined;
}

async function findThread(
  harness: Harness<Record<string, unknown>>,
  threadId: string,
): Promise<HarnessThread | undefined> {
  const threads = await harness.listThreads({ allResources: true });
  return threads.find(t => t.id === threadId);
}

/**
 * Restores MastraCode-owned per-thread OM settings for the given thread:
 * - If the thread already has a valid value in metadata, mirror it into harness state.
 * - Otherwise, persist the current harness-state value to the thread so future
 *   sessions see the user's last-selected setting.
 */
async function restoreSettingsForThread(harness: Harness<Record<string, unknown>>, threadId: string): Promise<void> {
  const thread = await findThread(harness, threadId);
  if (harness.getCurrentThreadId() !== threadId) return;

  const updates: Record<string, unknown> = {};
  const settingsToSeed: Array<{ key: string; value: unknown }> = [];

  for (const setting of THREAD_STATE_SETTINGS) {
    const persisted = thread?.metadata?.[setting.key];

    if (setting.isValid(persisted)) {
      if (getStateValue(harness, setting) !== persisted) {
        updates[setting.key] = persisted;
      }
      continue;
    }

    const current = getStateValue(harness, setting);
    if (current !== undefined) {
      settingsToSeed.push({ key: setting.key, value: current });
    }
  }

  if (Object.keys(updates).length > 0) {
    await harness.setState(updates);
  }

  for (const setting of settingsToSeed) {
    await harness.setThreadSetting(setting);
  }
}

/**
 * Wires MastraCode-owned OM settings into harness thread events so they persist
 * per-thread and new threads inherit the most recent value.
 *
 * This is intentionally implemented in mastracode rather than core: these
 * settings are mastracode-specific OM concepts, so persistence stays scoped to
 * the host.
 */
export function attachOMThreadStatePersistence(harness: Harness<Record<string, unknown>>): void {
  harness.subscribe(event => {
    if (event.type === 'thread_changed' || event.type === 'thread_created') {
      const threadId = event.type === 'thread_changed' ? event.threadId : event.thread.id;
      void restoreSettingsForThread(harness, threadId).catch(() => {
        // Persistence is best-effort; don't crash the TUI if storage hiccups.
      });
    }
  });
}

/**
 * Eagerly restores MastraCode-owned OM settings for the currently-selected
 * thread. Called once at TUI startup after the initial thread is selected,
 * since the subscription set up later misses the startup `thread_changed` event.
 */
export async function restoreOMThreadStateForCurrentThread(harness: Harness<Record<string, unknown>>): Promise<void> {
  const threadId = harness.getCurrentThreadId();
  if (!threadId) return;
  await restoreSettingsForThread(harness, threadId);
}
