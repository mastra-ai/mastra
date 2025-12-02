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
exports.SnippetsSinglePage = exports.Snippets = void 0;
const resource_1 = require("../../resource.js");
const Core = __importStar(require("../../core.js"));
const ContentAPI = __importStar(require("./content.js"));
const content_1 = require("./content.js");
const RulesAPI = __importStar(require("./rules.js"));
const rules_1 = require("./rules.js");
const pagination_1 = require("../../pagination.js");
class Snippets extends resource_1.APIResource {
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
exports.Snippets = Snippets;
class SnippetsSinglePage extends pagination_1.SinglePage {
}
exports.SnippetsSinglePage = SnippetsSinglePage;
Snippets.SnippetsSinglePage = SnippetsSinglePage;
Snippets.Content = content_1.Content;
Snippets.Rules = rules_1.Rules;
Snippets.RuleUpdateResponsesSinglePage = rules_1.RuleUpdateResponsesSinglePage;
Snippets.RuleListResponsesSinglePage = rules_1.RuleListResponsesSinglePage;
//# sourceMappingURL=snippets.js.map