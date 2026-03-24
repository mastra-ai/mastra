import React from 'react';

import type { ExperimentalUIContextValue } from './experimental-ui-context-base';
import { ExperimentalUIContext } from './experimental-ui-context-base';

export function useExperimentalUI(key: string) {
  const context = React.useContext(ExperimentalUIContext);
  if (!context) {
    throw new Error('useExperimentalUI must be used within an ExperimentalUIProvider.');
  }
  return {
    variant: context.getVariant(key),
    setVariant: (variant: string) => context.setVariant(key, variant),
  };
}

export function useMaybeExperimentalUI(): ExperimentalUIContextValue | null {
  return React.useContext(ExperimentalUIContext);
}
