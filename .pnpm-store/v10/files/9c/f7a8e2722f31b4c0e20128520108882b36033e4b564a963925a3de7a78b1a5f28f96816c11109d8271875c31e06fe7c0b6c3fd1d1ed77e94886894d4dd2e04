import { CallbackUrl, isTextSource, isUrlSource } from "../lib/helpers";
import { DeepgramError, isDeepgramError } from "../lib/errors";
import type {
  AnalyzeSchema,
  AsyncAnalyzeResponse,
  DeepgramResponse,
  SyncAnalyzeResponse,
  TextSource,
  UrlSource,
} from "../lib/types";
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
export class ReadRestClient extends AbstractRestClient {
  public namespace: string = "read";

  /**
   * Analyzes a URL-based audio source synchronously.
   *
   * @param source - The URL-based audio source to analyze.
   * @param options - Optional analysis options.
   * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
   * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
   */
  async analyzeUrl(
    source: UrlSource,
    options?: AnalyzeSchema,
    endpoint = ":version/read"
  ): Promise<DeepgramResponse<SyncAnalyzeResponse>> {
    try {
      let body;

      if (isUrlSource(source)) {
        body = JSON.stringify(source);
      } else {
        throw new DeepgramError("Unknown source type");
      }

      if (options !== undefined && "callback" in options) {
        throw new DeepgramError(
          "Callback cannot be provided as an option to a synchronous transcription. Use `analyzeUrlCallback` or `analyzeTextCallback` instead."
        );
      }

      const requestUrl = this.getRequestUrl(endpoint, {}, { ...{}, ...options });
      const result: SyncAnalyzeResponse = await this.post(requestUrl, body).then((result) =>
        result.json()
      );

      return { result, error: null };
    } catch (error) {
      if (isDeepgramError(error)) {
        return { result: null, error };
      }

      throw error;
    }
  }

  /**
   * Analyzes a text-based audio source synchronously.
   *
   * @param source - The text-based audio source to analyze.
   * @param options - Optional analysis options.
   * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
   * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
   */
  async analyzeText(
    source: TextSource,
    options?: AnalyzeSchema,
    endpoint = ":version/read"
  ): Promise<DeepgramResponse<SyncAnalyzeResponse>> {
    try {
      let body;

      if (isTextSource(source)) {
        body = JSON.stringify(source);
      } else {
        throw new DeepgramError("Unknown source type");
      }

      if (options !== undefined && "callback" in options) {
        throw new DeepgramError(
          "Callback cannot be provided as an option to a synchronous requests. Use `analyzeUrlCallback` or `analyzeTextCallback` instead."
        );
      }

      const requestUrl = this.getRequestUrl(endpoint, {}, { ...{}, ...options });
      const result: SyncAnalyzeResponse = await this.post(requestUrl, body).then((result) =>
        result.json()
      );

      return { result, error: null };
    } catch (error) {
      if (isDeepgramError(error)) {
        return { result: null, error };
      }

      throw error;
    }
  }

  /**
   * Analyzes a URL-based audio source asynchronously.
   *
   * @param source - The URL-based audio source to analyze.
   * @param callback - The URL to call back with the analysis results.
   * @param options - Optional analysis options.
   * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
   * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
   */
  async analyzeUrlCallback(
    source: UrlSource,
    callback: CallbackUrl,
    options?: AnalyzeSchema,
    endpoint = ":version/read"
  ): Promise<DeepgramResponse<AsyncAnalyzeResponse>> {
    try {
      let body;

      if (isUrlSource(source)) {
        body = JSON.stringify(source);
      } else {
        throw new DeepgramError("Unknown source type");
      }

      const requestUrl = this.getRequestUrl(
        endpoint,
        {},
        { ...options, callback: callback.toString() }
      );
      const result: AsyncAnalyzeResponse = await this.post(requestUrl, body).then((result) =>
        result.json()
      );

      return { result, error: null };
    } catch (error) {
      if (isDeepgramError(error)) {
        return { result: null, error };
      }

      throw error;
    }
  }

  /**
   * Analyzes a text-based audio source asynchronously.
   *
   * @param source - The text-based audio source to analyze.
   * @param callback - The URL to call back with the analysis results.
   * @param options - Optional analysis options.
   * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
   * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
   */
  async analyzeTextCallback(
    source: TextSource,
    callback: CallbackUrl,
    options?: AnalyzeSchema,
    endpoint = ":version/read"
  ): Promise<DeepgramResponse<AsyncAnalyzeResponse>> {
    try {
      let body;

      if (isTextSource(source)) {
        body = JSON.stringify(source);
      } else {
        throw new DeepgramError("Unknown source type");
      }

      const requestUrl = this.getRequestUrl(
        endpoint,
        {},
        { ...options, callback: callback.toString() }
      );
      const result: AsyncAnalyzeResponse = await this.post(requestUrl, body, {
        headers: { "Content-Type": "deepgram/audio+video" },
      }).then((result) => result.json());

      return { result, error: null };
    } catch (error) {
      if (isDeepgramError(error)) {
        return { result: null, error };
      }

      throw error;
    }
  }
}

export { ReadRestClient as ReadClient };
