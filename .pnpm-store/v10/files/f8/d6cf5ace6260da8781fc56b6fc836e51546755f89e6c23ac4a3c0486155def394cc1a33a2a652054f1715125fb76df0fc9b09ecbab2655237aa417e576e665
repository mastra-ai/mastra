// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as DeploymentsAPI from './deployments';

export class Deployments extends APIResource {
  /**
   * Deployments configure how
   * [Worker Versions](https://developers.cloudflare.com/api/operations/worker-versions-list-versions)
   * are deployed to traffic. A deployment can consist of one or two versions of a
   * Worker.
   *
   * @example
   * ```ts
   * const deployment =
   *   await client.workers.scripts.deployments.create(
   *     'this-is_my_script-01',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       strategy: 'percentage',
   *       versions: [
   *         {
   *           percentage: 100,
   *           version_id:
   *             'bcf48806-b317-4351-9ee7-36e7d557d4de',
   *         },
   *       ],
   *     },
   *   );
   * ```
   */
  create(
    scriptName: string,
    params: DeploymentCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DeploymentCreateResponse> {
    const { account_id, force, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/workers/scripts/${scriptName}/deployments`, {
        query: { force },
        body,
        ...options,
      }) as Core.APIPromise<{ result: DeploymentCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List of Worker Deployments. The first deployment in the list is the latest
   * deployment actively serving traffic.
   *
   * @example
   * ```ts
   * const deployment =
   *   await client.workers.scripts.deployments.get(
   *     'this-is_my_script-01',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    scriptName: string,
    params: DeploymentGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DeploymentGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/workers/scripts/${scriptName}/deployments`,
        options,
      ) as Core.APIPromise<{ result: DeploymentGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface Deployment {
  /**
   * Human-readable message about the deployment. Truncated to 100 bytes.
   */
  'workers/message'?: string;
}

export interface DeploymentParam {
  /**
   * Human-readable message about the deployment. Truncated to 100 bytes.
   */
  'workers/message'?: string;
}

export interface DeploymentCreateResponse {
  strategy: 'percentage';

  versions: Array<DeploymentCreateResponse.Version>;

  id?: string;

  annotations?: Deployment;

  author_email?: string;

  created_on?: string;

  source?: string;
}

export namespace DeploymentCreateResponse {
  export interface Version {
    percentage: number;

    version_id: string;
  }
}

export interface DeploymentGetResponse {
  deployments?: Array<DeploymentGetResponse.Deployment>;
}

export namespace DeploymentGetResponse {
  export interface Deployment {
    strategy: 'percentage';

    versions: Array<Deployment.Version>;

    id?: string;

    annotations?: DeploymentsAPI.Deployment;

    author_email?: string;

    created_on?: string;

    source?: string;
  }

  export namespace Deployment {
    export interface Version {
      percentage: number;

      version_id: string;
    }
  }
}

export interface DeploymentCreateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  strategy: 'percentage';

  /**
   * Body param:
   */
  versions: Array<DeploymentCreateParams.Version>;

  /**
   * Query param: If set to true, the deployment will be created even if normally
   * blocked by something such rolling back to an older version when a secret has
   * changed.
   */
  force?: boolean;

  /**
   * Body param:
   */
  annotations?: DeploymentParam;
}

export namespace DeploymentCreateParams {
  export interface Version {
    percentage: number;

    version_id: string;
  }
}

export interface DeploymentGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export declare namespace Deployments {
  export {
    type Deployment as Deployment,
    type DeploymentCreateResponse as DeploymentCreateResponse,
    type DeploymentGetResponse as DeploymentGetResponse,
    type DeploymentCreateParams as DeploymentCreateParams,
    type DeploymentGetParams as DeploymentGetParams,
  };
}
