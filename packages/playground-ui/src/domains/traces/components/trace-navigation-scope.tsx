import type { ReactNode } from 'react';
import { TraceNavigationContext } from './trace-navigation';
import type { TraceNavigation } from './trace-navigation';

/** Hands `navigation` to the parts below; without one, they keep the navigation of the root around them. */
export function TraceNavigationScope({ navigation, children }: { navigation?: TraceNavigation; children: ReactNode }) {
  if (!navigation) return <>{children}</>;
  return <TraceNavigationContext.Provider value={navigation}>{children}</TraceNavigationContext.Provider>;
}
