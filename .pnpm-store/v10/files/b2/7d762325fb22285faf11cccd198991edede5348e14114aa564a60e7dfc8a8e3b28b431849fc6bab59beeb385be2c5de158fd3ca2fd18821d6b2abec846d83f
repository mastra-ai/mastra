// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class Slots extends APIResource {
  /**
   * Retrieve a list of all slots matching the specified parameters
   *
   * @example
   * ```ts
   * const slots = await client.networkInterconnects.slots.list({
   *   account_id: 'account_id',
   * });
   * ```
   */
  list(params: SlotListParams, options?: Core.RequestOptions): Core.APIPromise<SlotListResponse> {
    const { account_id, ...query } = params;
    return this._client.get(`/accounts/${account_id}/cni/slots`, { query, ...options });
  }

  /**
   * Get information about the specified slot
   *
   * @example
   * ```ts
   * const slot = await client.networkInterconnects.slots.get(
   *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(slot: string, params: SlotGetParams, options?: Core.RequestOptions): Core.APIPromise<SlotGetResponse> {
    const { account_id } = params;
    return this._client.get(`/accounts/${account_id}/cni/slots/${slot}`, options);
  }
}

export interface SlotListResponse {
  items: Array<SlotListResponse.Item>;

  next?: number | null;
}

export namespace SlotListResponse {
  export interface Item {
    /**
     * Slot ID
     */
    id: string;

    facility: Item.Facility;

    /**
     * Whether the slot is occupied or not
     */
    occupied: boolean;

    site: string;

    speed: string;

    /**
     * Customer account tag
     */
    account?: string;
  }

  export namespace Item {
    export interface Facility {
      address: Array<string>;

      name: string;
    }
  }
}

export interface SlotGetResponse {
  /**
   * Slot ID
   */
  id: string;

  facility: SlotGetResponse.Facility;

  /**
   * Whether the slot is occupied or not
   */
  occupied: boolean;

  site: string;

  speed: string;

  /**
   * Customer account tag
   */
  account?: string;
}

export namespace SlotGetResponse {
  export interface Facility {
    address: Array<string>;

    name: string;
  }
}

export interface SlotListParams {
  /**
   * Path param: Customer account tag
   */
  account_id: string;

  /**
   * Query param: If specified, only show slots with the given text in their address
   * field
   */
  address_contains?: string | null;

  /**
   * Query param:
   */
  cursor?: number | null;

  /**
   * Query param:
   */
  limit?: number | null;

  /**
   * Query param: If specified, only show slots with a specific occupied/unoccupied
   * state
   */
  occupied?: boolean | null;

  /**
   * Query param: If specified, only show slots located at the given site
   */
  site?: string | null;

  /**
   * Query param: If specified, only show slots that support the given speed
   */
  speed?: string | null;
}

export interface SlotGetParams {
  /**
   * Customer account tag
   */
  account_id: string;
}

export declare namespace Slots {
  export {
    type SlotListResponse as SlotListResponse,
    type SlotGetResponse as SlotGetResponse,
    type SlotListParams as SlotListParams,
    type SlotGetParams as SlotGetParams,
  };
}
