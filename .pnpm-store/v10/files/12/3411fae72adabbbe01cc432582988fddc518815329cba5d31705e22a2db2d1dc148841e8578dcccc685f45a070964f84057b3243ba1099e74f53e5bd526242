// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import * as Core from "../../../../../core.mjs";
import * as AssetUploadAPI from "./asset-upload.mjs";
import { AssetUpload } from "./asset-upload.mjs";
import * as BindingsAPI from "./bindings.mjs";
import { BindingGetResponsesSinglePage, Bindings } from "./bindings.mjs";
import * as ContentAPI from "./content.mjs";
import { Content } from "./content.mjs";
import * as SecretsAPI from "./secrets.mjs";
import { SecretListResponsesSinglePage, Secrets, } from "./secrets.mjs";
import * as SettingsAPI from "./settings.mjs";
import { Settings, } from "./settings.mjs";
import * as TagsAPI from "./tags.mjs";
import { TagListResponsesSinglePage, TagUpdateResponsesSinglePage, Tags, } from "./tags.mjs";
export class Scripts extends APIResource {
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
Scripts.AssetUpload = AssetUpload;
Scripts.Content = Content;
Scripts.Settings = Settings;
Scripts.Bindings = Bindings;
Scripts.BindingGetResponsesSinglePage = BindingGetResponsesSinglePage;
Scripts.Secrets = Secrets;
Scripts.SecretListResponsesSinglePage = SecretListResponsesSinglePage;
Scripts.Tags = Tags;
Scripts.TagUpdateResponsesSinglePage = TagUpdateResponsesSinglePage;
Scripts.TagListResponsesSinglePage = TagListResponsesSinglePage;
//# sourceMappingURL=scripts.mjs.map