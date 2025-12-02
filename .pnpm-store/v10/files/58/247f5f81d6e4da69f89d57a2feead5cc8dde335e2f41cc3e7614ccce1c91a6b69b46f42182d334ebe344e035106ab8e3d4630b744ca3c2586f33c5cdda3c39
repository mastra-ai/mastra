import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Lifecycle extends APIResource {
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
    update(bucketName: string, params: LifecycleUpdateParams, options?: Core.RequestOptions): Core.APIPromise<LifecycleUpdateResponse>;
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
    get(bucketName: string, params: LifecycleGetParams, options?: Core.RequestOptions): Core.APIPromise<LifecycleGetResponse>;
}
export type LifecycleUpdateResponse = unknown;
export interface LifecycleGetResponse {
    rules?: Array<LifecycleGetResponse.Rule>;
}
export declare namespace LifecycleGetResponse {
    interface Rule {
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
    namespace Rule {
        /**
         * Conditions that apply to all transitions of this rule.
         */
        interface Conditions {
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
        interface AbortMultipartUploadsTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            condition?: AbortMultipartUploadsTransition.Condition;
        }
        namespace AbortMultipartUploadsTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            interface Condition {
                maxAge: number;
                type: 'Age';
            }
        }
        /**
         * Transition to delete objects.
         */
        interface DeleteObjectsTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            condition?: DeleteObjectsTransition.R2LifecycleAgeCondition | DeleteObjectsTransition.R2LifecycleDateCondition;
        }
        namespace DeleteObjectsTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            interface R2LifecycleAgeCondition {
                maxAge: number;
                type: 'Age';
            }
            /**
             * Condition for lifecycle transitions to apply on a specific date.
             */
            interface R2LifecycleDateCondition {
                date: string;
                type: 'Date';
            }
        }
        interface StorageClassTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            condition: StorageClassTransition.R2LifecycleAgeCondition | StorageClassTransition.R2LifecycleDateCondition;
            storageClass: 'InfrequentAccess';
        }
        namespace StorageClassTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            interface R2LifecycleAgeCondition {
                maxAge: number;
                type: 'Age';
            }
            /**
             * Condition for lifecycle transitions to apply on a specific date.
             */
            interface R2LifecycleDateCondition {
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
export declare namespace LifecycleUpdateParams {
    interface Rule {
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
    namespace Rule {
        /**
         * Conditions that apply to all transitions of this rule.
         */
        interface Conditions {
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
        interface AbortMultipartUploadsTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            condition?: AbortMultipartUploadsTransition.Condition;
        }
        namespace AbortMultipartUploadsTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            interface Condition {
                maxAge: number;
                type: 'Age';
            }
        }
        /**
         * Transition to delete objects.
         */
        interface DeleteObjectsTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            condition?: DeleteObjectsTransition.R2LifecycleAgeCondition | DeleteObjectsTransition.R2LifecycleDateCondition;
        }
        namespace DeleteObjectsTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            interface R2LifecycleAgeCondition {
                maxAge: number;
                type: 'Age';
            }
            /**
             * Condition for lifecycle transitions to apply on a specific date.
             */
            interface R2LifecycleDateCondition {
                date: string;
                type: 'Date';
            }
        }
        interface StorageClassTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            condition: StorageClassTransition.R2LifecycleAgeCondition | StorageClassTransition.R2LifecycleDateCondition;
            storageClass: 'InfrequentAccess';
        }
        namespace StorageClassTransition {
            /**
             * Condition for lifecycle transitions to apply after an object reaches an age in
             * seconds.
             */
            interface R2LifecycleAgeCondition {
                maxAge: number;
                type: 'Age';
            }
            /**
             * Condition for lifecycle transitions to apply on a specific date.
             */
            interface R2LifecycleDateCondition {
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
    export { type LifecycleUpdateResponse as LifecycleUpdateResponse, type LifecycleGetResponse as LifecycleGetResponse, type LifecycleUpdateParams as LifecycleUpdateParams, type LifecycleGetParams as LifecycleGetParams, };
}
//# sourceMappingURL=lifecycle.d.ts.map