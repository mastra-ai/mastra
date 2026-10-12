import { createContext } from 'react';

/** Desktop only: mobile reaches feature navigation through the app header drawer. */
export const FeatureNavigationContext = createContext<{ collapsed: boolean; toggle: () => void } | undefined>(
  undefined,
);
