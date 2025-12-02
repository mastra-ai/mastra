// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Webhooks extends APIResource {
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
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/alerting/v3/destinations/webhooks`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    update(webhookId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/alerting/v3/destinations/webhooks/${webhookId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/alerting/v3/destinations/webhooks`, WebhooksSinglePage, options);
    }
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
    delete(webhookId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/alerting/v3/destinations/webhooks/${webhookId}`, options);
    }
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
    get(webhookId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/alerting/v3/destinations/webhooks/${webhookId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class WebhooksSinglePage extends SinglePage {
}
Webhooks.WebhooksSinglePage = WebhooksSinglePage;
//# sourceMappingURL=webhooks.mjs.map