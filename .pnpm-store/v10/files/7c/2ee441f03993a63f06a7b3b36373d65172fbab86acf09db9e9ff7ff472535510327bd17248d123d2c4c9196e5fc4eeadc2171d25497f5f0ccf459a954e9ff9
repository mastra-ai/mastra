// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';

export class Upload extends APIResource {
  /**
   * Start uploading a collection of assets for use in a Worker version. To learn
   * more about the direct uploads of assets, see
   * https://developers.cloudflare.com/workers/static-assets/direct-upload/.
   *
   * @example
   * ```ts
   * const upload =
   *   await client.workers.scripts.assets.upload.create(
   *     'this-is_my_script-01',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       manifest: { foo: { hash: 'hash', size: 0 } },
   *     },
   *   );
   * ```
   */
  create(
    scriptName: string,
    params: UploadCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<UploadCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/workers/scripts/${scriptName}/assets-upload-session`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: UploadCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface UploadCreateResponse {
  /**
   * The requests to make to upload assets.
   */
  buckets?: Array<Array<string>>;

  /**
   * A JWT to use as authentication for uploading assets.
   */
  jwt?: string;
}

export interface UploadCreateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: A manifest ([path]: {hash, size}) map of files to upload. As an
   * example, `/blog/hello-world.html` would be a valid path key.
   */
  manifest: { [key: string]: UploadCreateParams.Manifest };
}

export namespace UploadCreateParams {
  export interface Manifest {
    /**
     * The hash of the file.
     */
    hash: string;

    /**
     * The size of the file in bytes.
     */
    size: number;
  }
}

export declare namespace Upload {
  export { type UploadCreateResponse as UploadCreateResponse, type UploadCreateParams as UploadCreateParams };
}
