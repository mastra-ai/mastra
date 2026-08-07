import * as React from 'react';

import type { DrawerOverlay, DrawerSide, DrawerVariant } from './drawer-types';

export type DrawerContextValue = {
  side: DrawerSide;
  variant: DrawerVariant;
  resolvedOverlay: Exclude<DrawerOverlay, 'auto'>;
};

export const DrawerContext = React.createContext<DrawerContextValue>({
  side: 'bottom',
  variant: 'default',
  resolvedOverlay: 'visible',
});

export const useDrawerContext = () => React.useContext(DrawerContext);

export const useDrawerSide = () => useDrawerContext().side;
