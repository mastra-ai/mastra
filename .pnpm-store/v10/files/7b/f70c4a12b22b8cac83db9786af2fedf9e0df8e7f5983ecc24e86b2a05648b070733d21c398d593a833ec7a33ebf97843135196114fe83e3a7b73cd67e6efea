// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class AvailableAlerts extends APIResource {
    /**
     * Gets a list of all alert types for which an account is eligible.
     *
     * @example
     * ```ts
     * const availableAlerts =
     *   await client.alerting.availableAlerts.list({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/alerting/v3/available_alerts`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=available-alerts.mjs.map