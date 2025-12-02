var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { isTextSource, isUrlSource } from "../lib/helpers";
import { DeepgramError, isDeepgramError } from "../lib/errors";
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
    constructor() {
        super(...arguments);
        this.namespace = "read";
    }
    /**
     * Analyzes a URL-based audio source synchronously.
     *
     * @param source - The URL-based audio source to analyze.
     * @param options - Optional analysis options.
     * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
     * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
     */
    analyzeUrl(source, options, endpoint = ":version/read") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let body;
                if (isUrlSource(source)) {
                    body = JSON.stringify(source);
                }
                else {
                    throw new DeepgramError("Unknown source type");
                }
                if (options !== undefined && "callback" in options) {
                    throw new DeepgramError("Callback cannot be provided as an option to a synchronous transcription. Use `analyzeUrlCallback` or `analyzeTextCallback` instead.");
                }
                const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign({}, options));
                const result = yield this.post(requestUrl, body).then((result) => result.json());
                return { result, error: null };
            }
            catch (error) {
                if (isDeepgramError(error)) {
                    return { result: null, error };
                }
                throw error;
            }
        });
    }
    /**
     * Analyzes a text-based audio source synchronously.
     *
     * @param source - The text-based audio source to analyze.
     * @param options - Optional analysis options.
     * @param endpoint - The API endpoint to use for the analysis. Defaults to ":version/read".
     * @returns A promise that resolves to the analysis response, or an error if the analysis fails.
     */
    analyzeText(source, options, endpoint = ":version/read") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let body;
                if (isTextSource(source)) {
                    body = JSON.stringify(source);
                }
                else {
                    throw new DeepgramError("Unknown source type");
                }
                if (options !== undefined && "callback" in options) {
                    throw new DeepgramError("Callback cannot be provided as an option to a synchronous requests. Use `analyzeUrlCallback` or `analyzeTextCallback` instead.");
                }
                const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign({}, options));
                const result = yield this.post(requestUrl, body).then((result) => result.json());
                return { result, error: null };
            }
            catch (error) {
                if (isDeepgramError(error)) {
                    return { result: null, error };
                }
                throw error;
            }
        });
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
    analyzeUrlCallback(source, callback, options, endpoint = ":version/read") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let body;
                if (isUrlSource(source)) {
                    body = JSON.stringify(source);
                }
                else {
                    throw new DeepgramError("Unknown source type");
                }
                const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign(Object.assign({}, options), { callback: callback.toString() }));
                const result = yield this.post(requestUrl, body).then((result) => result.json());
                return { result, error: null };
            }
            catch (error) {
                if (isDeepgramError(error)) {
                    return { result: null, error };
                }
                throw error;
            }
        });
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
    analyzeTextCallback(source, callback, options, endpoint = ":version/read") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let body;
                if (isTextSource(source)) {
                    body = JSON.stringify(source);
                }
                else {
                    throw new DeepgramError("Unknown source type");
                }
                const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign(Object.assign({}, options), { callback: callback.toString() }));
                const result = yield this.post(requestUrl, body, {
                    headers: { "Content-Type": "deepgram/audio+video" },
                }).then((result) => result.json());
                return { result, error: null };
            }
            catch (error) {
                if (isDeepgramError(error)) {
                    return { result: null, error };
                }
                throw error;
            }
        });
    }
}
export { ReadRestClient as ReadClient };
//# sourceMappingURL=ReadRestClient.js.map