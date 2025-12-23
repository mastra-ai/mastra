import { useEffect, useState } from 'react';

/**
 * Custom hook for managing layout column sizes with localStorage persistence
 * @param storageKey - The key to use for localStorage persistence
 * @returns An object with columnSizes state and handleColumnSizesChange function
 */
export function useLayoutColumnSizes(storageKey: string) {
  const [sizes, setSizes] = useState<number[] | undefined>(undefined);

  // Load saved sizes on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setSizes(JSON.parse(saved));
      } catch (error) {
        console.warn(`Failed to parse layout sizes from localStorage key "${storageKey}":`, error);
      }
    }
  }, [storageKey]);

  const storeColumnSizes = (newSizes: number[]) => {
    localStorage.setItem(storageKey, JSON.stringify(newSizes));
  };

  return { columnSizes: sizes || [200, 800, 400], storeColumnSizes };
}
