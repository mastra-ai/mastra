// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Public extends APIResource {
    /**
     * List Public Finetunes
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai/finetunes/public`, PublicListResponsesSinglePage, { query, ...options });
    }
}
export class PublicListResponsesSinglePage extends SinglePage {
}
Public.PublicListResponsesSinglePage = PublicListResponsesSinglePage;
//# sourceMappingURL=public.mjs.map