"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingHistoriesV4PagePaginationArray = exports.History = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const pagination_1 = require("../../../pagination.js");
class History extends resource_1.APIResource {
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/user/billing/history', BillingHistoriesV4PagePaginationArray, {
            query,
            ...options,
        });
    }
}
exports.History = History;
class BillingHistoriesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.BillingHistoriesV4PagePaginationArray = BillingHistoriesV4PagePaginationArray;
History.BillingHistoriesV4PagePaginationArray = BillingHistoriesV4PagePaginationArray;
//# sourceMappingURL=history.js.map