// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class UniqueDevices extends APIResource {
    /**
     * Returns unique count of devices that have run synthetic application monitoring
     * tests in the past 7 days.
     *
     * @example
     * ```ts
     * const uniqueDevices =
     *   await client.zeroTrust.dex.tests.uniqueDevices.list({
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dex/tests/unique-devices`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=unique-devices.mjs.map