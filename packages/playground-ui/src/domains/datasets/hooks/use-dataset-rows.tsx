import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  ListDatasetRowsParams,
  AddDatasetRowsParams,
  AddDatasetRowsResponse,
  UpdateDatasetRowsParams,
  UpdateDatasetRowsResponse,
  DeleteDatasetRowsParams,
  DeleteDatasetRowsResponse,
} from '@mastra/client-js';

export const useDatasetRows = (datasetId: string, params?: ListDatasetRowsParams) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['datasets', datasetId, 'rows', params?.versionId],
    queryFn: () => client.getDataset(datasetId).listRows(params),
    staleTime: 0,
    gcTime: 0,
  });
};

export const useDatasetRowsAdd = (datasetId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddDatasetRowsParams): Promise<AddDatasetRowsResponse> => {
      const response = await client.getDataset(datasetId).addRows(payload);

      console.log('Dataset rows added:', payload, response);

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets', datasetId] });
      queryClient.invalidateQueries({
        queryKey: ['datasets', datasetId, 'rows'],
        refetchType: 'none',
      });
      console.log('Dataset rows added successfully');
    },
    onError: err => {
      console.error('Error adding dataset rows', err);
    },
  });
};

export const useDatasetRowsUpdate = (datasetId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateDatasetRowsParams): Promise<UpdateDatasetRowsResponse> => {
      // Filter out null/undefined values to avoid validation errors
      const cleanedPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, value]) => value !== null && value !== undefined),
      ) as UpdateDatasetRowsParams;

      const response = await client.getDataset(datasetId).updateRows(cleanedPayload);

      console.log('Dataset rows updated:', cleanedPayload, response);

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets', datasetId] });
      queryClient.invalidateQueries({
        queryKey: ['datasets', datasetId, 'rows'],
        refetchType: 'none',
      });
      console.log('Dataset rows updated successfully');
    },
    onError: err => {
      console.error('Error updating dataset rows', err);
    },
  });
};

export const useDatasetRowsDelete = (datasetId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DeleteDatasetRowsParams): Promise<DeleteDatasetRowsResponse> => {
      const response = await client.getDataset(datasetId).deleteRows(payload);

      console.log('Dataset rows deleted:', payload, response);

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets', datasetId] });
      queryClient.invalidateQueries({
        queryKey: ['datasets', datasetId, 'rows'],
        refetchType: 'none',
      });
      console.log('Dataset rows deleted successfully');
    },
    onError: err => {
      console.error('Error deleting dataset rows', err);
    },
  });
};
