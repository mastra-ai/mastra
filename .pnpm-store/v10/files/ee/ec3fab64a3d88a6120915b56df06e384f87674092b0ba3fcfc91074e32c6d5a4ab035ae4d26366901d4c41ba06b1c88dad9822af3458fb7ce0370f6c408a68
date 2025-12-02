// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as CustomCertificateAPI from "./custom-certificate.mjs";
import { CustomCertificate } from "./custom-certificate.mjs";
export class Configurations extends APIResource {
    constructor() {
        super(...arguments);
        this.customCertificate = new CustomCertificateAPI.CustomCertificate(this._client);
    }
    /**
     * Updates the current Zero Trust account configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.zeroTrust.gateway.configurations.update({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/gateway/configuration`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patches the current Zero Trust account configuration. This endpoint can update a
     * single subcollection of settings such as `antivirus`, `tls_decrypt`,
     * `activity_log`, `block_page`, `browser_isolation`, `fips`, `body_scanning`, or
     * `certificate`, without updating the entire configuration object. Returns an
     * error if any collection of settings is not properly configured.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.gateway.configurations.edit({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    edit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/gateway/configuration`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the current Zero Trust account configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.zeroTrust.gateway.configurations.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/gateway/configuration`, options)._thenUnwrap((obj) => obj.result);
    }
}
Configurations.CustomCertificate = CustomCertificate;
//# sourceMappingURL=configurations.mjs.map