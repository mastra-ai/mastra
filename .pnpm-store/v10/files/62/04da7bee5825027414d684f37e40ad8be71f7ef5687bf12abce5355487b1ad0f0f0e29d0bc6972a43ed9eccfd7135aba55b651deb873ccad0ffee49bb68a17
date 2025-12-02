// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Traceroutes extends APIResource {
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
export class TraceroutesSinglePage extends SinglePage {
}
Traceroutes.TraceroutesSinglePage = TraceroutesSinglePage;
//# sourceMappingURL=traceroutes.mjs.map