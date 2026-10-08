import { useState } from 'react';
import { migrateStudioAreaVisibility } from '../utils/studio-area-visibility';

export function useStudioAreaVisibility() {
  const [storageKey] = useState(migrateStudioAreaVisibility);
  return storageKey;
}
