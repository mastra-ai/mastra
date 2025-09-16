import { useCallback, useEffect, useState } from 'react';
import { faker } from '@faker-js/faker';
import { format } from 'date-fns';
import { useDatasets, Dataset } from './use-datasets';

export interface DatasetItem {
  id: string;
  datasetId: string;
  input: string;
  output: string;
  createdAt: string;
  updatedAt: string;
  updatedAtStr: string;
  source: string;
}

const LOCAL_STORAGE_KEY = 'mastra.datasetItems';
const INITIAL_ITEM_COUNT = 30;

function generateInitialItems(datasets: Dataset[]): DatasetItem[] {
  if (!datasets.length) return [];

  return Array.from({ length: INITIAL_ITEM_COUNT }, () => {
    const dataset = faker.helpers.arrayElement(datasets);
    const createdAt = faker.date.recent({ days: 10 });
    const updatedAt = faker.date.between({ from: createdAt, to: new Date() });
    return {
      id: faker.string.uuid(),
      datasetId: dataset.id,
      input: faker.lorem.paragraphs({ min: 1, max: 1 }),
      output: faker.lorem.paragraphs({ min: 4, max: 12 }),
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      updatedAtStr: format(updatedAt, 'MMM d HH:mm aa'),
      source: 'user',
    };
  });
}

function getItemsFromStorage(datasets: Dataset[]): DatasetItem[] {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fallback to initial
    }
  }
  const initial = generateInitialItems(datasets);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveItemsToStorage(items: DatasetItem[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
}

export function useDatasetItems(datasetId: string) {
  const { datasets, isLoading: isDatasetsLoading } = useDatasets();
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate fetching items from backend
  useEffect(() => {
    if (isDatasetsLoading) return;
    setIsLoading(true);
    const timeout = setTimeout(
      () => {
        const data = getItemsFromStorage(datasets);
        setItems(data.filter(item => item.datasetId === datasetId));
        setIsLoading(false);
      },
      200 + Math.random() * 200,
    ); // fake network delay
    return () => clearTimeout(timeout);
  }, [datasets, isDatasetsLoading, datasetId]);

  // Add item
  const addItem = useCallback(
    (item: Omit<DatasetItem, 'id' | 'createdAt' | 'updatedAt' | 'updatedAtStr' | 'datasetId'>) => {
      const now = new Date();
      const newItem: DatasetItem = {
        ...item,
        id: faker.string.uuid(),
        datasetId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        updatedAtStr: format(now, 'MMM d HH:mm aa'),
        source: 'user',
      };
      setItems(prev => {
        const updated = [...prev, newItem];
        // Save to all items in storage
        const all = getItemsFromStorage(datasets)
          .filter(i => i.datasetId !== datasetId)
          .concat(updated);
        saveItemsToStorage(all);
        return updated;
      });
    },
    [datasetId, datasets],
  );

  // Remove item
  const removeItem = useCallback(
    (id: string) => {
      setItems(prev => {
        const updated = prev.filter(item => item.id !== id);
        const all = getItemsFromStorage(datasets).filter(i => i.id !== id);
        saveItemsToStorage(all);
        return updated;
      });
    },
    [datasetId, datasets],
  );

  // Edit item
  const editItem = useCallback(
    (id: string, updates: Partial<Omit<DatasetItem, 'id' | 'createdAt' | 'datasetId'>>) => {
      setItems(prev => {
        const updated = prev.map(item =>
          item.id === id
            ? {
                ...item,
                ...updates,
                updatedAt: new Date().toISOString(),
                updatedAtStr: format(new Date(), 'MMM d HH:mm aa'),
              }
            : item,
        );
        // Save to all items in storage
        const all = getItemsFromStorage(datasets).map(item =>
          item.datasetId === datasetId && item.id === id
            ? {
                ...item,
                ...updates,
                updatedAt: new Date().toISOString(),
                updatedAtStr: format(new Date(), 'MMM d HH:mm aa'),
              }
            : item,
        );
        saveItemsToStorage(all);
        return updated;
      });
    },
    [datasetId, datasets],
  );

  return {
    items,
    isLoading,
    addItem,
    removeItem,
    editItem,
  };
}
