"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToMarkdownCreateResponsesSinglePage = exports.ToMarkdown = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class ToMarkdown extends resource_1.APIResource {
    /**
     * Convert Files into Markdown
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const toMarkdownCreateResponse of client.radar.ai.toMarkdown.create(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(params, options) {
        const { account_id, body } = params ?? {};
        return this._client.getAPIList(`/accounts/${account_id}/ai/tomarkdown`, ToMarkdownCreateResponsesSinglePage, {
            body: body,
            method: 'post',
            ...options,
            headers: { 'Content-Type': 'application/octet-stream', ...options?.headers },
            __binaryRequest: true,
        });
    }
}
exports.ToMarkdown = ToMarkdown;
class ToMarkdownCreateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.ToMarkdownCreateResponsesSinglePage = ToMarkdownCreateResponsesSinglePage;
ToMarkdown.ToMarkdownCreateResponsesSinglePage = ToMarkdownCreateResponsesSinglePage;
//# sourceMappingURL=to-markdown.js.map