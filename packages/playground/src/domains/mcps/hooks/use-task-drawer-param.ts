import type { McpServerTask } from '@mastra/client-js';
import { useSearchParams } from 'react-router';
import type { McpTaskFilters } from './use-mcp-server-tasks';

/** The task shown in the drawer lives in the URL (`?task=<taskKey>`), like `?event=`. */
export function useTaskDrawerParam() {
  const [params, setParams] = useSearchParams();
  const taskKey = params.get('task') ?? undefined;

  const close = () =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete('task');
        return next;
      },
      { replace: true },
    );

  const open = (key: string) =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.set('task', key);
        return next;
      },
      { replace: true },
    );

  return { taskKey, open, close };
}

/** The search string that opens `taskKey` in the drawer, keeping the list's filters. */
export const taskSearch = (taskKey: string, current: URLSearchParams | string = '') => {
  const params = new URLSearchParams(current);
  params.set('task', taskKey);
  return `?${params.toString()}`;
};

/** A short form of a task key for lists; the full key is in the drawer. */
export const shortTaskKey = (taskKey: string) => `${taskKey.slice(0, 8)}…`;

const STATUSES: ReadonlySet<string> = new Set<McpServerTask['status']>([
  'working',
  'input_required',
  'completed',
  'failed',
  'cancelled',
]);

/** The task list's filters live in the URL (`?status=`, `?surface=`, `?client=`), so a filtered view can be shared. */
export function useTaskFilters() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status');
  const surface = params.get('surface');
  const client = params.get('client');
  const filters: McpTaskFilters = {
    ...(status && STATUSES.has(status) && { status: status as McpServerTask['status'] }),
    ...(surface && { surface }),
    ...(client && { client }),
  };

  const setFilters = (next: McpTaskFilters) =>
    setParams(
      prev => {
        const updated = new URLSearchParams(prev);
        for (const name of ['status', 'surface', 'client'] as const) {
          const value = next[name];
          if (value) updated.set(name, value);
          else updated.delete(name);
        }
        return updated;
      },
      { replace: true },
    );

  return { filters, setFilters };
}

/** A short form of a client key; the full key is in the drawer. */
export const shortClientKey = (principalKey: string) => `${principalKey.slice(0, 8)}…`;
