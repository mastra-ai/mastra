// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Screenshot extends APIResource {
    /**
     * Takes a screenshot of a webpage from provided URL or HTML. Control page loading
     * with `gotoOptions` and `waitFor*` options. Customize screenshots with
     * `viewport`, `fullPage`, `clip` and others.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/screenshot`, {
            query: { cacheTTL },
            body,
            ...options,
        });
    }
}
//# sourceMappingURL=screenshot.mjs.map