import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as Shared from "../shared.js";
import { SubscriptionsSinglePage } from "../shared.js";
export declare class Subscriptions extends APIResource {
    /**
     * Creates an account subscription.
     *
     * @example
     * ```ts
     * const subscription =
     *   await client.accounts.subscriptions.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params: SubscriptionCreateParams, options?: Core.RequestOptions): Core.APIPromise<Shared.Subscription>;
    /**
     * Updates an account subscription.
     *
     * @example
     * ```ts
     * const subscription =
     *   await client.accounts.subscriptions.update(
     *     '506e3185e9c882d175a2d0cb0093d9f2',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(subscriptionIdentifier: string, params: SubscriptionUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Shared.Subscription>;
    /**
     * Deletes an account's subscription.
     *
     * @example
     * ```ts
     * const subscription =
     *   await client.accounts.subscriptions.delete(
     *     '506e3185e9c882d175a2d0cb0093d9f2',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(subscriptionIdentifier: string, params: SubscriptionDeleteParams, options?: Core.RequestOptions): Core.APIPromise<SubscriptionDeleteResponse>;
    /**
     * Lists all of an account's subscriptions.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const subscription of client.accounts.subscriptions.get(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params: SubscriptionGetParams, options?: Core.RequestOptions): Core.PagePromise<SubscriptionsSinglePage, Shared.Subscription>;
}
export interface SubscriptionDeleteResponse {
    /**
     * Subscription identifier tag.
     */
    subscription_id?: string;
}
export interface SubscriptionCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: How often the subscription is renewed automatically.
     */
    frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    /**
     * Body param: The rate plan applied to the subscription.
     */
    rate_plan?: Shared.RatePlanParam;
}
export interface SubscriptionUpdateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: How often the subscription is renewed automatically.
     */
    frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    /**
     * Body param: The rate plan applied to the subscription.
     */
    rate_plan?: Shared.RatePlanParam;
}
export interface SubscriptionDeleteParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface SubscriptionGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace Subscriptions {
    export { type SubscriptionDeleteResponse as SubscriptionDeleteResponse, type SubscriptionCreateParams as SubscriptionCreateParams, type SubscriptionUpdateParams as SubscriptionUpdateParams, type SubscriptionDeleteParams as SubscriptionDeleteParams, type SubscriptionGetParams as SubscriptionGetParams, };
}
export { SubscriptionsSinglePage };
//# sourceMappingURL=subscriptions.d.ts.map