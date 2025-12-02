import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class Outputs extends APIResource {
    /**
     * Creates a new output that can be used to simulcast or restream live video to
     * other RTMP or SRT destinations. Outputs are always linked to a specific live
     * input — one live input can have many outputs.
     *
     * @example
     * ```ts
     * const output =
     *   await client.stream.liveInputs.outputs.create(
     *     '66be4bf738797e01e1fca35a7bdecdcd',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       streamKey: 'uzya-f19y-g2g9-a2ee-51j2',
     *       url: 'rtmp://a.rtmp.youtube.com/live2',
     *     },
     *   );
     * ```
     */
    create(liveInputIdentifier: string, params: OutputCreateParams, options?: Core.RequestOptions): Core.APIPromise<Output>;
    /**
     * Updates the state of an output.
     *
     * @example
     * ```ts
     * const output =
     *   await client.stream.liveInputs.outputs.update(
     *     '66be4bf738797e01e1fca35a7bdecdcd',
     *     'baea4d9c515887b80289d5c33cf01145',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       enabled: true,
     *     },
     *   );
     * ```
     */
    update(liveInputIdentifier: string, outputIdentifier: string, params: OutputUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Output>;
    /**
     * Retrieves all outputs associated with a specified live input.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const output of client.stream.liveInputs.outputs.list(
     *   '66be4bf738797e01e1fca35a7bdecdcd',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(liveInputIdentifier: string, params: OutputListParams, options?: Core.RequestOptions): Core.PagePromise<OutputsSinglePage, Output>;
    /**
     * Deletes an output and removes it from the associated live input.
     *
     * @example
     * ```ts
     * await client.stream.liveInputs.outputs.delete(
     *   '66be4bf738797e01e1fca35a7bdecdcd',
     *   'baea4d9c515887b80289d5c33cf01145',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(liveInputIdentifier: string, outputIdentifier: string, params: OutputDeleteParams, options?: Core.RequestOptions): Core.APIPromise<void>;
}
export declare class OutputsSinglePage extends SinglePage<Output> {
}
export interface Output {
    /**
     * When enabled, live video streamed to the associated live input will be sent to
     * the output URL. When disabled, live video will not be sent to the output URL,
     * even when streaming to the associated live input. Use this to control precisely
     * when you start and stop simulcasting to specific destinations like YouTube and
     * Twitch.
     */
    enabled?: boolean;
    /**
     * The streamKey used to authenticate against an output's target.
     */
    streamKey?: string;
    /**
     * A unique identifier for the output.
     */
    uid?: string;
    /**
     * The URL an output uses to restream.
     */
    url?: string;
}
export interface OutputCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: The streamKey used to authenticate against an output's target.
     */
    streamKey: string;
    /**
     * Body param: The URL an output uses to restream.
     */
    url: string;
    /**
     * Body param: When enabled, live video streamed to the associated live input will
     * be sent to the output URL. When disabled, live video will not be sent to the
     * output URL, even when streaming to the associated live input. Use this to
     * control precisely when you start and stop simulcasting to specific destinations
     * like YouTube and Twitch.
     */
    enabled?: boolean;
}
export interface OutputUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: When enabled, live video streamed to the associated live input will
     * be sent to the output URL. When disabled, live video will not be sent to the
     * output URL, even when streaming to the associated live input. Use this to
     * control precisely when you start and stop simulcasting to specific destinations
     * like YouTube and Twitch.
     */
    enabled: boolean;
}
export interface OutputListParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface OutputDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Outputs {
    export { type Output as Output, OutputsSinglePage as OutputsSinglePage, type OutputCreateParams as OutputCreateParams, type OutputUpdateParams as OutputUpdateParams, type OutputListParams as OutputListParams, type OutputDeleteParams as OutputDeleteParams, };
}
//# sourceMappingURL=outputs.d.ts.map