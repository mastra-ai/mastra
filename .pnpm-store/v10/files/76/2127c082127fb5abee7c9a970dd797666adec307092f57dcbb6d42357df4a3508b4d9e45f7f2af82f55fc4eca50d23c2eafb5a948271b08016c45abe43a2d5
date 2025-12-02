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
exports.ProfilesSinglePage = exports.Profiles = void 0;
const resource_1 = require("../../../../resource.js");
const CustomAPI = __importStar(require("./custom.js"));
const custom_1 = require("./custom.js");
const PredefinedAPI = __importStar(require("./predefined.js"));
const predefined_1 = require("./predefined.js");
const pagination_1 = require("../../../../pagination.js");
class Profiles extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.custom = new CustomAPI.Custom(this._client);
        this.predefined = new PredefinedAPI.Predefined(this._client);
    }
    /**
     * Lists all DLP profiles in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const profile of client.zeroTrust.dlp.profiles.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dlp/profiles`, ProfilesSinglePage, {
            query,
            ...options,
        });
    }
    /**
     * Fetches a DLP profile by ID.
     *
     * @example
     * ```ts
     * const profile = await client.zeroTrust.dlp.profiles.get(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(profileId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dlp/profiles/${profileId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Profiles = Profiles;
class ProfilesSinglePage extends pagination_1.SinglePage {
}
exports.ProfilesSinglePage = ProfilesSinglePage;
Profiles.ProfilesSinglePage = ProfilesSinglePage;
Profiles.Custom = custom_1.Custom;
Profiles.Predefined = predefined_1.Predefined;
//# sourceMappingURL=profiles.js.map