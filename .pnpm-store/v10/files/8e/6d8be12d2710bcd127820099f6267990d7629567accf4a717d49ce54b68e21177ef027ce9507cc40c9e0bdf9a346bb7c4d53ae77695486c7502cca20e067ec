import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Locks extends APIResource {
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
    update(bucketName: string, params: LockUpdateParams, options?: Core.RequestOptions): Core.APIPromise<LockUpdateResponse>;
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
    get(bucketName: string, params: LockGetParams, options?: Core.RequestOptions): Core.APIPromise<LockGetResponse>;
}
export type LockUpdateResponse = unknown;
export interface LockGetResponse {
    rules?: Array<LockGetResponse.Rule>;
}
export declare namespace LockGetResponse {
    interface Rule {
        /**
         * Unique identifier for this rule.
         */
        id: string;
        /**
         * Condition to apply a lock rule to an object for how long in seconds.
         */
        condition: Rule.R2LockRuleAgeCondition | Rule.R2LockRuleDateCondition | Rule.R2LockRuleIndefiniteCondition;
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
    namespace Rule {
        /**
         * Condition to apply a lock rule to an object for how long in seconds.
         */
        interface R2LockRuleAgeCondition {
            maxAgeSeconds: number;
            type: 'Age';
        }
        /**
         * Condition to apply a lock rule to an object until a specific date.
         */
        interface R2LockRuleDateCondition {
            date: string;
            type: 'Date';
        }
        /**
         * Condition to apply a lock rule indefinitely.
         */
        interface R2LockRuleIndefiniteCondition {
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
export declare namespace LockUpdateParams {
    interface Rule {
        /**
         * Unique identifier for this rule.
         */
        id: string;
        /**
         * Condition to apply a lock rule to an object for how long in seconds.
         */
        condition: Rule.R2LockRuleAgeCondition | Rule.R2LockRuleDateCondition | Rule.R2LockRuleIndefiniteCondition;
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
    namespace Rule {
        /**
         * Condition to apply a lock rule to an object for how long in seconds.
         */
        interface R2LockRuleAgeCondition {
            maxAgeSeconds: number;
            type: 'Age';
        }
        /**
         * Condition to apply a lock rule to an object until a specific date.
         */
        interface R2LockRuleDateCondition {
            date: string;
            type: 'Date';
        }
        /**
         * Condition to apply a lock rule indefinitely.
         */
        interface R2LockRuleIndefiniteCondition {
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
    export { type LockUpdateResponse as LockUpdateResponse, type LockGetResponse as LockGetResponse, type LockUpdateParams as LockUpdateParams, type LockGetParams as LockGetParams, };
}
//# sourceMappingURL=locks.d.ts.map