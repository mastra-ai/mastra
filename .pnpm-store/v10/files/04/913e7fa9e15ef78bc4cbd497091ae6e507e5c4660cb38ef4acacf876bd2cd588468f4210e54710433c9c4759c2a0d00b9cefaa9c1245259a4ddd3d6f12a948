import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as Shared from "../../shared.js";
import { SinglePage } from "../../../pagination.js";
export declare class Webhooks extends APIResource {
    /**
     * Creates a new webhook destination.
     *
     * @example
     * ```ts
     * const webhook =
     *   await client.alerting.destinations.webhooks.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'Slack Webhook',
     *     url: 'https://hooks.slack.com/services/Ds3fdBFbV/456464Gdd',
     *   });
     * ```
     */
    create(params: WebhookCreateParams, options?: Core.RequestOptions): Core.APIPromise<WebhookCreateResponse>;
    /**
     * Update a webhook destination.
     *
     * @example
     * ```ts
     * const webhook =
     *   await client.alerting.destinations.webhooks.update(
     *     'b115d5ec-15c6-41ee-8b76-92c449b5227b',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       name: 'Slack Webhook',
     *       url: 'https://hooks.slack.com/services/Ds3fdBFbV/456464Gdd',
     *     },
     *   );
     * ```
     */
    update(webhookId: string, params: WebhookUpdateParams, options?: Core.RequestOptions): Core.APIPromise<WebhookUpdateResponse>;
    /**
     * Gets a list of all configured webhook destinations.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const webhooks of client.alerting.destinations.webhooks.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: WebhookListParams, options?: Core.RequestOptions): Core.PagePromise<WebhooksSinglePage, Webhooks>;
    /**
     * Delete a configured webhook destination.
     *
     * @example
     * ```ts
     * const webhook =
     *   await client.alerting.destinations.webhooks.delete(
     *     'b115d5ec-15c6-41ee-8b76-92c449b5227b',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(webhookId: string, params: WebhookDeleteParams, options?: Core.RequestOptions): Core.APIPromise<WebhookDeleteResponse>;
    /**
     * Get details for a single webhooks destination.
     *
     * @example
     * ```ts
     * const webhooks =
     *   await client.alerting.destinations.webhooks.get(
     *     'b115d5ec-15c6-41ee-8b76-92c449b5227b',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(webhookId: string, params: WebhookGetParams, options?: Core.RequestOptions): Core.APIPromise<Webhooks>;
}
export declare class WebhooksSinglePage extends SinglePage<Webhooks> {
}
export interface Webhooks {
    /**
     * The unique identifier of a webhook
     */
    id?: string;
    /**
     * Timestamp of when the webhook destination was created.
     */
    created_at?: string;
    /**
     * Timestamp of the last time an attempt to dispatch a notification to this webhook
     * failed.
     */
    last_failure?: string;
    /**
     * Timestamp of the last time Cloudflare was able to successfully dispatch a
     * notification using this webhook.
     */
    last_success?: string;
    /**
     * The name of the webhook destination. This will be included in the request body
     * when you receive a webhook notification.
     */
    name?: string;
    /**
     * Type of webhook endpoint.
     */
    type?: 'slack' | 'generic' | 'gchat';
    /**
     * The POST endpoint to call when dispatching a notification.
     */
    url?: string;
}
export interface WebhookCreateResponse {
    /**
     * UUID
     */
    id?: string;
}
export interface WebhookUpdateResponse {
    /**
     * UUID
     */
    id?: string;
}
export interface WebhookDeleteResponse {
    errors: Array<Shared.ResponseInfo>;
    messages: Array<Shared.ResponseInfo>;
    /**
     * Whether the API call was successful
     */
    success: true;
    result_info?: WebhookDeleteResponse.ResultInfo;
}
export declare namespace WebhookDeleteResponse {
    interface ResultInfo {
        /**
         * Total number of results for the requested service
         */
        count?: number;
        /**
         * Current page within paginated list of results
         */
        page?: number;
        /**
         * Number of results per page of results
         */
        per_page?: number;
        /**
         * Total results available without any search parameters
         */
        total_count?: number;
    }
}
export interface WebhookCreateParams {
    /**
     * Path param: The account id
     */
    account_id: string;
    /**
     * Body param: The name of the webhook destination. This will be included in the
     * request body when you receive a webhook notification.
     */
    name: string;
    /**
     * Body param: The POST endpoint to call when dispatching a notification.
     */
    url: string;
    /**
     * Body param: Optional secret that will be passed in the `cf-webhook-auth` header
     * when dispatching generic webhook notifications or formatted for supported
     * destinations. Secrets are not returned in any API response body.
     */
    secret?: string;
}
export interface WebhookUpdateParams {
    /**
     * Path param: The account id
     */
    account_id: string;
    /**
     * Body param: The name of the webhook destination. This will be included in the
     * request body when you receive a webhook notification.
     */
    name: string;
    /**
     * Body param: The POST endpoint to call when dispatching a notification.
     */
    url: string;
    /**
     * Body param: Optional secret that will be passed in the `cf-webhook-auth` header
     * when dispatching generic webhook notifications or formatted for supported
     * destinations. Secrets are not returned in any API response body.
     */
    secret?: string;
}
export interface WebhookListParams {
    /**
     * The account id
     */
    account_id: string;
}
export interface WebhookDeleteParams {
    /**
     * The account id
     */
    account_id: string;
}
export interface WebhookGetParams {
    /**
     * The account id
     */
    account_id: string;
}
export declare namespace Webhooks {
    export { type Webhooks as Webhooks, type WebhookCreateResponse as WebhookCreateResponse, type WebhookUpdateResponse as WebhookUpdateResponse, type WebhookDeleteResponse as WebhookDeleteResponse, WebhooksSinglePage as WebhooksSinglePage, type WebhookCreateParams as WebhookCreateParams, type WebhookUpdateParams as WebhookUpdateParams, type WebhookListParams as WebhookListParams, type WebhookDeleteParams as WebhookDeleteParams, type WebhookGetParams as WebhookGetParams, };
}
//# sourceMappingURL=webhooks.d.ts.map