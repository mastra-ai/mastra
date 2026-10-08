import type { ReactNode } from 'react';
import { useState } from 'react';
import { MobileHeaderContext } from './mobile-header-context';

/** Stable destinations keep each route's breadcrumbs and navigation in the app header. */
export function MobileHeaderProvider({ children }: { children: ReactNode }) {
  const [slots] = useState(() => {
    const page = document.createElement('div');
    page.className = 'flex min-w-0 flex-1 items-center gap-1';
    const navigation = document.createElement('div');
    navigation.className = 'flex shrink-0 items-center empty:hidden';
    return { page, navigation };
  });
  return <MobileHeaderContext.Provider value={slots}>{children}</MobileHeaderContext.Provider>;
}
