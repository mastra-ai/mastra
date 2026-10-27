import { useSearchParams } from 'react-router';

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

  return { taskKey, close };
}

export const taskSearch = (taskKey: string) => `?${new URLSearchParams({ task: taskKey }).toString()}`;

/** A short form of a task key for lists; the full key is in the drawer. */
export const shortTaskKey = (taskKey: string) => `${taskKey.slice(0, 8)}…`;
