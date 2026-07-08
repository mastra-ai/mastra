import { useEffect, useState } from 'react';

import { applyDensity, loadDensity, saveDensity } from '../services/density';
import type { Density } from '../services/density';

export function useDensityPreference() {
  const [density, setDensity] = useState<Density>(() => loadDensity());

  // Density is reflected on the document root, so applying it is external DOM sync.
  useEffect(() => {
    applyDensity(density);
  }, [density]);

  const changeDensity = (next: Density) => {
    setDensity(next);
    saveDensity(next);
  };

  return { density, changeDensity };
}
