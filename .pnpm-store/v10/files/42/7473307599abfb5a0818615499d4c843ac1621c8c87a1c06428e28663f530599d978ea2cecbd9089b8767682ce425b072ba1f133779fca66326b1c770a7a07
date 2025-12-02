// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as ObjectsAPI from "./objects.mjs";
import { DurableObjectsCursorLimitPagination, Objects } from "./objects.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Namespaces extends APIResource {
    constructor() {
        super(...arguments);
        this.objects = new ObjectsAPI.Objects(this._client);
    }
    /**
     * Returns the Durable Object namespaces owned by an account.
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/durable_objects/namespaces`, NamespacesSinglePage, options);
    }
}
export class NamespacesSinglePage extends SinglePage {
}
Namespaces.NamespacesSinglePage = NamespacesSinglePage;
Namespaces.Objects = Objects;
Namespaces.DurableObjectsCursorLimitPagination = DurableObjectsCursorLimitPagination;
//# sourceMappingURL=namespaces.mjs.map