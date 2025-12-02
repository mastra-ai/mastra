"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayloadDeleteResponsesSinglePage = exports.PayloadListResponsesSinglePage = exports.PayloadCreateResponsesSinglePage = exports.Payloads = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Payloads extends resource_1.APIResource {
    /**
     * Add custom scan expressions for Content Scanning.
     */
    create(params, options) {
        const { zone_id, body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/content-upload-scan/payloads`, PayloadCreateResponsesSinglePage, { body: body, method: 'post', ...options });
    }
    /**
     * Get a list of existing custom scan expressions for Content Scanning.
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/content-upload-scan/payloads`, PayloadListResponsesSinglePage, options);
    }
    /**
     * Delete a Content Scan Custom Expression.
     */
    delete(expressionId, params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/content-upload-scan/payloads/${expressionId}`, PayloadDeleteResponsesSinglePage, { method: 'delete', ...options });
    }
}
exports.Payloads = Payloads;
class PayloadCreateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.PayloadCreateResponsesSinglePage = PayloadCreateResponsesSinglePage;
class PayloadListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.PayloadListResponsesSinglePage = PayloadListResponsesSinglePage;
class PayloadDeleteResponsesSinglePage extends pagination_1.SinglePage {
}
exports.PayloadDeleteResponsesSinglePage = PayloadDeleteResponsesSinglePage;
Payloads.PayloadCreateResponsesSinglePage = PayloadCreateResponsesSinglePage;
Payloads.PayloadListResponsesSinglePage = PayloadListResponsesSinglePage;
Payloads.PayloadDeleteResponsesSinglePage = PayloadDeleteResponsesSinglePage;
//# sourceMappingURL=payloads.js.map