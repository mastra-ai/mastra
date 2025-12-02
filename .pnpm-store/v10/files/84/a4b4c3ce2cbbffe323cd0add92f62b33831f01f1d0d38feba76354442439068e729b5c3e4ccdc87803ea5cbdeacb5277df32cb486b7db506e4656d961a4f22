// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as SchemaAPI from "./schema.mjs";
import { Schema } from "./schema.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class Models extends APIResource {
    constructor() {
        super(...arguments);
        this.schema = new SchemaAPI.Schema(this._client);
    }
    /**
     * Model Search
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai/models/search`, ModelListResponsesV4PagePaginationArray, { query, ...options });
    }
}
export class ModelListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Models.ModelListResponsesV4PagePaginationArray = ModelListResponsesV4PagePaginationArray;
Models.Schema = Schema;
//# sourceMappingURL=models.mjs.map