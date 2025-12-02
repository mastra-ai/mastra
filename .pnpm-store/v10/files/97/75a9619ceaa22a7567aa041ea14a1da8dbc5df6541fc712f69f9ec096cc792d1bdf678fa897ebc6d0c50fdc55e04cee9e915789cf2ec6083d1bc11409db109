// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Lifecycle extends APIResource {
  /**
   * Set the object lifecycle rules for a bucket.
   *
   * @example
   * ```ts
   * const lifecycle = await client.r2.buckets.lifecycle.update(
   *   'example-bucket',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  update(
    bucketName: string,
    params: LifecycleUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LifecycleUpdateResponse> {
    const { account_id, jurisdiction, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/r2/buckets/${bucketName}/lifecycle`, {
        body,
        ...options,
        headers: {
          ...(jurisdiction?.toString() != null ?
            { 'cf-r2-jurisdiction': jurisdiction?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: LifecycleUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get object lifecycle rules for a bucket.
   *
   * @example
   * ```ts
   * const lifecycle = await client.r2.buckets.lifecycle.get(
   *   'example-bucket',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    bucketName: string,
    params: LifecycleGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<LifecycleGetResponse> {
    const { account_id, jurisdiction } = params;
    return (
      this._client.get(`/accounts/${account_id}/r2/buckets/${bucketName}/lifecycle`, {
        ...options,
        headers: {
          ...(jurisdiction?.toString() != null ?
            { 'cf-r2-jurisdiction': jurisdiction?.toString() }
          : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: LifecycleGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type LifecycleUpdateResponse = unknown;

export interface LifecycleGetResponse {
  rules?: Array<LifecycleGetResponse.Rule>;
}

export namespace LifecycleGetResponse {
  export interface Rule {
    /**
     * Unique identifier for this rule.
     */
    id: string;

    /**
     * Conditions that apply to all transitions of this rule.
     */
    conditions: Rule.Conditions;

    /**
     * Whether or not this rule is in effect.
     */
    enabled: boolean;

    /**
     * Transition to abort ongoing multipart uploads.
     */
    abortMultipartUploadsTransition?: Rule.AbortMultipartUploadsTransition;

    /**
     * Transition to delete objects.
     */
    deleteObjectsTransition?: Rule.DeleteObjectsTransition;

    /**
     * Transitions to change the storage class of objects.
     */
    storageClassTransitions?: Array<Rule.StorageClassTransition>;
  }

  export namespace Rule {
    /**
     * Conditions that apply to all transitions of this rule.
     */
    export interface Conditions {
      /**
       * Transitions will only apply to objects/uploads in the bucket that start with the
       * given prefix, an empty prefix can be provided to scope rule to all
       * objects/uploads.
       */
      prefix: string;
    }

    /**
     * Transition to abort ongoing multipart uploads.
     */
    export interface AbortMultipartUploadsTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      condition?: AbortMultipartUploadsTransition.Condition;
    }

    export namespace AbortMultipartUploadsTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      export interface Condition {
        maxAge: number;

        type: 'Age';
      }
    }

    /**
     * Transition to delete objects.
     */
    export interface DeleteObjectsTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      condition?:
        | DeleteObjectsTransition.R2LifecycleAgeCondition
        | DeleteObjectsTransition.R2LifecycleDateCondition;
    }

    export namespace DeleteObjectsTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      export interface R2LifecycleAgeCondition {
        maxAge: number;

        type: 'Age';
      }

      /**
       * Condition for lifecycle transitions to apply on a specific date.
       */
      export interface R2LifecycleDateCondition {
        date: string;

        type: 'Date';
      }
    }

    export interface StorageClassTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      condition:
        | StorageClassTransition.R2LifecycleAgeCondition
        | StorageClassTransition.R2LifecycleDateCondition;

      storageClass: 'InfrequentAccess';
    }

    export namespace StorageClassTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      export interface R2LifecycleAgeCondition {
        maxAge: number;

        type: 'Age';
      }

      /**
       * Condition for lifecycle transitions to apply on a specific date.
       */
      export interface R2LifecycleDateCondition {
        date: string;

        type: 'Date';
      }
    }
  }
}

export interface LifecycleUpdateParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Body param:
   */
  rules?: Array<LifecycleUpdateParams.Rule>;

  /**
   * Header param: Jurisdiction where objects in this bucket are guaranteed to be
   * stored.
   */
  jurisdiction?: 'default' | 'eu' | 'fedramp';
}

export namespace LifecycleUpdateParams {
  export interface Rule {
    /**
     * Unique identifier for this rule.
     */
    id: string;

    /**
     * Conditions that apply to all transitions of this rule.
     */
    conditions: Rule.Conditions;

    /**
     * Whether or not this rule is in effect.
     */
    enabled: boolean;

    /**
     * Transition to abort ongoing multipart uploads.
     */
    abortMultipartUploadsTransition?: Rule.AbortMultipartUploadsTransition;

    /**
     * Transition to delete objects.
     */
    deleteObjectsTransition?: Rule.DeleteObjectsTransition;

    /**
     * Transitions to change the storage class of objects.
     */
    storageClassTransitions?: Array<Rule.StorageClassTransition>;
  }

  export namespace Rule {
    /**
     * Conditions that apply to all transitions of this rule.
     */
    export interface Conditions {
      /**
       * Transitions will only apply to objects/uploads in the bucket that start with the
       * given prefix, an empty prefix can be provided to scope rule to all
       * objects/uploads.
       */
      prefix: string;
    }

    /**
     * Transition to abort ongoing multipart uploads.
     */
    export interface AbortMultipartUploadsTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      condition?: AbortMultipartUploadsTransition.Condition;
    }

    export namespace AbortMultipartUploadsTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      export interface Condition {
        maxAge: number;

        type: 'Age';
      }
    }

    /**
     * Transition to delete objects.
     */
    export interface DeleteObjectsTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      condition?:
        | DeleteObjectsTransition.R2LifecycleAgeCondition
        | DeleteObjectsTransition.R2LifecycleDateCondition;
    }

    export namespace DeleteObjectsTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      export interface R2LifecycleAgeCondition {
        maxAge: number;

        type: 'Age';
      }

      /**
       * Condition for lifecycle transitions to apply on a specific date.
       */
      export interface R2LifecycleDateCondition {
        date: string;

        type: 'Date';
      }
    }

    export interface StorageClassTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      condition:
        | StorageClassTransition.R2LifecycleAgeCondition
        | StorageClassTransition.R2LifecycleDateCondition;

      storageClass: 'InfrequentAccess';
    }

    export namespace StorageClassTransition {
      /**
       * Condition for lifecycle transitions to apply after an object reaches an age in
       * seconds.
       */
      export interface R2LifecycleAgeCondition {
        maxAge: number;

        type: 'Age';
      }

      /**
       * Condition for lifecycle transitions to apply on a specific date.
       */
      export interface R2LifecycleDateCondition {
        date: string;

        type: 'Date';
      }
    }
  }
}

export interface LifecycleGetParams {
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

export declare namespace Lifecycle {
  export {
    type LifecycleUpdateResponse as LifecycleUpdateResponse,
    type LifecycleGetResponse as LifecycleGetResponse,
    type LifecycleUpdateParams as LifecycleUpdateParams,
    type LifecycleGetParams as LifecycleGetParams,
  };
}
