import { CallbackUrl } from "../lib/helpers";
import type { AnalyzeSchema, AsyncAnalyzeResponse, DeepgramResponse, SyncAnalyzeResponse, TextSource, UrlSource } from "../lib/types";
import { AbstractRestClient } from "./AbstractRestClient";
/**
 * The `ReadRestClient` class extends the `AbstractRestClient` class and provides methods for analyzing audio sources synchronously and asynchronously.
 *
 * The `analyzeUrl` method analyzes a URL-based audio source synchronously, returning a promise that resolves to the analysis response or an error.
 *
 * The `analyzeText` method analyzes a text-based audio source synchronously, returning a promise that resolves to the analysis response or an error.
 *
 * The `analyzeUrlCallback` method analyzes a URL-based audio source asynchronously, returning a promise that resolves to the analysis response or an error.
 *
 * The `analyzeTextCallback` method analyzes a text-based audio source asynchronously, returning a promise that resolves to the analysis response or an error.
 */
export declare class ReadRestClient extends AbstractRestClient {
    namespace: string;
    /**
     * Analyzes a URL-based audio source synchronously.
     *
     * @param source - The URL-based audio source to analyze.
     * @param options - Optional analysis options.
     * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
     * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
     */
    analyzeUrl(source: UrlSource, options?: AnalyzeSchema, endpoint?: string): Promise<DeepgramResponse<SyncAnalyzeResponse>>;
    /**
     * Analyzes a text-based audio source synchronously.
     *
     * @param source - The text-based audio source to analyze.
     * @param options - Optional analysis options.
     * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
     * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
     */
    analyzeText(source: TextSource, options?: AnalyzeSchema, endpoint?: string): Promise<DeepgramResponse<SyncAnalyzeResponse>>;
    /**
     * Analyzes a URL-based audio source asynchronously.
     *
     * @param source - The URL-based audio source to analyze.
     * @param callback - The URL to call back with the analysis results.
     * @param options - Optional analysis options.
     * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
     * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
     */
    analyzeUrlCallback(source: UrlSource, callback: CallbackUrl, options?: AnalyzeSchema, endpoint?: string): Promise<DeepgramResponse<AsyncAnalyzeResponse>>;
    /**
     * Analyzes a text-based audio source asynchronously.
     *
     * @param source - The text-based audio source to analyze.
     * @param callback - The URL to call back with the analysis results.
     * @param options - Optional analysis options.
     * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
     * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
     */
    analyzeTextCallback(source: TextSource, callback: CallbackUrl, options?: AnalyzeSchema, endpoint?: string): Promise<DeepgramResponse<AsyncAnalyzeResponse>>;
}
export { ReadRestClient as ReadClient };
//# sourceMappingURL=ReadRestClient.d.ts.map