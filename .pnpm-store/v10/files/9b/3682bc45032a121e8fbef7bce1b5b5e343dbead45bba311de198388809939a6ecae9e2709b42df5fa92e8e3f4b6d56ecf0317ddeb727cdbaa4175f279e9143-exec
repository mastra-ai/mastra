// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';
import * as EntriesAPI from './entries';
import { Entries, EntryCreateParams, EntryCreateResponse } from './entries';
import { SinglePage } from '../../../../../pagination';

export class Versions extends APIResource {
  entries: EntriesAPI.Entries = new EntriesAPI.Entries(this._client);

  /**
   * This is used for multi-column EDMv2 datasets. The EDMv2 format can only be
   * created in the Cloudflare dashboard. The columns in the response appear in the
   * same order as in the request.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const versionCreateResponse of client.zeroTrust.dlp.datasets.versions.create(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   0,
   *   {
   *     account_id: 'account_id',
   *     body: [
   *       { entry_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
   *     ],
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  create(
    datasetId: string,
    version: number,
    params: VersionCreateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<VersionCreateResponsesSinglePage, VersionCreateResponse> {
    const { account_id, body } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/dlp/datasets/${datasetId}/versions/${version}`,
      VersionCreateResponsesSinglePage,
      { body: body, method: 'post', ...options },
    );
  }
}

export class VersionCreateResponsesSinglePage extends SinglePage<VersionCreateResponse> {}

export interface VersionCreateResponse {
  entry_id: string;

  header_name: string;

  num_cells: number;

  upload_status: 'empty' | 'uploading' | 'pending' | 'processing' | 'failed' | 'complete';
}

export interface VersionCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  body: Array<VersionCreateParams.ExistingColumn | VersionCreateParams.NewColumn>;
}

export namespace VersionCreateParams {
  export interface ExistingColumn {
    entry_id: string;

    header_name?: string;

    num_cells?: number;
  }

  export interface NewColumn {
    entry_name: string;

    header_name?: string;

    num_cells?: number;
  }
}

Versions.VersionCreateResponsesSinglePage = VersionCreateResponsesSinglePage;
Versions.Entries = Entries;

export declare namespace Versions {
  export {
    type VersionCreateResponse as VersionCreateResponse,
    VersionCreateResponsesSinglePage as VersionCreateResponsesSinglePage,
    type VersionCreateParams as VersionCreateParams,
  };

  export {
    Entries as Entries,
    type EntryCreateResponse as EntryCreateResponse,
    type EntryCreateParams as EntryCreateParams,
  };
}
