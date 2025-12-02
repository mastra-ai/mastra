// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class PayloadLogs extends APIResource {
    /**
     * Set payload log settings
     *
     * @example
     * ```ts
     * const payloadLog =
     *   await client.zeroTrust.dlp.payloadLogs.update({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/dlp/payload_log`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get payload log settings
     *
     * @example
     * ```ts
     * const payloadLog =
     *   await client.zeroTrust.dlp.payloadLogs.get({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dlp/payload_log`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=payload-logs.mjs.map