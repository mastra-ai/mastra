import { useRef } from 'react';

// Brings the deeplinked card into view once, as it mounts.
export function useBoardDeepLink({
  boardKey,
  targetItemId,
  targetReady,
}: {
  boardKey: string;
  targetItemId: string | undefined;
  targetReady: boolean;
}) {
  const positionedRef = useRef<string | undefined>(undefined);

  return (itemId: string) => (element: HTMLElement | null) => {
    if (element === null || !targetReady || itemId !== targetItemId) return;
    const targetKey = `${boardKey}:${itemId}`;
    if (positionedRef.current === targetKey) return;
    positionedRef.current = targetKey;
    element.scrollIntoView?.({ behavior: 'auto', block: 'center', inline: 'center' });
    element.focus({ preventScroll: true });
  };
}
