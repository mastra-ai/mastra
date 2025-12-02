var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { isFileSource, isUrlSource } from "../lib/helpers";
import { DeepgramError, isDeepgramError } from "../lib/errors";
import { AbstractRestClient } from "./AbstractRestClient";
/**
 * The `ListenRestClient` class extends the `AbstractRestClient` class and provides methods for transcribing audio from URLs or files using the Deepgram API.
 *
 * The `transcribeUrl` method is used to transcribe audio from a URL synchronously. It takes a `UrlSource` object as the source, an optional `PrerecordedSchema` object as options, and an optional endpoint string. It returns a `DeepgramResponse` object containing the transcription result or an error.
 *
 * The `transcribeFile` method is used to transcribe audio from a file synchronously. It takes a `FileSource` object as the source, an optional `PrerecordedSchema` object as options, and an optional endpoint string. It returns a `DeepgramResponse` object containing the transcription result or an error.
 *
 * The `transcribeUrlCallback` method is used to transcribe audio from a URL asynchronously. It takes a `UrlSource` object as the source, a `CallbackUrl` object as the callback, an optional `PrerecordedSchema` object as options, and an optional endpoint string. It returns a `DeepgramResponse` object containing the transcription result or an error.
 *
 * The `transcribeFileCallback` method is used to transcribe audio from a file asynchronously. It takes a `FileSource` object as the source, a `CallbackUrl` object as the callback, an optional `PrerecordedSchema` object as options, and an optional endpoint string. It returns a `DeepgramResponse` object containing the transcription result or an error.
 */
export class ListenRestClient extends AbstractRestClient {
    constructor() {
        super(...arguments);
        this.namespace = "listen";
    }
    /**
     * Transcribes audio from a URL synchronously.
     *
     * @param source - The URL source object containing the audio URL to transcribe.
     * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
     * @param endpoint - An optional endpoint string to use for the transcription request.
     * @returns A `DeepgramResponse` object containing the transcription result or an error.
     */
    transcribeUrl(source, options, endpoint = ":version/listen") {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let body;
                if (isUrlSource(source)) {
                    body = JSON.stringify(source);
                }
                else {
                    throw new DeepgramError("Unknown transcription source type");
                }
                if (options !== undefined && "callback" in options) {
                    throw new DeepgramError("Callback cannot be provided as an option to a synchronous transcription. Use `transcribeUrlCallback` or `transcribeFileCallback` instead.");
                }
                if (((_a = options === null || options === void 0 ? void 0 : options.keyterm) === null || _a === void 0 ? void 0 : _a.length) && !((_b = options.model) === null || _b === void 0 ? void 0 : _b.startsWith("nova-3"))) {
                    throw new DeepgramError("Keyterms are only supported with the Nova 3 models.");
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
     * Transcribes audio from a file asynchronously.
     *
     * @param source - The file source object containing the audio file to transcribe.
     * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
     * @param endpoint - An optional endpoint string to use for the transcription request.
     * @returns A `DeepgramResponse` object containing the transcription result or an error.
     */
    transcribeFile(source, options, endpoint = ":version/listen") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let body;
                if (isFileSource(source)) {
                    body = source;
                }
                else {
                    throw new DeepgramError("Unknown transcription source type");
                }
                if (options !== undefined && "callback" in options) {
                    throw new DeepgramError("Callback cannot be provided as an option to a synchronous transcription. Use `transcribeUrlCallback` or `transcribeFileCallback` instead.");
                }
                const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign({}, options));
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
    /**
     * Transcribes audio from a URL asynchronously.
     *
     * @param source - The URL source object containing the audio file to transcribe.
     * @param callback - The callback URL to receive the transcription result.
     * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
     * @param endpoint - An optional endpoint string to use for the transcription request.
     * @returns A `DeepgramResponse` object containing the transcription result or an error.
     */
    transcribeUrlCallback(source, callback, options, endpoint = ":version/listen") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let body;
                if (isUrlSource(source)) {
                    body = JSON.stringify(source);
                }
                else {
                    throw new DeepgramError("Unknown transcription source type");
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
     * Transcribes audio from a file asynchronously.
     *
     * @param source - The file source object containing the audio file to transcribe.
     * @param callback - The callback URL to receive the transcription result.
     * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
     * @param endpoint - An optional endpoint string to use for the transcription request.
     * @returns A `DeepgramResponse` object containing the transcription result or an error.
     */
    transcribeFileCallback(source, callback, options, endpoint = ":version/listen") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let body;
                if (isFileSource(source)) {
                    body = source;
                }
                else {
                    throw new DeepgramError("Unknown transcription source type");
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
export { ListenRestClient as PrerecordedClient };
//# sourceMappingURL=ListenRestClient.js.map