// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Move extends APIResource {
  /**
   * Move a message
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const moveCreateResponse of client.emailSecurity.investigate.move.create(
   *   '4Njp3P0STMz2c02Q',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     destination: 'Inbox',
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  create(
    postfixId: string,
    params: MoveCreateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<MoveCreateResponsesSinglePage, MoveCreateResponse> {
    const { account_id, ...body } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/email-security/investigate/${postfixId}/move`,
      MoveCreateResponsesSinglePage,
      { body, method: 'post', ...options },
    );
  }

  /**
   * Move multiple messages
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const moveBulkResponse of client.emailSecurity.investigate.move.bulk(
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     destination: 'Inbox',
   *     postfix_ids: ['4Njp3P0STMz2c02Q'],
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  bulk(
    params: MoveBulkParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<MoveBulkResponsesSinglePage, MoveBulkResponse> {
    const { account_id, ...body } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/email-security/investigate/move`,
      MoveBulkResponsesSinglePage,
      { body, method: 'post', ...options },
    );
  }
}

export class MoveCreateResponsesSinglePage extends SinglePage<MoveCreateResponse> {}

export class MoveBulkResponsesSinglePage extends SinglePage<MoveBulkResponse> {}

export interface MoveCreateResponse {
  completed_timestamp: string;

  item_count: number;

  destination?: string | null;

  message_id?: string | null;

  operation?: string | null;

  recipient?: string | null;

  status?: string | null;
}

export interface MoveBulkResponse {
  completed_timestamp: string;

  item_count: number;

  destination?: string | null;

  message_id?: string | null;

  operation?: string | null;

  recipient?: string | null;

  status?: string | null;
}

export interface MoveCreateParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  destination:
    | 'Inbox'
    | 'JunkEmail'
    | 'DeletedItems'
    | 'RecoverableItemsDeletions'
    | 'RecoverableItemsPurges';
}

export interface MoveBulkParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param:
   */
  destination:
    | 'Inbox'
    | 'JunkEmail'
    | 'DeletedItems'
    | 'RecoverableItemsDeletions'
    | 'RecoverableItemsPurges';

  /**
   * Body param:
   */
  postfix_ids: Array<string>;
}

Move.MoveCreateResponsesSinglePage = MoveCreateResponsesSinglePage;
Move.MoveBulkResponsesSinglePage = MoveBulkResponsesSinglePage;

export declare namespace Move {
  export {
    type MoveCreateResponse as MoveCreateResponse,
    type MoveBulkResponse as MoveBulkResponse,
    MoveCreateResponsesSinglePage as MoveCreateResponsesSinglePage,
    MoveBulkResponsesSinglePage as MoveBulkResponsesSinglePage,
    type MoveCreateParams as MoveCreateParams,
    type MoveBulkParams as MoveBulkParams,
  };
}
