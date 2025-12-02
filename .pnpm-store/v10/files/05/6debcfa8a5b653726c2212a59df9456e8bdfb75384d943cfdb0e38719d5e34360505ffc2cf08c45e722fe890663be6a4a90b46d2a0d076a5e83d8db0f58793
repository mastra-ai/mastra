// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Results extends APIResource {
    /**
     * Get the Latest Scan Result
     *
     * @example
     * ```ts
     * const result = await client.cloudforceOne.scans.results.get(
     *   'config_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(configId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/scans/results/${configId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=results.mjs.map