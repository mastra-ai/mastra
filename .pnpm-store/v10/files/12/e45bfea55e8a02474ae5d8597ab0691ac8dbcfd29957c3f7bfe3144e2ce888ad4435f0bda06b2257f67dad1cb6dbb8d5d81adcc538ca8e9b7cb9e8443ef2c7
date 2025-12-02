// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Payloads extends APIResource {
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
export class PayloadCreateResponsesSinglePage extends SinglePage {
}
export class PayloadListResponsesSinglePage extends SinglePage {
}
export class PayloadDeleteResponsesSinglePage extends SinglePage {
}
Payloads.PayloadCreateResponsesSinglePage = PayloadCreateResponsesSinglePage;
Payloads.PayloadListResponsesSinglePage = PayloadListResponsesSinglePage;
Payloads.PayloadDeleteResponsesSinglePage = PayloadDeleteResponsesSinglePage;
//# sourceMappingURL=payloads.mjs.map