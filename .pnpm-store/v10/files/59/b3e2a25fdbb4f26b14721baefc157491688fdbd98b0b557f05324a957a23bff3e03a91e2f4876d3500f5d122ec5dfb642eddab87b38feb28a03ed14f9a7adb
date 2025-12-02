// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Json extends APIResource {
    /**
     * Gets json from a webpage from a provided URL or HTML. Pass `prompt` or `schema`
     * in the body. Control page loading with `gotoOptions` and `waitFor*` options.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/json`, {
            query: { cacheTTL },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=json.mjs.map