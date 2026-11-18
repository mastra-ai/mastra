import { useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';

export function useLeaveGuard(changed: boolean) {
  // Set before the navigation that follows a create or delete, which lands before `changed` clears.
  const leaving = useRef(false);
  const guarding = () => changed && !leaving.current;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => guarding() && currentLocation.pathname !== nextLocation.pathname,
  );
  useBeforeUnload(event => {
    if (guarding()) event.preventDefault();
  });
  const leave = (go: () => void) => {
    leaving.current = true;
    go();
  };
  return { blocker, leave };
}
