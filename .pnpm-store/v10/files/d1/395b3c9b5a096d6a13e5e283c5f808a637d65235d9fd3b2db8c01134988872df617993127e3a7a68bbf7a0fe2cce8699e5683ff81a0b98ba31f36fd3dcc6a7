import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
import { type BlobLike } from "../../../uploads.js";
export declare class ToMarkdown extends APIResource {
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
    create(params: ToMarkdownCreateParams, options?: Core.RequestOptions): Core.PagePromise<ToMarkdownCreateResponsesSinglePage, ToMarkdownCreateResponse>;
}
export declare class ToMarkdownCreateResponsesSinglePage extends SinglePage<ToMarkdownCreateResponse> {
}
export interface ToMarkdownCreateResponse {
    data: string;
    format: string;
    mimeType: string;
    name: string;
    tokens: string;
}
export interface ToMarkdownCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    body?: string | ArrayBufferView | ArrayBuffer | BlobLike;
}
export declare namespace ToMarkdown {
    export { type ToMarkdownCreateResponse as ToMarkdownCreateResponse, ToMarkdownCreateResponsesSinglePage as ToMarkdownCreateResponsesSinglePage, type ToMarkdownCreateParams as ToMarkdownCreateParams, };
}
//# sourceMappingURL=to-markdown.d.ts.map