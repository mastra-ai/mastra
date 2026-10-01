import { useLocation, useSearchParams } from 'react-router';

/**
 * The tool shown in the drawer lives in the URL (`?tool=<id>`), so a drawer can be linked, shared,
 * and opened from anywhere; closing it removes the param without adding a history entry.
 */
export function useToolDrawerParam() {
  const [params, setParams] = useSearchParams();
  const toolId = params.get('tool') ?? undefined;

  const close = () =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete('tool');
        return next;
      },
      { replace: true },
    );

  return { toolId, close };
}

/**
 * Builds links that open the tool drawer over the current page, keeping its path and other params.
 * A bare `?tool=` link would resolve against the nearest route and could drop part of the path.
 */
export function useToolDrawerHref() {
  const { pathname, search } = useLocation();
  return (toolId: string) => {
    const params = new URLSearchParams(search);
    params.set('tool', toolId);
    return `${pathname}?${params.toString()}`;
  };
}
