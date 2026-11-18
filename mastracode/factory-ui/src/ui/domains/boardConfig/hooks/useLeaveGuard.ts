import { useRef } from 'react';
import { useBlocker } from 'react-router';

export function useLeaveGuard(changed: boolean) {
  // Set before the navigation that follows a create or delete, which lands before `changed` clears.
  const leaving = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      changed && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );
  const leave = (go: () => void) => {
    leaving.current = true;
    go();
  };
  return { blocker, leave };
}
