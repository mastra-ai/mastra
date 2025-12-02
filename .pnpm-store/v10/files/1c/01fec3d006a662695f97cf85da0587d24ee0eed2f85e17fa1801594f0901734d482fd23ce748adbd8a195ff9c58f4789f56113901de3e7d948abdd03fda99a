"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDF = void 0;
const resource_1 = require("../../resource.js");
class PDF extends resource_1.APIResource {
    /**
     * Fetches rendered PDF from provided URL or HTML. Check available options like
     * `gotoOptions` and `waitFor*` to control page load behaviour.
     */
    create(params, options) {
        const { account_id, cacheTTL, ...body } = params;
        return this._client.post(`/accounts/${account_id}/browser-rendering/pdf`, {
            query: { cacheTTL },
            body,
            ...options,
            headers: { Accept: 'application/pdf', ...options?.headers },
            __binaryResponse: true,
        });
    }
}
exports.PDF = PDF;
//# sourceMappingURL=pdf.js.map