// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as RequestsAPI from './requests';

export class PriorityResource extends APIResource {
  /**
   * Create a New Priority Intelligence Requirement
   *
   * @example
   * ```ts
   * const priority =
   *   await client.cloudforceOne.requests.priority.create({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     labels: ['DoS', 'CVE'],
   *     priority: 1,
   *     requirement: 'DoS attacks carried out by CVEs',
   *     tlp: 'clear',
   *   });
   * ```
   */
  create(params: PriorityCreateParams, options?: Core.RequestOptions): Core.APIPromise<Priority> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/cloudforce-one/requests/priority/new`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: Priority }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a Priority Intelligence Requirement
   *
   * @example
   * ```ts
   * const item =
   *   await client.cloudforceOne.requests.priority.update(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       labels: ['DoS', 'CVE'],
   *       priority: 1,
   *       requirement: 'DoS attacks carried out by CVEs',
   *       tlp: 'clear',
   *     },
   *   );
   * ```
   */
  update(
    priorityId: string,
    params: PriorityUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RequestsAPI.Item> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/cloudforce-one/requests/priority/${priorityId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: RequestsAPI.Item }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Delete a Priority Intelligence Requirement
   *
   * @example
   * ```ts
   * const priority =
   *   await client.cloudforceOne.requests.priority.delete(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  delete(
    priorityId: string,
    params: PriorityDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PriorityDeleteResponse> {
    const { account_id } = params;
    return this._client.delete(
      `/accounts/${account_id}/cloudforce-one/requests/priority/${priorityId}`,
      options,
    );
  }

  /**
   * Get a Priority Intelligence Requirement
   *
   * @example
   * ```ts
   * const item =
   *   await client.cloudforceOne.requests.priority.get(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   *   );
   * ```
   */
  get(
    priorityId: string,
    params: PriorityGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RequestsAPI.Item> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/cloudforce-one/requests/priority/${priorityId}`,
        options,
      ) as Core.APIPromise<{ result: RequestsAPI.Item }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get Priority Intelligence Requirement Quota
   *
   * @example
   * ```ts
   * const quota =
   *   await client.cloudforceOne.requests.priority.quota({
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  quota(params: PriorityQuotaParams, options?: Core.RequestOptions): Core.APIPromise<RequestsAPI.Quota> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/cloudforce-one/requests/priority/quota`,
        options,
      ) as Core.APIPromise<{ result: RequestsAPI.Quota }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type Label = string;

export type LabelParam = string;

export interface Priority {
  /**
   * UUID.
   */
  id: string;

  /**
   * Priority creation time.
   */
  created: string;

  /**
   * List of labels.
   */
  labels: Array<Label>;

  /**
   * Priority.
   */
  priority: number;

  /**
   * Requirement.
   */
  requirement: string;

  /**
   * The CISA defined Traffic Light Protocol (TLP).
   */
  tlp: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';

  /**
   * Priority last updated time.
   */
  updated: string;
}

export interface PriorityEdit {
  /**
   * List of labels.
   */
  labels: Array<Label>;

  /**
   * Priority.
   */
  priority: number;

  /**
   * Requirement.
   */
  requirement: string;

  /**
   * The CISA defined Traffic Light Protocol (TLP).
   */
  tlp: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';
}

export interface PriorityDeleteResponse {
  errors: Array<PriorityDeleteResponse.Error>;

  messages: Array<PriorityDeleteResponse.Message>;

  /**
   * Whether the API call was successful.
   */
  success: true;
}

export namespace PriorityDeleteResponse {
  export interface Error {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Error.Source;
  }

  export namespace Error {
    export interface Source {
      pointer?: string;
    }
  }

  export interface Message {
    code: number;

    message: string;

    documentation_url?: string;

    source?: Message.Source;
  }

  export namespace Message {
    export interface Source {
      pointer?: string;
    }
  }
}

export interface PriorityCreateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: List of labels.
   */
  labels: Array<LabelParam>;

  /**
   * Body param: Priority.
   */
  priority: number;

  /**
   * Body param: Requirement.
   */
  requirement: string;

  /**
   * Body param: The CISA defined Traffic Light Protocol (TLP).
   */
  tlp: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';
}

export interface PriorityUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: List of labels.
   */
  labels: Array<LabelParam>;

  /**
   * Body param: Priority.
   */
  priority: number;

  /**
   * Body param: Requirement.
   */
  requirement: string;

  /**
   * Body param: The CISA defined Traffic Light Protocol (TLP).
   */
  tlp: 'clear' | 'amber' | 'amber-strict' | 'green' | 'red';
}

export interface PriorityDeleteParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface PriorityGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface PriorityQuotaParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export declare namespace PriorityResource {
  export {
    type Label as Label,
    type Priority as Priority,
    type PriorityEdit as PriorityEdit,
    type PriorityDeleteResponse as PriorityDeleteResponse,
    type PriorityCreateParams as PriorityCreateParams,
    type PriorityUpdateParams as PriorityUpdateParams,
    type PriorityDeleteParams as PriorityDeleteParams,
    type PriorityGetParams as PriorityGetParams,
    type PriorityQuotaParams as PriorityQuotaParams,
  };
}
