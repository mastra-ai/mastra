import React from 'react';

import type { UIExperimentConfig } from './experimental-ui-context';

export type ExperimentalUIContextValue = {
  experiments: UIExperimentConfig[];
  getVariant: (key: string) => string;
  setVariant: (key: string, variant: string) => void;
};

export const ExperimentalUIContext = React.createContext<ExperimentalUIContextValue | null>(null);
