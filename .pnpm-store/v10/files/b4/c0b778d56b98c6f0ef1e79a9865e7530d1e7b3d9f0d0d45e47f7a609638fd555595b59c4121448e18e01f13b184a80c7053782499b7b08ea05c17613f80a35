"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceroutesSinglePage = exports.Traceroutes = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Traceroutes extends resource_1.APIResource {
    /**
     * Run traceroutes from Cloudflare colos.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const traceroute of client.diagnostics.traceroutes.create(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     targets: ['203.0.113.1', 'cloudflare.com'],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/diagnostics/traceroute`, TraceroutesSinglePage, {
            body,
            method: 'post',
            ...options,
        });
    }
}
exports.Traceroutes = Traceroutes;
class TraceroutesSinglePage extends pagination_1.SinglePage {
}
exports.TraceroutesSinglePage = TraceroutesSinglePage;
Traceroutes.TraceroutesSinglePage = TraceroutesSinglePage;
//# sourceMappingURL=traceroutes.js.map