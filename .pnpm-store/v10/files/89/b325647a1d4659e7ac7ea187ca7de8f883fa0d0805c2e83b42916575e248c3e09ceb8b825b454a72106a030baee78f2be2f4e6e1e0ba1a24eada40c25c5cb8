// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as Core from "../../../core.mjs";
import * as ContentAPI from "./content.mjs";
import { Content } from "./content.mjs";
import * as DeploymentsAPI from "./deployments.mjs";
import { Deployments, } from "./deployments.mjs";
import * as SchedulesAPI from "./schedules.mjs";
import { Schedules, } from "./schedules.mjs";
import * as ScriptAndVersionSettingsAPI from "./script-and-version-settings.mjs";
import { ScriptAndVersionSettings, } from "./script-and-version-settings.mjs";
import * as SecretsAPI from "./secrets.mjs";
import { SecretListResponsesSinglePage, Secrets, } from "./secrets.mjs";
import * as SettingsAPI from "./settings.mjs";
import { Settings } from "./settings.mjs";
import * as SubdomainAPI from "./subdomain.mjs";
import { Subdomain, } from "./subdomain.mjs";
import * as TailAPI from "./tail.mjs";
import { Tail, } from "./tail.mjs";
import * as VersionsAPI from "./versions.mjs";
import { VersionListResponsesV4PagePagination, Versions, } from "./versions.mjs";
import * as AssetsAPI from "./assets/assets.mjs";
import { Assets as AssetsAPIAssets } from "./assets/assets.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Scripts extends APIResource {
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
export class ScriptsSinglePage extends SinglePage {
}
Scripts.ScriptsSinglePage = ScriptsSinglePage;
Scripts.Assets = AssetsAPIAssets;
Scripts.Subdomain = Subdomain;
Scripts.Schedules = Schedules;
Scripts.Tail = Tail;
Scripts.Content = Content;
Scripts.Settings = Settings;
Scripts.Deployments = Deployments;
Scripts.Versions = Versions;
Scripts.VersionListResponsesV4PagePagination = VersionListResponsesV4PagePagination;
Scripts.Secrets = Secrets;
Scripts.SecretListResponsesSinglePage = SecretListResponsesSinglePage;
Scripts.ScriptAndVersionSettings = ScriptAndVersionSettings;
//# sourceMappingURL=scripts.mjs.map