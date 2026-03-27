import type {
  CreateDatasetParams,
  UpdateDatasetParams,
  AddDatasetItemParams,
  UpdateDatasetItemParams,
  TriggerDatasetExperimentParams,
  UpdateExperimentResultParams,
  BatchInsertDatasetItemsParams,
  BatchDeleteDatasetItemsParams,
  GenerateDatasetItemsParams,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
      void queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });

  const updateDataset = useMutation({
    mutationFn: (params: UpdateDatasetParams) => client.updateDataset(params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['datasets'] });
      void queryClient.invalidateQueries({ queryKey: ['dataset', variables.datasetId] });
    },
  });

  const deleteDataset = useMutation({
    mutationFn: (datasetId: string) => client.deleteDataset(datasetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });

  const addItem = useMutation({
    mutationFn: (params: AddDatasetItemParams) => client.addDatasetItem(params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['dataset-items', variables.datasetId] });
      void queryClient.invalidateQueries({ queryKey: ['dataset', variables.datasetId] });
    },
  });

  const updateItem = useMutation({
    mutationFn: (params: UpdateDatasetItemParams) => client.updateDatasetItem(params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['dataset-items', variables.datasetId] });
      void queryClient.invalidateQueries({ queryKey: ['dataset-item', variables.datasetId, variables.itemId] });
      void queryClient.invalidateQueries({
        queryKey: ['dataset-item-versions', variables.datasetId, variables.itemId],
      });
      void queryClient.invalidateQueries({ queryKey: ['dataset-versions', variables.datasetId] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: ({ datasetId, itemId }: { datasetId: string; itemId: string }) =>
      client.deleteDatasetItem(datasetId, itemId),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['dataset-items', variables.datasetId] });
      void queryClient.invalidateQueries({ queryKey: ['dataset', variables.datasetId] });
    },
  });

  // Batch insert items using the batch endpoint
  const batchInsertItems = useMutation({
    mutationFn: (params: BatchInsertDatasetItemsParams) => client.batchInsertDatasetItems(params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['dataset-items', variables.datasetId] });
      void queryClient.invalidateQueries({ queryKey: ['dataset', variables.datasetId] });
      void queryClient.invalidateQueries({ queryKey: ['dataset-versions', variables.datasetId] });
    },
  });

  // Batch delete items using the batch endpoint
  const batchDeleteItems = useMutation({
    mutationFn: (params: BatchDeleteDatasetItemsParams) => client.batchDeleteDatasetItems(params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['dataset-items', variables.datasetId] });
      void queryClient.invalidateQueries({ queryKey: ['dataset', variables.datasetId] });
      void queryClient.invalidateQueries({ queryKey: ['dataset-versions', variables.datasetId] });
    },
  });

  // @deprecated - use batchDeleteItems mutation instead
  const deleteItems = useMutation({
    mutationFn: async ({ datasetId, itemIds }: { datasetId: string; itemIds: string[] }) => {
      return client.batchDeleteDatasetItems({ datasetId, itemIds });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['dataset-items', variables.datasetId] });
      void queryClient.invalidateQueries({ queryKey: ['dataset', variables.datasetId] });
      void queryClient.invalidateQueries({ queryKey: ['dataset-versions', variables.datasetId] });
    },
  });

  const generateItems = useMutation({
    mutationFn: (params: GenerateDatasetItemsParams) => client.generateDatasetItems(params),
  });

  const triggerExperiment = useMutation({
    mutationFn: (params: TriggerDatasetExperimentParams) => client.triggerDatasetExperiment(params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['dataset-experiments', variables.datasetId] });
    },
  });

  const updateExperimentResult = useMutation({
    mutationFn: (params: UpdateExperimentResultParams) => client.updateDatasetExperimentResult(params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['experiment-results', variables.experimentId] });
      void queryClient.invalidateQueries({ queryKey: ['dataset-experiment-results'] });
      void queryClient.invalidateQueries({ queryKey: ['review-items'] });
      void queryClient.invalidateQueries({ queryKey: ['dataset-review-items'] });
      void queryClient.invalidateQueries({ queryKey: ['dataset-completed-items'] });
      void queryClient.invalidateQueries({ queryKey: ['experiment-review-summary'] });
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
    batchInsertItems,
    batchDeleteItems,
    generateItems,
    triggerExperiment,
    updateExperimentResult,
  };
};
