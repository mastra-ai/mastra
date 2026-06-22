import type { HarnessThread, Session } from '@mastra/core/harness';

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

function getStateValue(session: Session<Record<string, unknown>>, setting: ThreadStateSetting): unknown {
  const value = session.state.get()[setting.key];
  return setting.isValid(value) ? value : undefined;
}

async function findThread(
  session: Session<Record<string, unknown>>,
  threadId: string,
): Promise<HarnessThread | undefined> {
  const threads = await session.thread.list({ allResources: true });
  return threads.find(t => t.id === threadId);
}

/**
 * Restores MastraCode-owned per-thread OM settings for the given thread:
 * - If the thread already has a valid value in metadata, mirror it into harness state.
 * - Otherwise, persist the current session.state value to the thread so future
 *   sessions see the user's last-selected setting.
 */
async function restoreSettingsForThread(session: Session<Record<string, unknown>>, threadId: string): Promise<void> {
  const thread = await findThread(session, threadId);
  if (session.thread.getId() !== threadId) return;

  const updates: Record<string, unknown> = {};
  const settingsToSeed: Array<{ key: string; value: unknown }> = [];

  for (const setting of THREAD_STATE_SETTINGS) {
    const persisted = thread?.metadata?.[setting.key];

    if (setting.isValid(persisted)) {
      if (getStateValue(session, setting) !== persisted) {
        updates[setting.key] = persisted;
      }
      continue;
    }

    const current = getStateValue(session, setting);
    if (current !== undefined) {
      settingsToSeed.push({ key: setting.key, value: current });
    }
  }

  if (Object.keys(updates).length > 0) {
    if (session.thread.getId() !== threadId) return;
    await session.state.set(updates);
  }

  for (const setting of settingsToSeed) {
    if (session.thread.getId() !== threadId) return;
    await session.thread.setSetting(setting);
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
export function attachOMThreadStatePersistence(session: Session<Record<string, unknown>>): void {
  session.subscribe(event => {
    if (event.type === 'thread_changed' || event.type === 'thread_created') {
      const threadId = event.type === 'thread_changed' ? event.threadId : event.thread.id;
      void restoreSettingsForThread(session, threadId).catch(() => {
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
export async function restoreOMThreadStateForCurrentThread(session: Session<Record<string, unknown>>): Promise<void> {
  const threadId = session.thread.getId();
  if (!threadId) return;
  await restoreSettingsForThread(session, threadId);
}
