// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as OperationsAPI from './operations';
import {
  OperationBulkEditParams,
  OperationBulkEditResponse,
  OperationEditParams,
  OperationEditResponse,
  OperationListParams,
  Operations,
} from './operations';
import { V4PagePaginationArray } from '../../../pagination';

export class Discovery extends APIResource {
  operations: OperationsAPI.Operations = new OperationsAPI.Operations(this._client);

  /**
   * Retrieve the most up to date view of discovered operations, rendered as OpenAPI
   * schemas
   *
   * @example
   * ```ts
   * const discovery = await client.apiGateway.discovery.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: DiscoveryGetParams, options?: Core.RequestOptions): Core.APIPromise<DiscoveryGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/api_gateway/discovery`, options) as Core.APIPromise<{
        result: DiscoveryGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class DiscoveryOperationsV4PagePaginationArray extends V4PagePaginationArray<DiscoveryOperation> {}

export interface DiscoveryOperation {
  /**
   * UUID.
   */
  id: string;

  /**
   * The endpoint which can contain path parameter templates in curly braces, each
   * will be replaced from left to right with {varN}, starting with {var1}, during
   * insertion. This will further be Cloudflare-normalized upon insertion. See:
   * https://developers.cloudflare.com/rules/normalization/how-it-works/.
   */
  endpoint: string;

  /**
   * RFC3986-compliant host.
   */
  host: string;

  last_updated: string;

  /**
   * The HTTP method used to access the endpoint.
   */
  method: 'GET' | 'POST' | 'HEAD' | 'OPTIONS' | 'PUT' | 'DELETE' | 'CONNECT' | 'PATCH' | 'TRACE';

  /**
   * API discovery engine(s) that discovered this operation
   */
  origin: Array<'ML' | 'SessionIdentifier' | 'LabelDiscovery'>;

  /**
   * State of operation in API Discovery
   *
   * - `review` - Operation is not saved into API Shield Endpoint Management
   * - `saved` - Operation is saved into API Shield Endpoint Management
   * - `ignored` - Operation is marked as ignored
   */
  state: 'review' | 'saved' | 'ignored';

  features?: DiscoveryOperation.Features;
}

export namespace DiscoveryOperation {
  export interface Features {
    traffic_stats?: Features.TrafficStats;
  }

  export namespace Features {
    export interface TrafficStats {
      last_updated: string;

      /**
       * The period in seconds these statistics were computed over
       */
      period_seconds: number;

      /**
       * The average number of requests seen during this period
       */
      requests: number;
    }
  }
}

export interface DiscoveryGetResponse {
  schemas: Array<unknown>;

  timestamp: string;
}

export interface DiscoveryGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

Discovery.Operations = Operations;

export declare namespace Discovery {
  export {
    type DiscoveryOperation as DiscoveryOperation,
    type DiscoveryGetResponse as DiscoveryGetResponse,
    type DiscoveryGetParams as DiscoveryGetParams,
  };

  export {
    Operations as Operations,
    type OperationBulkEditResponse as OperationBulkEditResponse,
    type OperationEditResponse as OperationEditResponse,
    type OperationListParams as OperationListParams,
    type OperationBulkEditParams as OperationBulkEditParams,
    type OperationEditParams as OperationEditParams,
  };
}
