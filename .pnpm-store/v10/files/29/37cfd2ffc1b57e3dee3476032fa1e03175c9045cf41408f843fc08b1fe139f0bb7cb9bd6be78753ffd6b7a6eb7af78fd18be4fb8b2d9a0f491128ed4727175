// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class History extends APIResource {
    list(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/user/billing/history', BillingHistoriesV4PagePaginationArray, {
            query,
            ...options,
        });
    }
}
export class BillingHistoriesV4PagePaginationArray extends V4PagePaginationArray {
}
History.BillingHistoriesV4PagePaginationArray = BillingHistoriesV4PagePaginationArray;
//# sourceMappingURL=history.mjs.map