import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as Shared from "../shared.js";
export declare class Subscriptions extends APIResource {
    /**
     * Create a zone subscription, either plan or add-ons.
     *
     * @example
     * ```ts
     * const subscription =
     *   await client.zones.subscriptions.create({
     *     zone_id: '506e3185e9c882d175a2d0cb0093d9f2',
     *   });
     * ```
     */
    create(params: SubscriptionCreateParams, options?: Core.RequestOptions): Core.APIPromise<Shared.Subscription>;
    /**
     * Updates zone subscriptions, either plan or add-ons.
     *
     * @example
     * ```ts
     * const subscription =
     *   await client.zones.subscriptions.update({
     *     zone_id: '506e3185e9c882d175a2d0cb0093d9f2',
     *   });
     * ```
     */
    update(params: SubscriptionUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Shared.Subscription>;
    /**
     * Lists zone subscription details.
     *
     * @example
     * ```ts
     * const subscription = await client.zones.subscriptions.get({
     *   zone_id: '506e3185e9c882d175a2d0cb0093d9f2',
     * });
     * ```
     */
    get(params: SubscriptionGetParams, options?: Core.RequestOptions): Core.APIPromise<Shared.Subscription>;
}
export interface SubscriptionCreateParams {
    /**
     * Path param: Subscription identifier tag.
     */
    zone_id: string;
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
     * Path param: Subscription identifier tag.
     */
    zone_id: string;
    /**
     * Body param: How often the subscription is renewed automatically.
     */
    frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    /**
     * Body param: The rate plan applied to the subscription.
     */
    rate_plan?: Shared.RatePlanParam;
}
export interface SubscriptionGetParams {
    /**
     * Subscription identifier tag.
     */
    zone_id: string;
}
export declare namespace Subscriptions {
    export { type SubscriptionCreateParams as SubscriptionCreateParams, type SubscriptionUpdateParams as SubscriptionUpdateParams, type SubscriptionGetParams as SubscriptionGetParams, };
}
//# sourceMappingURL=subscriptions.d.ts.map