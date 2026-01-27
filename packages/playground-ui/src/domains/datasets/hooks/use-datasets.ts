import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateDatasetPayload, UpdateDatasetPayload } from '@mastra/client-js';

export const useDatasets = (params?: { page?: number; perPage?: number }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['datasets', params?.page, params?.perPage],
    queryFn: () => client.listDatasets(params),
  });
};

export const useCreateDataset = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDatasetPayload) => client.createDataset(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
    onError: err => {
      console.error('Error creating dataset', err);
    },
  });
};

export const useUpdateDataset = (datasetId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateDatasetPayload) => client.updateDataset(datasetId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      queryClient.invalidateQueries({ queryKey: ['dataset', datasetId] });
    },
    onError: err => {
      console.error('Error updating dataset', err);
    },
  });
};

export const useDeleteDataset = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datasetId: string) => client.deleteDataset(datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
    onError: err => {
      console.error('Error deleting dataset', err);
    },
  });
};
