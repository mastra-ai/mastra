import { useCallback, useEffect, useState } from 'react';
import { type Dataset } from '@mastra/playground-ui';

const LOCAL_STORAGE_KEY = 'mastra.datasets';

function getDatasetsFromStorage(): Dataset[] {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fallback to empty
    }
  }
  return [];
}

function saveDatasetsToStorage(datasets: Dataset[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(datasets));
}

export function useDataset(id: string) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate fetching dataset from backend
  useEffect(() => {
    setIsLoading(true);
    const timeout = setTimeout(
      () => {
        const data = getDatasetsFromStorage();
        setDataset(data.find(ds => ds.id === id) || null);
        setIsLoading(false);
      },
      200 + Math.random() * 100,
    ); // fake network delay
    return () => clearTimeout(timeout);
  }, [id]);

  // Update dataset
  const updateDataset = useCallback(
    (updates: Partial<Omit<Dataset, 'id'>>) => {
      setDataset(prev => {
        if (!prev) return prev;
        const updated = { ...prev, ...updates };
        const all = getDatasetsFromStorage();
        const idx = all.findIndex(ds => ds.id === id);
        if (idx !== -1) {
          all[idx] = updated;
          saveDatasetsToStorage(all);
        }
        return updated;
      });
    },
    [id],
  );

  // Delete dataset
  const removeDataset = useCallback(() => {
    setDataset(null);
    const all = getDatasetsFromStorage();
    const updated = all.filter(ds => ds.id !== id);
    saveDatasetsToStorage(updated);
  }, [id]);

  return {
    dataset,
    isLoading,
    updateDataset,
    removeDataset,
  };
}
