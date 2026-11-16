import { TASKS_EXTENSION_ID } from './constants';

/**
 * Whether a capabilities object declares the Tasks extension. A non-object entry counts as absent,
 * and the legacy 2025-11-25 top-level `capabilities.tasks` key is ignored: it is not wire-compatible.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export function hasTasksCapability(capabilities: { extensions?: Record<string, unknown> } | undefined | null): boolean {
  const entry = capabilities?.extensions?.[TASKS_EXTENSION_ID];
  return typeof entry === 'object' && entry !== null && !Array.isArray(entry);
}

/**
 * The `extensions` entry a peer advertises to declare the Tasks extension. SEP-2663 defines no
 * settings, so the value is an empty object.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export function tasksCapabilityEntry(): Record<typeof TASKS_EXTENSION_ID, Record<string, never>> {
  return { [TASKS_EXTENSION_ID]: {} };
}
