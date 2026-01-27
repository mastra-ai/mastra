import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateDatasetParams,
  UpdateDatasetParams,
  AddDatasetItemParams,
  UpdateDatasetItemParams,
  TriggerDatasetRunParams,
} from '@mastra/client-js';

/**
 * Hook providing mutation functions for datasets, items, and runs
 * All mutations invalidate relevant query caches on success
 */
export const useDatasetMutations = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const createDataset = useMutation({
    mutationFn: (params: CreateDatasetParams) => client.createDataset(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });

  const updateDataset = useMutation({
    mutationFn: (params: UpdateDatasetParams) => client.updateDataset(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      queryClient.invalidateQueries({ queryKey: ['dataset', variables.datasetId] });
    },
  });

  const deleteDataset = useMutation({
    mutationFn: (datasetId: string) => client.deleteDataset(datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });

  const addItem = useMutation({
    mutationFn: (params: AddDatasetItemParams) => client.addDatasetItem(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dataset-items', variables.datasetId] });
      queryClient.invalidateQueries({ queryKey: ['dataset', variables.datasetId] });
    },
  });

  const updateItem = useMutation({
    mutationFn: (params: UpdateDatasetItemParams) => client.updateDatasetItem(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dataset-items', variables.datasetId] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: ({ datasetId, itemId }: { datasetId: string; itemId: string }) => client.deleteDatasetItem(datasetId, itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dataset-items', variables.datasetId] });
      queryClient.invalidateQueries({ queryKey: ['dataset', variables.datasetId] });
    },
  });

  // Bulk delete - sequential since no bulk endpoint exists
  const deleteItems = useMutation({
    mutationFn: async ({ datasetId, itemIds }: { datasetId: string; itemIds: string[] }) => {
      for (const itemId of itemIds) {
        await client.deleteDatasetItem(datasetId, itemId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dataset-items', variables.datasetId] });
      queryClient.invalidateQueries({ queryKey: ['dataset', variables.datasetId] });
    },
  });

  const triggerRun = useMutation({
    mutationFn: (params: TriggerDatasetRunParams) => client.triggerDatasetRun(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dataset-runs', variables.datasetId] });
    },
  });

  return {
    createDataset,
    updateDataset,
    deleteDataset,
    addItem,
    updateItem,
    deleteItem,
    deleteItems,
    triggerRun,
  };
};
