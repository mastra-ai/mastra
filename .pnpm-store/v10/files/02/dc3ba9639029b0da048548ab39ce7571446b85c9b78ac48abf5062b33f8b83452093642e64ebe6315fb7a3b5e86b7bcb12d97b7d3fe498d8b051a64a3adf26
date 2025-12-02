"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DurableObjectsCursorLimitPagination = exports.Objects = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Objects extends resource_1.APIResource {
    /**
     * Returns the Durable Objects in a given namespace.
     */
    list(id, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/durable_objects/namespaces/${id}/objects`, DurableObjectsCursorLimitPagination, { query, ...options });
    }
}
exports.Objects = Objects;
class DurableObjectsCursorLimitPagination extends pagination_1.CursorLimitPagination {
}
exports.DurableObjectsCursorLimitPagination = DurableObjectsCursorLimitPagination;
Objects.DurableObjectsCursorLimitPagination = DurableObjectsCursorLimitPagination;
//# sourceMappingURL=objects.js.map