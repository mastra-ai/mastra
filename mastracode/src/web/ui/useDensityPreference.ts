import { useEffect, useState } from 'react';

import { applyDensity, loadDensity, saveDensity } from './theme';
import type { Density } from './theme';

export function useDensityPreference() {
  const [density, setDensity] = useState<Density>(() => loadDensity());

  useEffect(() => {
    applyDensity(density);
  }, [density]);

  const changeDensity = (next: Density) => {
    setDensity(next);
    saveDensity(next);
  };

  return { density, changeDensity };
}
