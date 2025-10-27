import type { MastraClient } from '../client';
import type {
  DatasetRecord,
  DatasetVersion,
  DatasetRow,
  UpdateDatasetParams,
  GetDatasetVersionsParams,
  GetDatasetVersionsResponse,
  AddDatasetRowsParams,
  GetDatasetRowsParams,
  GetDatasetRowsResponse,
  UpdateDatasetRowsParams,
  DeleteDatasetRowsParams,
  GetDatasetRowByIdParams,
  GetDatasetRowVersionsParams,
  GetDatasetRowVersionsResponse,
} from '../types';

export class Dataset {
  private client: MastraClient;
  private id: string;

  constructor(client: MastraClient, id: string) {
    this.client = client;
    this.id = id;
  }

  async get(): Promise<DatasetRecord> {
    return this.client.request<DatasetRecord>(`/datasets/${this.id}`, {
      method: 'GET',
    });
  }

  async update(params: UpdateDatasetParams): Promise<DatasetRecord> {
    return this.client.request<DatasetRecord>(`/datasets/${this.id}`, {
      method: 'PUT',
      body: params,
    });
  }

  async delete(): Promise<void> {
    await this.client.request(`/datasets/${this.id}`, {
      method: 'DELETE',
    });
  }

  async getVersions(params?: GetDatasetVersionsParams): Promise<GetDatasetVersionsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) {
      searchParams.append('page', params.page.toString());
    }
    if (params?.perPage !== undefined) {
      searchParams.append('perPage', params.perPage.toString());
    }

    const query = searchParams.toString();
    const url = query ? `/datasets/${this.id}/versions?${query}` : `/datasets/${this.id}/versions`;

    return this.client.request<GetDatasetVersionsResponse>(url, {
      method: 'GET',
    });
  }

  async addRows(params: AddDatasetRowsParams): Promise<DatasetVersion> {
    return this.client.request<DatasetVersion>(`/datasets/${this.id}/rows`, {
      method: 'POST',
      body: params,
    });
  }

  async getRows(params?: GetDatasetRowsParams): Promise<GetDatasetRowsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.versionId !== undefined) {
      searchParams.append('versionId', params.versionId);
    }
    if (params?.page !== undefined) {
      searchParams.append('page', params.page.toString());
    }
    if (params?.perPage !== undefined) {
      searchParams.append('perPage', params.perPage.toString());
    }

    const query = searchParams.toString();
    const url = query ? `/datasets/${this.id}/rows?${query}` : `/datasets/${this.id}/rows`;

    return this.client.request<GetDatasetRowsResponse>(url, {
      method: 'GET',
    });
  }

  async updateRows(params: UpdateDatasetRowsParams): Promise<DatasetVersion> {
    return this.client.request<DatasetVersion>(`/datasets/${this.id}/rows`, {
      method: 'PUT',
      body: params,
    });
  }

  async deleteRows(params: DeleteDatasetRowsParams): Promise<DatasetVersion> {
    return this.client.request<DatasetVersion>(`/datasets/${this.id}/rows`, {
      method: 'DELETE',
      body: params,
    });
  }

  async getRowById(rowId: string, params?: GetDatasetRowByIdParams): Promise<DatasetRow> {
    const searchParams = new URLSearchParams();
    if (params?.versionId !== undefined) {
      searchParams.append('versionId', params.versionId);
    }

    const query = searchParams.toString();
    const url = query ? `/datasets/${this.id}/rows/${rowId}?${query}` : `/datasets/${this.id}/rows/${rowId}`;

    return this.client.request<DatasetRow>(url, {
      method: 'GET',
    });
  }

  async getRowVersions(rowId: string, params?: GetDatasetRowVersionsParams): Promise<GetDatasetRowVersionsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) {
      searchParams.append('page', params.page.toString());
    }
    if (params?.perPage !== undefined) {
      searchParams.append('perPage', params.perPage.toString());
    }

    const query = searchParams.toString();
    const url = query
      ? `/datasets/${this.id}/rows/${rowId}/versions?${query}`
      : `/datasets/${this.id}/rows/${rowId}/versions`;

    return this.client.request<GetDatasetRowVersionsResponse>(url, {
      method: 'GET',
    });
  }
}
