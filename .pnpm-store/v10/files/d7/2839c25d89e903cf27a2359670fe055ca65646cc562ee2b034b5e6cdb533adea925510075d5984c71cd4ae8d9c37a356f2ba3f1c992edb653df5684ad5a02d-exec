// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';
import { type BlobLike } from '../../../../../uploads';

export class Entries extends APIResource {
  /**
   * This is used for multi-column EDMv2 datasets. The EDMv2 format can only be
   * created in the Cloudflare dashboard.
   *
   * @example
   * ```ts
   * const entry =
   *   await client.zeroTrust.dlp.datasets.versions.entries.create(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     0,
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     {
   *       account_id: 'account_id',
   *       body: fs.createReadStream('path/to/file'),
   *     },
   *   );
   * ```
   */
  create(
    datasetId: string,
    version: number,
    entryId: string,
    params: EntryCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EntryCreateResponse> {
    const { account_id, body } = params;
    return (
      this._client.post(
        `/accounts/${account_id}/dlp/datasets/${datasetId}/versions/${version}/entries/${entryId}`,
        {
          body: body,
          ...options,
          headers: { 'Content-Type': 'application/octet-stream', ...options?.headers },
          __binaryRequest: true,
        },
      ) as Core.APIPromise<{ result: EntryCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface EntryCreateResponse {
  entry_id: string;

  header_name: string;

  num_cells: number;

  upload_status: 'empty' | 'uploading' | 'pending' | 'processing' | 'failed' | 'complete';
}

export interface EntryCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  body: string | ArrayBufferView | ArrayBuffer | BlobLike;
}

export declare namespace Entries {
  export { type EntryCreateResponse as EntryCreateResponse, type EntryCreateParams as EntryCreateParams };
}
