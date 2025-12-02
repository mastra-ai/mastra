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
exports.VersionCreateResponsesSinglePage = exports.Versions = void 0;
const resource_1 = require("../../../../../resource.js");
const EntriesAPI = __importStar(require("./entries.js"));
const entries_1 = require("./entries.js");
const pagination_1 = require("../../../../../pagination.js");
class Versions extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.entries = new EntriesAPI.Entries(this._client);
    }
    /**
     * This is used for multi-column EDMv2 datasets. The EDMv2 format can only be
     * created in the Cloudflare dashboard. The columns in the response appear in the
     * same order as in the request.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const versionCreateResponse of client.zeroTrust.dlp.datasets.versions.create(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   0,
     *   {
     *     account_id: 'account_id',
     *     body: [
     *       { entry_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
     *     ],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(datasetId, version, params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dlp/datasets/${datasetId}/versions/${version}`, VersionCreateResponsesSinglePage, { body: body, method: 'post', ...options });
    }
}
exports.Versions = Versions;
class VersionCreateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.VersionCreateResponsesSinglePage = VersionCreateResponsesSinglePage;
Versions.VersionCreateResponsesSinglePage = VersionCreateResponsesSinglePage;
Versions.Entries = entries_1.Entries;
//# sourceMappingURL=versions.js.map