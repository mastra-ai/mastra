// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class PagerdutyResource extends APIResource {
    /**
     * Creates a new token for integrating with PagerDuty.
     *
     * @example
     * ```ts
     * const pagerduty =
     *   await client.alerting.destinations.pagerduty.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/alerting/v3/destinations/pagerduty/connect`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes all the PagerDuty Services connected to the account.
     *
     * @example
     * ```ts
     * const pagerduty =
     *   await client.alerting.destinations.pagerduty.delete({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    delete(params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/alerting/v3/destinations/pagerduty`, options);
    }
    /**
     * Get a list of all configured PagerDuty services.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const pagerduty of client.alerting.destinations.pagerduty.get(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/alerting/v3/destinations/pagerduty`, PagerdutiesSinglePage, options);
    }
    /**
     * Links PagerDuty with the account using the integration token.
     *
     * @example
     * ```ts
     * const response =
     *   await client.alerting.destinations.pagerduty.link(
     *     '8c71e667571b4f61b94d9e4b12158038',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    link(tokenId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/alerting/v3/destinations/pagerduty/connect/${tokenId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class PagerdutiesSinglePage extends SinglePage {
}
PagerdutyResource.PagerdutiesSinglePage = PagerdutiesSinglePage;
//# sourceMappingURL=pagerduty.mjs.map