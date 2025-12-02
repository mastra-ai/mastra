// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Behaviours extends APIResource {
  /**
   * Update configuration for risk behaviors
   *
   * @example
   * ```ts
   * const behaviour =
   *   await client.zeroTrust.riskScoring.behaviours.update({
   *     account_id: 'account_id',
   *     behaviors: {
   *       foo: { enabled: true, risk_level: 'low' },
   *     },
   *   });
   * ```
   */
  update(
    params: BehaviourUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<BehaviourUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/zt_risk_scoring/behaviors`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: BehaviourUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get all behaviors and associated configuration
   *
   * @example
   * ```ts
   * const behaviour =
   *   await client.zeroTrust.riskScoring.behaviours.get({
   *     account_id: 'account_id',
   *   });
   * ```
   */
  get(params: BehaviourGetParams, options?: Core.RequestOptions): Core.APIPromise<BehaviourGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/zt_risk_scoring/behaviors`, options) as Core.APIPromise<{
        result: BehaviourGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface BehaviourUpdateResponse {
  behaviors: { [key: string]: BehaviourUpdateResponse.Behaviors };
}

export namespace BehaviourUpdateResponse {
  export interface Behaviors {
    enabled: boolean;

    risk_level: 'low' | 'medium' | 'high';
  }
}

export interface BehaviourGetResponse {
  behaviors: { [key: string]: BehaviourGetResponse.Behaviors };
}

export namespace BehaviourGetResponse {
  export interface Behaviors {
    description: string;

    enabled: boolean;

    name: string;

    risk_level: 'low' | 'medium' | 'high';
  }
}

export interface BehaviourUpdateParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Body param:
   */
  behaviors: { [key: string]: BehaviourUpdateParams.Behaviors };
}

export namespace BehaviourUpdateParams {
  export interface Behaviors {
    enabled: boolean;

    risk_level: 'low' | 'medium' | 'high';
  }
}

export interface BehaviourGetParams {
  account_id: string;
}

export declare namespace Behaviours {
  export {
    type BehaviourUpdateResponse as BehaviourUpdateResponse,
    type BehaviourGetResponse as BehaviourGetResponse,
    type BehaviourUpdateParams as BehaviourUpdateParams,
    type BehaviourGetParams as BehaviourGetParams,
  };
}
