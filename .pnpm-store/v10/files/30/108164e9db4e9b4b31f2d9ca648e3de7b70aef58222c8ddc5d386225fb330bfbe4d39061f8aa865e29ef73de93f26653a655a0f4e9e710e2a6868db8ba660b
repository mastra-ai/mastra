// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Webhooks extends APIResource {
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
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/stream/webhook`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
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
    delete(params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/stream/webhook`, options)._thenUnwrap((obj) => obj.result);
    }
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
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/stream/webhook`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=webhooks.mjs.map