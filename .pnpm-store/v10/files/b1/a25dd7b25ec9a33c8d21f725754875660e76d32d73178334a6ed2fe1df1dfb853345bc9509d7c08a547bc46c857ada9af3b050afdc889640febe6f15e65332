// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class ActivationCheck extends APIResource {
  /**
   * Triggeres a new activation check for a PENDING Zone. This can be triggered every
   * 5 min for paygo/ent customers, every hour for FREE Zones.
   *
   * @example
   * ```ts
   * const response = await client.zones.activationCheck.trigger(
   *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  trigger(
    params: ActivationCheckTriggerParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ActivationCheckTriggerResponse> {
    const { zone_id } = params;
    return (
      this._client.put(`/zones/${zone_id}/activation_check`, options) as Core.APIPromise<{
        result: ActivationCheckTriggerResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ActivationCheckTriggerResponse {
  /**
   * Identifier.
   */
  id?: string;
}

export interface ActivationCheckTriggerParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace ActivationCheck {
  export {
    type ActivationCheckTriggerResponse as ActivationCheckTriggerResponse,
    type ActivationCheckTriggerParams as ActivationCheckTriggerParams,
  };
}
