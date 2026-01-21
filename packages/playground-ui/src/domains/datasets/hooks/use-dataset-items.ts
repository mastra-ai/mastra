import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateDatasetItemPayload, UpdateDatasetItemPayload, ListDatasetItemsParams } from '@mastra/client-js';

export const useDatasetItems = (datasetId: string, params?: ListDatasetItemsParams) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['datasetItems', datasetId, params?.page, params?.perPage, params?.asOf, params?.includeArchived],
    queryFn: () => client.listDatasetItems(datasetId, params),
    enabled: !!datasetId,
  });
};

export const useCreateDatasetItems = (datasetId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: Omit<CreateDatasetItemPayload, 'datasetId'>[]) => client.createDatasetItems(datasetId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasetItems', datasetId] });
      queryClient.invalidateQueries({ queryKey: ['dataset', datasetId] });
    },
    onError: err => {
      console.error('Error creating dataset items', err);
    },
  });
};

export const useUpdateDatasetItem = (datasetId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: UpdateDatasetItemPayload }) =>
      client.updateDatasetItem(datasetId, itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasetItems', datasetId] });
    },
    onError: err => {
      console.error('Error updating dataset item', err);
    },
  });
};

export const useArchiveDatasetItem = (datasetId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => client.archiveDatasetItem(datasetId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasetItems', datasetId] });
      queryClient.invalidateQueries({ queryKey: ['dataset', datasetId] });
    },
    onError: err => {
      console.error('Error archiving dataset item', err);
    },
  });
};
