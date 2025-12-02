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
exports.EntryListResponsesSinglePage = exports.Entries = void 0;
const resource_1 = require("../../../../resource.js");
const CustomAPI = __importStar(require("./custom.js"));
const custom_1 = require("./custom.js");
const IntegrationAPI = __importStar(require("./integration.js"));
const integration_1 = require("./integration.js");
const PredefinedAPI = __importStar(require("./predefined.js"));
const predefined_1 = require("./predefined.js");
const pagination_1 = require("../../../../pagination.js");
class Entries extends resource_1.APIResource {
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
exports.Entries = Entries;
class EntryListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.EntryListResponsesSinglePage = EntryListResponsesSinglePage;
Entries.EntryListResponsesSinglePage = EntryListResponsesSinglePage;
Entries.Custom = custom_1.Custom;
Entries.Predefined = predefined_1.Predefined;
Entries.Integration = integration_1.Integration;
//# sourceMappingURL=entries.js.map