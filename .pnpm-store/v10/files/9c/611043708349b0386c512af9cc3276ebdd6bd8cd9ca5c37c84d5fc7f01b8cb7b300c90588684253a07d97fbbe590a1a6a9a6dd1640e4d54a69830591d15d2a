// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Locks extends APIResource {
  /**
   * Set lock rules for a bucket.
   *
   * @example
   * ```ts
   * const lock = await client.r2.buckets.locks.update(
   *   'example-bucket',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  update(
    bucketName: string,
    params: LockUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LockUpdateResponse> {
    const { account_id, jurisdiction, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/r2/buckets/${bucketName}/lock`, {
        body,
        ...options,
        headers: {
          ...(jurisdiction?.toString() != null ?
            { 'cf-r2-jurisdiction': jurisdiction?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: LockUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get lock rules for a bucket.
   *
   * @example
   * ```ts
   * const lock = await client.r2.buckets.locks.get(
   *   'example-bucket',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    bucketName: string,
    params: LockGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LockGetResponse> {
    const { account_id, jurisdiction } = params;
    return (
      this._client.get(`/accounts/${account_id}/r2/buckets/${bucketName}/lock`, {
        ...options,
        headers: {
          ...(jurisdiction?.toString() != null ?
            { 'cf-r2-jurisdiction': jurisdiction?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: LockGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type LockUpdateResponse = unknown;

export interface LockGetResponse {
  rules?: Array<LockGetResponse.Rule>;
}

export namespace LockGetResponse {
  export interface Rule {
    /**
     * Unique identifier for this rule.
     */
    id: string;

    /**
     * Condition to apply a lock rule to an object for how long in seconds.
     */
    condition:
      | Rule.R2LockRuleAgeCondition
      | Rule.R2LockRuleDateCondition
      | Rule.R2LockRuleIndefiniteCondition;

    /**
     * Whether or not this rule is in effect.
     */
    enabled: boolean;

    /**
     * Rule will only apply to objects/uploads in the bucket that start with the given
     * prefix, an empty prefix can be provided to scope rule to all objects/uploads.
     */
    prefix?: string;
  }

  export namespace Rule {
    /**
     * Condition to apply a lock rule to an object for how long in seconds.
     */
    export interface R2LockRuleAgeCondition {
      maxAgeSeconds: number;

      type: 'Age';
    }

    /**
     * Condition to apply a lock rule to an object until a specific date.
     */
    export interface R2LockRuleDateCondition {
      date: string;

      type: 'Date';
    }

    /**
     * Condition to apply a lock rule indefinitely.
     */
    export interface R2LockRuleIndefiniteCondition {
      type: 'Indefinite';
    }
  }
}

export interface LockUpdateParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Body param:
   */
  rules?: Array<LockUpdateParams.Rule>;

  /**
   * Header param: Jurisdiction where objects in this bucket are guaranteed to be
   * stored.
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';
}

export namespace LockUpdateParams {
  export interface Rule {
    /**
     * Unique identifier for this rule.
     */
    id: string;

    /**
     * Condition to apply a lock rule to an object for how long in seconds.
     */
    condition:
      | Rule.R2LockRuleAgeCondition
      | Rule.R2LockRuleDateCondition
      | Rule.R2LockRuleIndefiniteCondition;

    /**
     * Whether or not this rule is in effect.
     */
    enabled: boolean;

    /**
     * Rule will only apply to objects/uploads in the bucket that start with the given
     * prefix, an empty prefix can be provided to scope rule to all objects/uploads.
     */
    prefix?: string;
  }

  export namespace Rule {
    /**
     * Condition to apply a lock rule to an object for how long in seconds.
     */
    export interface R2LockRuleAgeCondition {
      maxAgeSeconds: number;

      type: 'Age';
    }

    /**
     * Condition to apply a lock rule to an object until a specific date.
     */
    export interface R2LockRuleDateCondition {
      date: string;

      type: 'Date';
    }

    /**
     * Condition to apply a lock rule indefinitely.
     */
    export interface R2LockRuleIndefiniteCondition {
      type: 'Indefinite';
    }
  }
}

export interface LockGetParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Header param: Jurisdiction where objects in this bucket are guaranteed to be
   * stored.
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';
}

export declare namespace Locks {
  export {
    type LockUpdateResponse as LockUpdateResponse,
    type LockGetResponse as LockGetResponse,
    type LockUpdateParams as LockUpdateParams,
    type LockGetParams as LockGetParams,
  };
}
