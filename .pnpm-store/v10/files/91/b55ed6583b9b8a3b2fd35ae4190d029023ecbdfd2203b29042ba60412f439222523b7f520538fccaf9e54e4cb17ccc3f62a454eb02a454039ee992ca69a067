// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Snapshot extends APIResource {
    /**
     * Returns the page's HTML content and screenshot. Control page loading with
     * `gotoOptions` and `waitFor*` options. Customize screenshots with `viewport`,
     * `fullPage`, `clip` and others.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/snapshot`, {
            query: { cacheTTL },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=snapshot.mjs.map