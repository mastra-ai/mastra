import { useSearchParams } from 'react-router';

/**
 * The event shown in the drawer lives in the URL (`?event=<name>`), like `?tool=` for tools;
 * closing removes the param without adding a history entry.
 */
export function useEventDrawerParam() {
  const [params, setParams] = useSearchParams();
  const eventName = params.get('event') ?? undefined;

  const close = () =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete('event');
        return next;
      },
      { replace: true },
    );

  return { eventName, close };
}

export const eventSearch = (eventName: string) => `?${new URLSearchParams({ event: eventName }).toString()}`;
