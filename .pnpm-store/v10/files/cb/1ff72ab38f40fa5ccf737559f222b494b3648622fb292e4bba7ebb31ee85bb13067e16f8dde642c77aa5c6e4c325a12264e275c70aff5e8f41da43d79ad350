// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class ToMarkdown extends APIResource {
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
export class ToMarkdownCreateResponsesSinglePage extends SinglePage {
}
ToMarkdown.ToMarkdownCreateResponsesSinglePage = ToMarkdownCreateResponsesSinglePage;
//# sourceMappingURL=to-markdown.mjs.map