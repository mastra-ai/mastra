// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as SecretsAPI from "./secrets.mjs";
import { SecretBulkDeleteResponsesSinglePage, SecretCreateResponsesSinglePage, SecretListResponsesV4PagePaginationArray, Secrets, } from "./secrets.mjs";
import { SinglePage, V4PagePaginationArray } from "../../../pagination.mjs";
export class Stores extends APIResource {
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
export class StoreCreateResponsesSinglePage extends SinglePage {
}
export class StoreListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Stores.StoreCreateResponsesSinglePage = StoreCreateResponsesSinglePage;
Stores.StoreListResponsesV4PagePaginationArray = StoreListResponsesV4PagePaginationArray;
Stores.Secrets = Secrets;
Stores.SecretCreateResponsesSinglePage = SecretCreateResponsesSinglePage;
Stores.SecretListResponsesV4PagePaginationArray = SecretListResponsesV4PagePaginationArray;
Stores.SecretBulkDeleteResponsesSinglePage = SecretBulkDeleteResponsesSinglePage;
//# sourceMappingURL=stores.mjs.map