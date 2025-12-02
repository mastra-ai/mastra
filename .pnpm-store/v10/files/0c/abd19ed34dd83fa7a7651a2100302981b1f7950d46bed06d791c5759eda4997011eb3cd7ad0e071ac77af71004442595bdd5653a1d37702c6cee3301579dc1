// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as Core from "../../core.mjs";
import * as ContentAPI from "./content.mjs";
import { Content } from "./content.mjs";
import * as RulesAPI from "./rules.mjs";
import { RuleListResponsesSinglePage, RuleUpdateResponsesSinglePage, Rules, } from "./rules.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Snippets extends APIResource {
    constructor() {
        super(...arguments);
        this.content = new ContentAPI.Content(this._client);
        this.rules = new RulesAPI.Rules(this._client);
    }
    /**
     * Put Snippet
     *
     * @example
     * ```ts
     * const snippet = await client.snippets.update(
     *   'snippet_name_01',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(snippetName, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/snippets/${snippetName}`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * All Snippets
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const snippet of client.snippets.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/snippets`, SnippetsSinglePage, options);
    }
    /**
     * Delete Snippet
     *
     * @example
     * ```ts
     * const snippet = await client.snippets.delete(
     *   'snippet_name_01',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(snippetName, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/snippets/${snippetName}`, options);
    }
    /**
     * Snippet
     *
     * @example
     * ```ts
     * const snippet = await client.snippets.get(
     *   'snippet_name_01',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(snippetName, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/snippets/${snippetName}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class SnippetsSinglePage extends SinglePage {
}
Snippets.SnippetsSinglePage = SnippetsSinglePage;
Snippets.Content = Content;
Snippets.Rules = Rules;
Snippets.RuleUpdateResponsesSinglePage = RuleUpdateResponsesSinglePage;
Snippets.RuleListResponsesSinglePage = RuleListResponsesSinglePage;
//# sourceMappingURL=snippets.mjs.map