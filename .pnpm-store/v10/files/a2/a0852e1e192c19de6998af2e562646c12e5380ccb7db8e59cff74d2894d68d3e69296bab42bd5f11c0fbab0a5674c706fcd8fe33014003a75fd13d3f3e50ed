import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Webhooks extends APIResource {
    /**
     * Creates a webhook notification.
     *
     * @example
     * ```ts
     * const webhook = await client.stream.webhooks.update({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   notificationUrl: 'https://example.com',
     * });
     * ```
     */
    update(params: WebhookUpdateParams, options?: Core.RequestOptions): Core.APIPromise<WebhookUpdateResponse>;
    /**
     * Deletes a webhook.
     *
     * @example
     * ```ts
     * const webhook = await client.stream.webhooks.delete({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(params: WebhookDeleteParams, options?: Core.RequestOptions): Core.APIPromise<WebhookDeleteResponse>;
    /**
     * Retrieves a list of webhooks.
     *
     * @example
     * ```ts
     * const webhook = await client.stream.webhooks.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: WebhookGetParams, options?: Core.RequestOptions): Core.APIPromise<WebhookGetResponse>;
}
export type WebhookUpdateResponse = unknown;
export type WebhookDeleteResponse = string;
export type WebhookGetResponse = unknown;
export interface WebhookUpdateParams {
    /**
     * Path param: The account identifier tag.
     */
    account_id: string;
    /**
     * Body param: The URL where webhooks will be sent.
     */
    notificationUrl: string;
}
export interface WebhookDeleteParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export interface WebhookGetParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export declare namespace Webhooks {
    export { type WebhookUpdateResponse as WebhookUpdateResponse, type WebhookDeleteResponse as WebhookDeleteResponse, type WebhookGetResponse as WebhookGetResponse, type WebhookUpdateParams as WebhookUpdateParams, type WebhookDeleteParams as WebhookDeleteParams, type WebhookGetParams as WebhookGetParams, };
}
//# sourceMappingURL=webhooks.d.ts.map