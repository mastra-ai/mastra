import { useSyncExternalStore } from 'react';

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribeToVisibility, () => document.visibilityState === 'visible');
}
