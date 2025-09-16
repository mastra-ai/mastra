import { useCallback, useEffect, useRef, useState } from 'react';
import { faker } from '@faker-js/faker';

export interface Dataset {
  id?: string;
  name: string;
  description: string;
}

const LOCAL_STORAGE_KEY = 'mastra.datasets';
const INITIAL_DATASET_COUNT = 5;

function generateInitialDatasets(): Dataset[] {
  return Array.from({ length: INITIAL_DATASET_COUNT }, () => ({
    id: faker.string.uuid(),
    name: `${faker.commerce.productName()} Dataset`,
    description: faker.commerce.productDescription(),
  }));
}

function getDatasetsFromStorage(): Dataset[] {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fallback to initial
    }
  }
  const initial = generateInitialDatasets();
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveDatasetsToStorage(datasets: Dataset[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(datasets));
}

export function useDatasets() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstLoad = useRef(true);

  // Simulate fetching datasets from backend
  useEffect(() => {
    setIsLoading(true);
    const timeout = setTimeout(
      () => {
        const data = getDatasetsFromStorage();
        setDatasets(data);
        setIsLoading(false);
        isFirstLoad.current = false;
      },
      200 + Math.random() * 100,
    ); // fake network delay
    return () => clearTimeout(timeout);
  }, []);

  // Create a new dataset
  const createDataset = useCallback((dataset: Omit<Dataset, 'id'>) => {
    const newDataset: Dataset = { ...dataset, id: faker.string.uuid() };
    setDatasets(prev => {
      const updated = [...prev, newDataset];
      saveDatasetsToStorage(updated);
      return updated;
    });
  }, []);

  // Delete a dataset by id
  const deleteDataset = useCallback((id: string) => {
    setDatasets(prev => {
      const updated = prev.filter(ds => ds.id !== id);
      saveDatasetsToStorage(updated);
      return updated;
    });
  }, []);

  return {
    datasets,
    isLoading,
    createDataset,
    deleteDataset,
  };
}
