import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as Shared from "../shared.js";
import { SubscriptionsSinglePage } from "../shared.js";
export declare class Subscriptions extends APIResource {
    /**
     * Updates a user's subscriptions.
     *
     * @example
     * ```ts
     * const subscription = await client.user.subscriptions.update(
     *   '506e3185e9c882d175a2d0cb0093d9f2',
     * );
     * ```
     */
    update(identifier: string, body: SubscriptionUpdateParams, options?: Core.RequestOptions): Core.APIPromise<SubscriptionUpdateResponse>;
    /**
     * Deletes a user's subscription.
     *
     * @example
     * ```ts
     * const subscription = await client.user.subscriptions.delete(
     *   '506e3185e9c882d175a2d0cb0093d9f2',
     * );
     * ```
     */
    delete(identifier: string, options?: Core.RequestOptions): Core.APIPromise<SubscriptionDeleteResponse>;
    /**
     * Lists all of a user's subscriptions.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const subscription of client.user.subscriptions.get()) {
     *   // ...
     * }
     * ```
     */
    get(options?: Core.RequestOptions): Core.PagePromise<SubscriptionsSinglePage, Shared.Subscription>;
}
export type SubscriptionUpdateResponse = unknown | string | null;
export interface SubscriptionDeleteResponse {
    /**
     * Subscription identifier tag.
     */
    subscription_id?: string;
}
export interface SubscriptionUpdateParams {
    /**
     * How often the subscription is renewed automatically.
     */
    frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    /**
     * The rate plan applied to the subscription.
     */
    rate_plan?: Shared.RatePlanParam;
}
export declare namespace Subscriptions {
    export { type SubscriptionUpdateResponse as SubscriptionUpdateResponse, type SubscriptionDeleteResponse as SubscriptionDeleteResponse, type SubscriptionUpdateParams as SubscriptionUpdateParams, };
}
export { SubscriptionsSinglePage };
//# sourceMappingURL=subscriptions.d.ts.map