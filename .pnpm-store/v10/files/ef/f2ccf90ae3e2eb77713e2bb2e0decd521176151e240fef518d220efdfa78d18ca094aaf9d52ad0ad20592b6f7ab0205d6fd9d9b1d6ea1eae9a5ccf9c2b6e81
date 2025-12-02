// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { CursorLimitPagination } from "../../../pagination.mjs";
export class Objects extends APIResource {
    /**
     * Returns the Durable Objects in a given namespace.
     */
    list(id, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/durable_objects/namespaces/${id}/objects`, DurableObjectsCursorLimitPagination, { query, ...options });
    }
}
export class DurableObjectsCursorLimitPagination extends CursorLimitPagination {
}
Objects.DurableObjectsCursorLimitPagination = DurableObjectsCursorLimitPagination;
//# sourceMappingURL=objects.mjs.map