// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';
import * as WorkersAPI from '../../../../workers/workers';
import * as ScriptsAPI from '../../../../workers/scripts/scripts';
import { type Response } from '../../../../../_shims/index';

export class Content extends APIResource {
  /**
   * Put script content for a script uploaded to a Workers for Platforms namespace.
   *
   * @example
   * ```ts
   * const script =
   *   await client.workersForPlatforms.dispatch.namespaces.scripts.content.update(
   *     'my-dispatch-namespace',
   *     'this-is_my_script-01',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       metadata: {},
   *     },
   *   );
   * ```
   */
  update(
    dispatchNamespace: string,
    scriptName: string,
    params: ContentUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ScriptsAPI.Script> {
    const {
      account_id,
      'CF-WORKER-BODY-PART': cfWorkerBodyPart,
      'CF-WORKER-MAIN-MODULE-PART': cfWorkerMainModulePart,
      ...body
    } = params;
    return (
      this._client.put(
        `/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/content`,
        Core.multipartFormRequestOptions({
          body,
          ...options,
          headers: {
            ...(cfWorkerBodyPart != null ? { 'CF-WORKER-BODY-PART': cfWorkerBodyPart } : undefined),
            ...(cfWorkerMainModulePart != null ?
              { 'CF-WORKER-MAIN-MODULE-PART': cfWorkerMainModulePart }
            : undefined),
            ...options?.headers,
          },
        }),
      ) as Core.APIPromise<{ result: ScriptsAPI.Script }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch script content from a script uploaded to a Workers for Platforms
   * namespace.
   *
   * @example
   * ```ts
   * const content =
   *   await client.workersForPlatforms.dispatch.namespaces.scripts.content.get(
   *     'my-dispatch-namespace',
   *     'this-is_my_script-01',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   *
   * const data = await content.blob();
   * console.log(data);
   * ```
   */
  get(
    dispatchNamespace: string,
    scriptName: string,
    params: ContentGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<Response> {
    const { account_id } = params;
    return this._client.get(
      `/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/content`,
      { ...options, headers: { Accept: 'string', ...options?.headers }, __binaryResponse: true },
    );
  }
}

export interface ContentUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: JSON encoded metadata about the uploaded parts and Worker
   * configuration.
   */
  metadata: WorkersAPI.WorkerMetadataParam;

  /**
   * Header param: The multipart name of a script upload part containing script
   * content in service worker format. Alternative to including in a metadata part.
   */
  'CF-WORKER-BODY-PART'?: string;

  /**
   * Header param: The multipart name of a script upload part containing script
   * content in es module format. Alternative to including in a metadata part.
   */
  'CF-WORKER-MAIN-MODULE-PART'?: string;

  [k: string]: Array<Core.Uploadable> | string | WorkersAPI.WorkerMetadataParam | undefined;
}

export interface ContentGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export declare namespace Content {
  export { type ContentUpdateParams as ContentUpdateParams, type ContentGetParams as ContentGetParams };
}
