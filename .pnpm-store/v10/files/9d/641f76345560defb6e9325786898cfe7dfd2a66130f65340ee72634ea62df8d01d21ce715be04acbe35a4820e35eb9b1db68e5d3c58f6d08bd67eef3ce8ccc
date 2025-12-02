// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Authors extends APIResource {
    /**
     * Author Search
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai/authors/search`, AuthorListResponsesSinglePage, options);
    }
}
export class AuthorListResponsesSinglePage extends SinglePage {
}
Authors.AuthorListResponsesSinglePage = AuthorListResponsesSinglePage;
//# sourceMappingURL=authors.mjs.map