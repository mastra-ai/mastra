"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.WidgetListResponsesV4PagePaginationArray = exports.Widgets = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Widgets extends resource_1.APIResource {
    /**
     * Lists challenge widgets.
     *
     * @example
     * ```ts
     * const widget = await client.turnstile.widgets.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   domains: [
     *     '203.0.113.1',
     *     'cloudflare.com',
     *     'blog.example.com',
     *   ],
     *   mode: 'invisible',
     *   name: 'blog.cloudflare.com login form',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, direction, order, page, per_page, ...body } = params;
        return this._client.post(`/accounts/${account_id}/challenges/widgets`, {
            query: { direction, order, page, per_page },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update the configuration of a widget.
     *
     * @example
     * ```ts
     * const widget = await client.turnstile.widgets.update(
     *   '0x4AAF00AAAABn0R22HWm-YUc',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     domains: [
     *       '203.0.113.1',
     *       'cloudflare.com',
     *       'blog.example.com',
     *     ],
     *     mode: 'invisible',
     *     name: 'blog.cloudflare.com login form',
     *   },
     * );
     * ```
     */
    update(sitekey, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/challenges/widgets/${sitekey}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all turnstile widgets of an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const widgetListResponse of client.turnstile.widgets.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/challenges/widgets`, WidgetListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Destroy a Turnstile Widget.
     *
     * @example
     * ```ts
     * const widget = await client.turnstile.widgets.delete(
     *   '0x4AAF00AAAABn0R22HWm-YUc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(sitekey, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/challenges/widgets/${sitekey}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Show a single challenge widget configuration.
     *
     * @example
     * ```ts
     * const widget = await client.turnstile.widgets.get(
     *   '0x4AAF00AAAABn0R22HWm-YUc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(sitekey, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/challenges/widgets/${sitekey}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Generate a new secret key for this widget. If `invalidate_immediately` is set to
     * `false`, the previous secret remains valid for 2 hours.
     *
     * Note that secrets cannot be rotated again during the grace period.
     *
     * @example
     * ```ts
     * const widget = await client.turnstile.widgets.rotateSecret(
     *   '0x4AAF00AAAABn0R22HWm-YUc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    rotateSecret(sitekey, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/challenges/widgets/${sitekey}/rotate_secret`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Widgets = Widgets;
class WidgetListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.WidgetListResponsesV4PagePaginationArray = WidgetListResponsesV4PagePaginationArray;
Widgets.WidgetListResponsesV4PagePaginationArray = WidgetListResponsesV4PagePaginationArray;
//# sourceMappingURL=widgets.js.map