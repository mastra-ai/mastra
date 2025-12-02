"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudflareSource = void 0;
const resource_1 = require("../../../../resource.js");
class CloudflareSource extends resource_1.APIResource {
    /**
     * Updates the Cloudflare Source subnet of the given address family
     *
     * @example
     * ```ts
     * const cloudflareSource =
     *   await client.zeroTrust.networks.subnets.cloudflareSource.update(
     *     'v4',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    update(addressFamily, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/zerotrust/subnets/cloudflare_source/${addressFamily}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.CloudflareSource = CloudflareSource;
//# sourceMappingURL=cloudflare-source.js.map