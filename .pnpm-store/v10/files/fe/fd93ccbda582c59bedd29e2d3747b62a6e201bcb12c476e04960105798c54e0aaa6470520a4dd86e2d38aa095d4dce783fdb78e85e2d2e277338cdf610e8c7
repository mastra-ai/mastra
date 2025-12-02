"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Unrevoke = void 0;
const resource_1 = require("../../../resource.js");
class Unrevoke extends resource_1.APIResource {
    /**
     * Unrevokes a list of devices. Not supported when
     * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
     * is enabled.
     *
     * **Deprecated**: please use POST
     * /accounts/{account_id}/devices/registrations/unrevoke instead.
     *
     * @deprecated
     */
    create(params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/devices/unrevoke`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Unrevoke = Unrevoke;
//# sourceMappingURL=unrevoke.js.map