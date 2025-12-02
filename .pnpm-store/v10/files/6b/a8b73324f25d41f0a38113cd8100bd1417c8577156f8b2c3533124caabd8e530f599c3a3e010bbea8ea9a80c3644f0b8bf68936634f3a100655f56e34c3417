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
exports.Scripts = void 0;
const resource_1 = require("../../../../../resource.js");
const Core = __importStar(require("../../../../../core.js"));
const AssetUploadAPI = __importStar(require("./asset-upload.js"));
const asset_upload_1 = require("./asset-upload.js");
const BindingsAPI = __importStar(require("./bindings.js"));
const bindings_1 = require("./bindings.js");
const ContentAPI = __importStar(require("./content.js"));
const content_1 = require("./content.js");
const SecretsAPI = __importStar(require("./secrets.js"));
const secrets_1 = require("./secrets.js");
const SettingsAPI = __importStar(require("./settings.js"));
const settings_1 = require("./settings.js");
const TagsAPI = __importStar(require("./tags.js"));
const tags_1 = require("./tags.js");
class Scripts extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.assetUpload = new AssetUploadAPI.AssetUpload(this._client);
        this.content = new ContentAPI.Content(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
        this.bindings = new BindingsAPI.Bindings(this._client);
        this.secrets = new SecretsAPI.Secrets(this._client);
        this.tags = new TagsAPI.Tags(this._client);
    }
    /**
     * Upload a worker module to a Workers for Platforms namespace. You can find more
     * about the multipart metadata on our docs:
     * https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/.
     *
     * @example
     * ```ts
     * const script =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.update(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       metadata: {},
     *     },
     *   );
     * ```
     */
    update(dispatchNamespace, scriptName, params, options) {
        const { account_id, files, ...body } = params;
        return this._client.put(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}`, Core.maybeMultipartFormRequestOptions({
            body: { ...body, ...files },
            ...options,
            __multipartSyntax: 'json',
            headers: { 'Content-Type': 'application/javascript', ...options?.headers },
        }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete a worker from a Workers for Platforms namespace. This call has no
     * response body on a successful delete.
     *
     * @example
     * ```ts
     * const script =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.delete(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(dispatchNamespace, scriptName, params, options) {
        const { account_id, force } = params;
        return this._client.delete(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}`, { query: { force }, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch information about a script uploaded to a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const script =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.get(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(dispatchNamespace, scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Scripts = Scripts;
Scripts.AssetUpload = asset_upload_1.AssetUpload;
Scripts.Content = content_1.Content;
Scripts.Settings = settings_1.Settings;
Scripts.Bindings = bindings_1.Bindings;
Scripts.BindingGetResponsesSinglePage = bindings_1.BindingGetResponsesSinglePage;
Scripts.Secrets = secrets_1.Secrets;
Scripts.SecretListResponsesSinglePage = secrets_1.SecretListResponsesSinglePage;
Scripts.Tags = tags_1.Tags;
Scripts.TagUpdateResponsesSinglePage = tags_1.TagUpdateResponsesSinglePage;
Scripts.TagListResponsesSinglePage = tags_1.TagListResponsesSinglePage;
//# sourceMappingURL=scripts.js.map