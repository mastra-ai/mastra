// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Unrevoke extends APIResource {
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
//# sourceMappingURL=unrevoke.mjs.map