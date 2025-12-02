"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreListResponsesV4PagePaginationArray = exports.StoreCreateResponsesSinglePage = exports.Stores = void 0;
const resource_1 = require("../../../resource.js");
const SecretsAPI = __importStar(require("./secrets.js"));
const secrets_1 = require("./secrets.js");
const pagination_1 = require("../../../pagination.js");
class Stores extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.secrets = new SecretsAPI.Secrets(this._client);
    }
    /**
     * Creates a store in the account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const storeCreateResponse of client.secretsStore.stores.create(
     *   {
     *     account_id: '985e105f4ecef8ad9ca31a8372d0c353',
     *     body: [{ name: 'service_x_keys' }],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/secrets_store/stores`, StoreCreateResponsesSinglePage, { body: body, method: 'post', ...options });
    }
    /**
     * Lists all the stores in an account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const storeListResponse of client.secretsStore.stores.list(
     *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/secrets_store/stores`, StoreListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes a single store
     *
     * @example
     * ```ts
     * const store = await client.secretsStore.stores.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '985e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(storeId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/secrets_store/stores/${storeId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Stores = Stores;
class StoreCreateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.StoreCreateResponsesSinglePage = StoreCreateResponsesSinglePage;
class StoreListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.StoreListResponsesV4PagePaginationArray = StoreListResponsesV4PagePaginationArray;
Stores.StoreCreateResponsesSinglePage = StoreCreateResponsesSinglePage;
Stores.StoreListResponsesV4PagePaginationArray = StoreListResponsesV4PagePaginationArray;
Stores.Secrets = secrets_1.Secrets;
Stores.SecretCreateResponsesSinglePage = secrets_1.SecretCreateResponsesSinglePage;
Stores.SecretListResponsesV4PagePaginationArray = secrets_1.SecretListResponsesV4PagePaginationArray;
Stores.SecretBulkDeleteResponsesSinglePage = secrets_1.SecretBulkDeleteResponsesSinglePage;
//# sourceMappingURL=stores.js.map