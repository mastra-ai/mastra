import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  CreateDatasetParams,
  UpdateDatasetParams,
  ListDatasetVersionsParams,
  ListDatasetVersionsResponse,
} from '@mastra/client-js';

export const useDataset = (datasetId: string) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['datasets', datasetId],
    queryFn: () => client.getDataset(datasetId).get(),
    staleTime: 0,
    gcTime: 0,
  });
};

export const useDatasetCreate = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description, metadata }: CreateDatasetParams) => {
      const response = await client.createDataset({
        name,
        description,
        metadata,
      });

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      console.log('Dataset created successfully');
    },
    onError: err => {
      console.error('Error creating dataset', err);
    },
  });
};

export const useDatasetDelete = (datasetId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await client.getDataset(datasetId).delete();

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      console.log('Dataset deleted successfully');
    },
    onError: err => {
      console.error('Error deleting dataset', err);
    },
  });
};

export const useDatasetUpdate = (datasetId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateDatasetParams) => {
      // Filter out null/undefined values to avoid validation errors
      const cleanedPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, value]) => value !== null && value !== undefined),
      ) as UpdateDatasetParams;

      const response = await client.getDataset(datasetId).update(cleanedPayload);

      console.log('Dataset updated:', cleanedPayload, response);

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      console.log('Dataset updated successfully');
    },
    onError: err => {
      console.error('Error updating dataset', err);
    },
  });
};

export const useDatasetVersions = (datasetId: string, params?: ListDatasetVersionsParams) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['datasets', datasetId, 'versions', params],
    queryFn: () => client.getDataset(datasetId).listVersions(params),
    staleTime: 0,
    gcTime: 0,
  });
};
