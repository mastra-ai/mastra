import React from 'react';

import { ExperimentalUIContext } from './experimental-ui-context-base';
import type { ExperimentalUIContextValue } from './experimental-ui-context-base';

const STORAGE_PREFIX = 'experimental-ui:';
const DEFAULT_VARIANT = 'current';

export type UIExperimentVariantOption = { value: string; label: string };

export type UIExperimentConfig = {
  key: string;
  name: string;
  path?: string | string[];
  variants: UIExperimentVariantOption[];
};

function readStoredVariant(key: string, validValues: Set<string>): string {
  const stored = window.localStorage.getItem(STORAGE_PREFIX + key);
  if (stored && validValues.has(stored)) {
    return stored;
  }
  return DEFAULT_VARIANT;
}

export function ExperimentalUIProvider({
  experiments,
  children,
}: {
  experiments: UIExperimentConfig[];
  children: React.ReactNode;
}) {
  const validVariantsMap = React.useMemo(
    () => new Map(experiments.map(e => [e.key, new Set(e.variants.map(v => v.value))])),
    [experiments],
  );

  const [variants, setVariants] = React.useState<Record<string, string>>({});

  React.useLayoutEffect(() => {
    const initial: Record<string, string> = {};
    for (const exp of experiments) {
      const valid = validVariantsMap.get(exp.key)!;
      initial[exp.key] = readStoredVariant(exp.key, valid);
    }
    setVariants(initial);
  }, [experiments, validVariantsMap]);

  const getVariant = React.useCallback((key: string) => variants[key] ?? DEFAULT_VARIANT, [variants]);

  const setVariant = React.useCallback((key: string, variant: string) => {
    window.localStorage.setItem(STORAGE_PREFIX + key, variant);
    setVariants(prev => ({ ...prev, [key]: variant }));
  }, []);

  const contextValue = React.useMemo<ExperimentalUIContextValue>(
    () => ({ experiments, getVariant, setVariant }),
    [experiments, getVariant, setVariant],
  );

  return <ExperimentalUIContext.Provider value={contextValue}>{children}</ExperimentalUIContext.Provider>;
}
