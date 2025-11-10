import type {
  ClientOptions,
  DatasetRecord,
  DatasetVersion,
  DatasetRow,
  UpdateDatasetParams,
  ListDatasetVersionsParams,
  ListDatasetVersionsResponse,
  AddDatasetRowsParams,
  AddDatasetRowsResponse,
  ListDatasetRowsParams,
  ListDatasetRowsResponse,
  UpdateDatasetRowsParams,
  UpdateDatasetRowsResponse,
  DeleteDatasetRowsParams,
  DeleteDatasetRowsResponse,
  GetDatasetRowByIdParams,
  ListDatasetRowVersionsParams,
  ListDatasetRowVersionsResponse,
} from '../types';

import { BaseResource } from './base';

export class Dataset extends BaseResource {
  constructor(
    options: ClientOptions,
    private datasetId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves the dataset details
   * @returns Promise containing dataset record
   */
  get(): Promise<DatasetRecord> {
    return this.request(`/api/datasets/${this.datasetId}`);
  }

  /**
   * Updates the dataset properties
   * @param params - Update parameters including name, description, and metadata
   * @returns Promise containing updated dataset record
   */
  update(params: UpdateDatasetParams): Promise<DatasetRecord> {
    return this.request(`/api/datasets/${this.datasetId}`, {
      method: 'PATCH',
      body: params,
    });
  }

  /**
   * Deletes the dataset
   * @returns Promise containing deletion result
   */
  delete(): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/datasets/${this.datasetId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Retrieves paginated versions of the dataset
   * @param params - Optional pagination parameters (page, perPage)
   * @returns Promise containing paginated dataset versions
   */
  listVersions(params?: ListDatasetVersionsParams): Promise<ListDatasetVersionsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) {
      queryParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      queryParams.set('perPage', String(params.perPage));
    }

    const queryString = queryParams.toString();
    return this.request(`/api/datasets/${this.datasetId}/versions${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Adds rows to the dataset
   * @param params - Parameters containing array of rows to add
   * @returns Promise containing the new dataset version with added rows
   */
  addRows(params: AddDatasetRowsParams): Promise<AddDatasetRowsResponse> {
    return this.request(`/api/datasets/${this.datasetId}/rows`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Retrieves paginated rows from the dataset
   * @param params - Optional parameters for versionId and pagination
   * @returns Promise containing paginated dataset rows
   */
  listRows(params?: ListDatasetRowsParams): Promise<ListDatasetRowsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.versionId) {
      queryParams.set('versionId', params.versionId);
    }
    if (params?.page !== undefined) {
      queryParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      queryParams.set('perPage', String(params.perPage));
    }

    const queryString = queryParams.toString();
    return this.request(`/api/datasets/${this.datasetId}/rows${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Updates rows in the dataset
   * @param params - Parameters containing array of rows to update
   * @returns Promise containing the new dataset version with updated rows
   */
  updateRows(params: UpdateDatasetRowsParams): Promise<UpdateDatasetRowsResponse> {
    return this.request(`/api/datasets/${this.datasetId}/rows`, {
      method: 'PATCH',
      body: params,
    });
  }

  /**
   * Deletes rows from the dataset
   * @param params - Parameters containing array of row IDs to delete
   * @returns Promise containing the new dataset version
   */
  deleteRows(params: DeleteDatasetRowsParams): Promise<DeleteDatasetRowsResponse> {
    return this.request(`/api/datasets/${this.datasetId}/rows`, {
      method: 'DELETE',
      body: params,
    });
  }

  /**
   * Retrieves a specific row by ID
   * @param rowId - ID of the row to retrieve
   * @param params - Optional versionId parameter
   * @returns Promise containing the dataset row
   */
  getRowById(rowId: string, params?: GetDatasetRowByIdParams): Promise<DatasetRow> {
    const queryParams = new URLSearchParams();
    if (params?.versionId) {
      queryParams.set('versionId', params.versionId);
    }

    const queryString = queryParams.toString();
    return this.request(`/api/datasets/${this.datasetId}/rows/${rowId}${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Retrieves paginated versions of a specific row
   * @param rowId - ID of the row
   * @param params - Optional pagination parameters (page, perPage)
   * @returns Promise containing paginated row versions
   */
  listRowVersions(rowId: string, params?: ListDatasetRowVersionsParams): Promise<ListDatasetRowVersionsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) {
      queryParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      queryParams.set('perPage', String(params.perPage));
    }

    const queryString = queryParams.toString();
    return this.request(
      `/api/datasets/${this.datasetId}/rows/${rowId}/versions${queryString ? `?${queryString}` : ''}`,
    );
  }
}
