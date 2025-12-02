// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as CustomAPI from "./custom.mjs";
import { Custom, } from "./custom.mjs";
import * as IntegrationAPI from "./integration.mjs";
import { Integration, } from "./integration.mjs";
import * as PredefinedAPI from "./predefined.mjs";
import { Predefined, } from "./predefined.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Entries extends APIResource {
    constructor() {
        super(...arguments);
        this.custom = new CustomAPI.Custom(this._client);
        this.predefined = new PredefinedAPI.Predefined(this._client);
        this.integration = new IntegrationAPI.Integration(this._client);
    }
    /**
     * Creates a DLP custom entry.
     *
     * @example
     * ```ts
     * const entry = await client.zeroTrust.dlp.entries.create({
     *   account_id: 'account_id',
     *   enabled: true,
     *   name: 'name',
     *   pattern: { regex: 'regex' },
     *   profile_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/entries`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a DLP entry.
     *
     * @example
     * ```ts
     * const entry = await client.zeroTrust.dlp.entries.update(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   {
     *     account_id: 'account_id',
     *     name: 'name',
     *     pattern: { regex: 'regex' },
     *     type: 'custom',
     *   },
     * );
     * ```
     */
    update(entryId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/dlp/entries/${entryId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all DLP entries in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const entryListResponse of client.zeroTrust.dlp.entries.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dlp/entries`, EntryListResponsesSinglePage, options);
    }
    /**
     * Deletes a DLP custom entry.
     *
     * @example
     * ```ts
     * const entry = await client.zeroTrust.dlp.entries.delete(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    delete(entryId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/dlp/entries/${entryId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a DLP entry by ID.
     *
     * @example
     * ```ts
     * const entry = await client.zeroTrust.dlp.entries.get(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(entryId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dlp/entries/${entryId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class EntryListResponsesSinglePage extends SinglePage {
}
Entries.EntryListResponsesSinglePage = EntryListResponsesSinglePage;
Entries.Custom = Custom;
Entries.Predefined = Predefined;
Entries.Integration = Integration;
//# sourceMappingURL=entries.mjs.map