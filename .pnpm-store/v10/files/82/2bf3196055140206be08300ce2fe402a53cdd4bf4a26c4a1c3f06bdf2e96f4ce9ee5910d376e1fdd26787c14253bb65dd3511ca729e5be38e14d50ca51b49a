import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as Shared from "../shared.js";
import * as ContentAPI from "./content.js";
import { Content, ContentGetParams } from "./content.js";
import * as RulesAPI from "./rules.js";
import { RuleDeleteParams, RuleDeleteResponse, RuleListParams, RuleListResponse, RuleListResponsesSinglePage, RuleUpdateParams, RuleUpdateResponse, RuleUpdateResponsesSinglePage, Rules } from "./rules.js";
import { SinglePage } from "../../pagination.js";
export declare class Snippets extends APIResource {
    content: ContentAPI.Content;
    rules: RulesAPI.Rules;
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
    update(snippetName: string, params: SnippetUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Snippet>;
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
    list(params: SnippetListParams, options?: Core.RequestOptions): Core.PagePromise<SnippetsSinglePage, Snippet>;
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
    delete(snippetName: string, params: SnippetDeleteParams, options?: Core.RequestOptions): Core.APIPromise<SnippetDeleteResponse>;
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
    get(snippetName: string, params: SnippetGetParams, options?: Core.RequestOptions): Core.APIPromise<Snippet>;
}
export declare class SnippetsSinglePage extends SinglePage<Snippet> {
}
/**
 * Snippet Information
 */
export interface Snippet {
    /**
     * Creation time of the snippet
     */
    created_on?: string;
    /**
     * Modification time of the snippet
     */
    modified_on?: string;
    /**
     * Snippet identifying name
     */
    snippet_name?: string;
}
export interface SnippetDeleteResponse {
    errors: Array<Shared.ResponseInfo>;
    messages: Array<Shared.ResponseInfo>;
    /**
     * Whether the API call was successful
     */
    success: true;
}
export interface SnippetUpdateParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Body param: Content files of uploaded snippet
     */
    files?: string;
    /**
     * Body param:
     */
    metadata?: SnippetUpdateParams.Metadata;
}
export declare namespace SnippetUpdateParams {
    interface Metadata {
        /**
         * Main module name of uploaded snippet
         */
        main_module?: string;
    }
}
export interface SnippetListParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export interface SnippetDeleteParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export interface SnippetGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace Snippets {
    export { type Snippet as Snippet, type SnippetDeleteResponse as SnippetDeleteResponse, SnippetsSinglePage as SnippetsSinglePage, type SnippetUpdateParams as SnippetUpdateParams, type SnippetListParams as SnippetListParams, type SnippetDeleteParams as SnippetDeleteParams, type SnippetGetParams as SnippetGetParams, };
    export { Content as Content, type ContentGetParams as ContentGetParams };
    export { Rules as Rules, type RuleUpdateResponse as RuleUpdateResponse, type RuleListResponse as RuleListResponse, type RuleDeleteResponse as RuleDeleteResponse, RuleUpdateResponsesSinglePage as RuleUpdateResponsesSinglePage, RuleListResponsesSinglePage as RuleListResponsesSinglePage, type RuleUpdateParams as RuleUpdateParams, type RuleListParams as RuleListParams, type RuleDeleteParams as RuleDeleteParams, };
}
//# sourceMappingURL=snippets.d.ts.map