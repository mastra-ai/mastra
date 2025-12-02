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
exports.Account = void 0;
const resource_1 = require("../../../../resource.js");
const ViewsAPI = __importStar(require("./views.js"));
const views_1 = require("./views.js");
class Account extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.views = new ViewsAPI.Views(this._client);
    }
    /**
     * Update DNS settings for an account
     *
     * @example
     * ```ts
     * const response = await client.dns.settings.account.edit({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    edit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/dns_settings`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Show DNS settings for an account
     *
     * @example
     * ```ts
     * const account = await client.dns.settings.account.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dns_settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Account = Account;
Account.Views = views_1.Views;
Account.ViewListResponsesV4PagePaginationArray = views_1.ViewListResponsesV4PagePaginationArray;
//# sourceMappingURL=account.js.map