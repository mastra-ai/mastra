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
exports.VersionListResponsesV4PagePagination = exports.Versions = void 0;
const resource_1 = require("../../../resource.js");
const Core = __importStar(require("../../../core.js"));
const pagination_1 = require("../../../pagination.js");
class Versions extends resource_1.APIResource {
    /**
     * Upload a Worker Version without deploying to Cloudflare's network. You can find
     * more about the multipart metadata on our docs:
     * https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/.
     *
     * @example
     * ```ts
     * const version =
     *   await client.workers.scripts.versions.create(
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       metadata: { main_module: 'worker.js' },
     *     },
     *   );
     * ```
     */
    create(scriptName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/workers/scripts/${scriptName}/versions`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * List of Worker Versions. The first version in the list is the latest version.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const versionListResponse of client.workers.scripts.versions.list(
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(scriptName, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/scripts/${scriptName}/versions`, VersionListResponsesV4PagePagination, { query, ...options });
    }
    /**
     * Get Version Detail
     *
     * @example
     * ```ts
     * const version = await client.workers.scripts.versions.get(
     *   'this-is_my_script-01',
     *   'bcf48806-b317-4351-9ee7-36e7d557d4de',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(scriptName, versionId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}/versions/${versionId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Versions = Versions;
class VersionListResponsesV4PagePagination extends pagination_1.V4PagePagination {
}
exports.VersionListResponsesV4PagePagination = VersionListResponsesV4PagePagination;
Versions.VersionListResponsesV4PagePagination = VersionListResponsesV4PagePagination;
//# sourceMappingURL=versions.js.map