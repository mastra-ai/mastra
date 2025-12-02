// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as UploadAPI from './upload';
import { NewVersion, Upload as UploadAPIUpload, UploadCreateParams, UploadEditParams } from './upload';
import * as VersionsAPI from './versions/versions';
import {
  VersionCreateParams,
  VersionCreateResponse,
  VersionCreateResponsesSinglePage,
  Versions,
} from './versions/versions';
import { SinglePage } from '../../../../pagination';

export class Datasets extends APIResource {
  upload: UploadAPI.Upload = new UploadAPI.Upload(this._client);
  versions: VersionsAPI.Versions = new VersionsAPI.Versions(this._client);

  /**
   * Create a new dataset
   *
   * @example
   * ```ts
   * const datasetCreation =
   *   await client.zeroTrust.dlp.datasets.create({
   *     account_id: 'account_id',
   *     name: 'name',
   *   });
   * ```
   */
  create(params: DatasetCreateParams, options?: Core.RequestOptions): Core.APIPromise<DatasetCreation> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/dlp/datasets`, { body, ...options }) as Core.APIPromise<{
        result: DatasetCreation;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update details about a dataset
   *
   * @example
   * ```ts
   * const dataset = await client.zeroTrust.dlp.datasets.update(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  update(
    datasetId: string,
    params: DatasetUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Dataset> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/dlp/datasets/${datasetId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Dataset }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch all datasets
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const dataset of client.zeroTrust.dlp.datasets.list(
   *   { account_id: 'account_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: DatasetListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<DatasetsSinglePage, Dataset> {
    const { account_id } = params;
    return this._client.getAPIList(`/accounts/${account_id}/dlp/datasets`, DatasetsSinglePage, options);
  }

  /**
   * This deletes all versions of the dataset.
   *
   * @example
   * ```ts
   * await client.zeroTrust.dlp.datasets.delete(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  delete(
    datasetId: string,
    params: DatasetDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<void> {
    const { account_id } = params;
    return this._client.delete(`/accounts/${account_id}/dlp/datasets/${datasetId}`, {
      ...options,
      headers: { Accept: '*/*', ...options?.headers },
    });
  }

  /**
   * Fetch a specific dataset
   *
   * @example
   * ```ts
   * const dataset = await client.zeroTrust.dlp.datasets.get(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(datasetId: string, params: DatasetGetParams, options?: Core.RequestOptions): Core.APIPromise<Dataset> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/dlp/datasets/${datasetId}`, options) as Core.APIPromise<{
        result: Dataset;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class DatasetsSinglePage extends SinglePage<Dataset> {}

export interface Dataset {
  id: string;

  columns: Array<Dataset.Column>;

  created_at: string;

  encoding_version: number;

  name: string;

  num_cells: number;

  secret: boolean;

  status: 'empty' | 'uploading' | 'pending' | 'processing' | 'failed' | 'complete';

  /**
   * When the dataset was last updated.
   *
   * This includes name or description changes as well as uploads.
   */
  updated_at: string;

  uploads: Array<Dataset.Upload>;

  case_sensitive?: boolean;

  /**
   * The description of the dataset.
   */
  description?: string | null;
}

export namespace Dataset {
  export interface Column {
    entry_id: string;

    header_name: string;

    num_cells: number;

    upload_status: 'empty' | 'uploading' | 'pending' | 'processing' | 'failed' | 'complete';
  }

  export interface Upload {
    num_cells: number;

    status: 'empty' | 'uploading' | 'pending' | 'processing' | 'failed' | 'complete';

    version: number;
  }
}

export type DatasetArray = Array<Dataset>;

export interface DatasetCreation {
  dataset: Dataset;

  /**
   * Encoding version to use for dataset.
   */
  encoding_version: number;

  max_cells: number;

  /**
   * The version to use when uploading the dataset.
   */
  version: number;

  /**
   * The secret to use for Exact Data Match datasets. This is not present in Custom
   * Wordlists.
   */
  secret?: string;
}

export interface DatasetCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  name: string;

  /**
   * Body param: Only applies to custom word lists. Determines if the words should be
   * matched in a case-sensitive manner Cannot be set to false if `secret` is true or
   * undefined
   */
  case_sensitive?: boolean;

  /**
   * Body param: The description of the dataset.
   */
  description?: string | null;

  /**
   * Body param: Dataset encoding version
   *
   * Non-secret custom word lists with no header are always version 1. Secret EDM
   * lists with no header are version 1. Multicolumn CSV with headers are version 2.
   * Omitting this field provides the default value 0, which is interpreted the same
   * as 1.
   */
  encoding_version?: number;

  /**
   * Body param: Generate a secret dataset.
   *
   * If true, the response will include a secret to use with the EDM encoder. If
   * false, the response has no secret and the dataset is uploaded in plaintext.
   */
  secret?: boolean;
}

export interface DatasetUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: Determines if the words should be matched in a case-sensitive
   * manner.
   *
   * Only required for custom word lists.
   */
  case_sensitive?: boolean;

  /**
   * Body param: The description of the dataset.
   */
  description?: string | null;

  /**
   * Body param: The name of the dataset, must be unique.
   */
  name?: string | null;
}

export interface DatasetListParams {
  account_id: string;
}

export interface DatasetDeleteParams {
  account_id: string;
}

export interface DatasetGetParams {
  account_id: string;
}

Datasets.DatasetsSinglePage = DatasetsSinglePage;
Datasets.Upload = UploadAPIUpload;
Datasets.Versions = Versions;
Datasets.VersionCreateResponsesSinglePage = VersionCreateResponsesSinglePage;

export declare namespace Datasets {
  export {
    type Dataset as Dataset,
    type DatasetArray as DatasetArray,
    type DatasetCreation as DatasetCreation,
    DatasetsSinglePage as DatasetsSinglePage,
    type DatasetCreateParams as DatasetCreateParams,
    type DatasetUpdateParams as DatasetUpdateParams,
    type DatasetListParams as DatasetListParams,
    type DatasetDeleteParams as DatasetDeleteParams,
    type DatasetGetParams as DatasetGetParams,
  };

  export {
    UploadAPIUpload as Upload,
    type NewVersion as NewVersion,
    type UploadCreateParams as UploadCreateParams,
    type UploadEditParams as UploadEditParams,
  };

  export {
    Versions as Versions,
    type VersionCreateResponse as VersionCreateResponse,
    VersionCreateResponsesSinglePage as VersionCreateResponsesSinglePage,
    type VersionCreateParams as VersionCreateParams,
  };
}
