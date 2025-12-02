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
exports.ScriptsSinglePage = exports.Scripts = void 0;
const resource_1 = require("../../../resource.js");
const Core = __importStar(require("../../../core.js"));
const ContentAPI = __importStar(require("./content.js"));
const content_1 = require("./content.js");
const DeploymentsAPI = __importStar(require("./deployments.js"));
const deployments_1 = require("./deployments.js");
const SchedulesAPI = __importStar(require("./schedules.js"));
const schedules_1 = require("./schedules.js");
const ScriptAndVersionSettingsAPI = __importStar(require("./script-and-version-settings.js"));
const script_and_version_settings_1 = require("./script-and-version-settings.js");
const SecretsAPI = __importStar(require("./secrets.js"));
const secrets_1 = require("./secrets.js");
const SettingsAPI = __importStar(require("./settings.js"));
const settings_1 = require("./settings.js");
const SubdomainAPI = __importStar(require("./subdomain.js"));
const subdomain_1 = require("./subdomain.js");
const TailAPI = __importStar(require("./tail.js"));
const tail_1 = require("./tail.js");
const VersionsAPI = __importStar(require("./versions.js"));
const versions_1 = require("./versions.js");
const AssetsAPI = __importStar(require("./assets/assets.js"));
const assets_1 = require("./assets/assets.js");
const pagination_1 = require("../../../pagination.js");
class Scripts extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.assets = new AssetsAPI.Assets(this._client);
        this.subdomain = new SubdomainAPI.Subdomain(this._client);
        this.schedules = new SchedulesAPI.Schedules(this._client);
        this.tail = new TailAPI.Tail(this._client);
        this.content = new ContentAPI.Content(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
        this.deployments = new DeploymentsAPI.Deployments(this._client);
        this.versions = new VersionsAPI.Versions(this._client);
        this.secrets = new SecretsAPI.Secrets(this._client);
        this.scriptAndVersionSettings = new ScriptAndVersionSettingsAPI.ScriptAndVersionSettings(this._client);
    }
    /**
     * Upload a worker module. You can find more about the multipart metadata on our
     * docs:
     * https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/.
     *
     * @example
     * ```ts
     * const script = await client.workers.scripts.update(
     *   'this-is_my_script-01',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     metadata: {},
     *   },
     * );
     * ```
     */
    update(scriptName, params, options) {
        const { account_id, files, ...body } = params;
        return this._client.put(`/accounts/${account_id}/workers/scripts/${scriptName}`, Core.maybeMultipartFormRequestOptions({
            body: { ...body, ...files },
            ...options,
            __multipartSyntax: 'json',
            headers: { 'Content-Type': 'application/javascript', ...options?.headers },
        }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a list of uploaded workers.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const script of client.workers.scripts.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/scripts`, ScriptsSinglePage, options);
    }
    /**
     * Delete your worker. This call has no response body on a successful delete.
     *
     * @example
     * ```ts
     * const script = await client.workers.scripts.delete(
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(scriptName, params, options) {
        const { account_id, force } = params;
        return this._client.delete(`/accounts/${account_id}/workers/scripts/${scriptName}`, {
            query: { force },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch raw script content for your worker. Note this is the original script
     * content, not JSON encoded.
     *
     * @example
     * ```ts
     * const script = await client.workers.scripts.get(
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}`, {
            ...options,
            headers: { Accept: 'application/javascript', ...options?.headers },
        });
    }
}
exports.Scripts = Scripts;
class ScriptsSinglePage extends pagination_1.SinglePage {
}
exports.ScriptsSinglePage = ScriptsSinglePage;
Scripts.ScriptsSinglePage = ScriptsSinglePage;
Scripts.Assets = assets_1.Assets;
Scripts.Subdomain = subdomain_1.Subdomain;
Scripts.Schedules = schedules_1.Schedules;
Scripts.Tail = tail_1.Tail;
Scripts.Content = content_1.Content;
Scripts.Settings = settings_1.Settings;
Scripts.Deployments = deployments_1.Deployments;
Scripts.Versions = versions_1.Versions;
Scripts.VersionListResponsesV4PagePagination = versions_1.VersionListResponsesV4PagePagination;
Scripts.Secrets = secrets_1.Secrets;
Scripts.SecretListResponsesSinglePage = secrets_1.SecretListResponsesSinglePage;
Scripts.ScriptAndVersionSettings = script_and_version_settings_1.ScriptAndVersionSettings;
//# sourceMappingURL=scripts.js.map