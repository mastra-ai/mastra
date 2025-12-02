// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class GatewayCA extends APIResource {
    /**
     * Adds a new SSH Certificate Authority (CA).
     *
     * @example
     * ```ts
     * const gatewayCA =
     *   await client.zeroTrust.access.gatewayCA.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/access/gateway_ca`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists SSH Certificate Authorities (CA).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const gatewayCAListResponse of client.zeroTrust.access.gatewayCA.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/gateway_ca`, GatewayCAListResponsesSinglePage, options);
    }
    /**
     * Deletes an SSH Certificate Authority.
     *
     * @example
     * ```ts
     * const gatewayCA =
     *   await client.zeroTrust.access.gatewayCA.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(certificateId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/access/gateway_ca/${certificateId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class GatewayCAListResponsesSinglePage extends SinglePage {
}
GatewayCA.GatewayCAListResponsesSinglePage = GatewayCAListResponsesSinglePage;
//# sourceMappingURL=gateway-ca.mjs.map