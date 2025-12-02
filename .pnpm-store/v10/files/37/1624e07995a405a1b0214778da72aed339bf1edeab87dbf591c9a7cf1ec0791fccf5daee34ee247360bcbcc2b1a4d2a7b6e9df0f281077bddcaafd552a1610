// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class Seats extends APIResource {
  /**
   * Removes a user from a Zero Trust seat when both `access_seat` and `gateway_seat`
   * are set to false.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const seat of client.zeroTrust.seats.edit({
   *   account_id: '699d98642c564d2e855e9661899b7252',
   *   body: [
   *     {
   *       access_seat: false,
   *       gateway_seat: false,
   *       seat_uid: 'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     },
   *   ],
   * })) {
   *   // ...
   * }
   * ```
   */
  edit(params: SeatEditParams, options?: Core.RequestOptions): Core.PagePromise<SeatsSinglePage, Seat> {
    const { account_id, body } = params;
    return this._client.getAPIList(`/accounts/${account_id}/access/seats`, SeatsSinglePage, {
      body: body,
      method: 'patch',
      ...options,
    });
  }
}

export class SeatsSinglePage extends SinglePage<Seat> {}

export interface Seat {
  /**
   * True if the seat is part of Access.
   */
  access_seat?: boolean;

  created_at?: string;

  /**
   * True if the seat is part of Gateway.
   */
  gateway_seat?: boolean;

  /**
   * The unique API identifier for the Zero Trust seat.
   */
  seat_uid?: string;

  updated_at?: string;
}

export interface SeatEditParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: Array<SeatEditParams.Body>;
}

export namespace SeatEditParams {
  export interface Body {
    /**
     * True if the seat is part of Access.
     */
    access_seat: boolean;

    /**
     * True if the seat is part of Gateway.
     */
    gateway_seat: boolean;

    /**
     * The unique API identifier for the Zero Trust seat.
     */
    seat_uid: string;
  }
}

Seats.SeatsSinglePage = SeatsSinglePage;

export declare namespace Seats {
  export { type Seat as Seat, SeatsSinglePage as SeatsSinglePage, type SeatEditParams as SeatEditParams };
}
