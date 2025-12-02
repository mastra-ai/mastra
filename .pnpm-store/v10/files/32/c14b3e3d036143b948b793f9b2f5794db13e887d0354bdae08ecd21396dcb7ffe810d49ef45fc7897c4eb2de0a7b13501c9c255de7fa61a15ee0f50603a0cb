"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeakRestClient = void 0;
const errors_1 = require("../lib/errors");
const helpers_1 = require("../lib/helpers");
const AbstractRestClient_1 = require("./AbstractRestClient");
/**
 * Provides a client for interacting with the Deepgram Text-to-Speech API.
 */
class SpeakRestClient extends AbstractRestClient_1.AbstractRestClient {
    constructor() {
        super(...arguments);
        this.namespace = "speak";
    }
    /**
     * Sends a request to the Deepgram Text-to-Speech API to generate audio from the provided text source.
     *
     * @param source - The text source to be converted to audio.
     * @param options - Optional configuration options for the text-to-speech request.
     * @param endpoint - The API endpoint to use for the request. Defaults to ":version/speak".
     * @returns A promise that resolves to the SpeakRestClient instance, which can be used to retrieve the response headers and body.
     * @throws {DeepgramError} If the text source type is unknown.
     * @throws {DeepgramUnknownError} If the request was made before a previous request completed.
     * @see https://developers.deepgram.com/reference/text-to-speech-api
     */
    request(source, options, endpoint = ":version/speak") {
        return __awaiter(this, void 0, void 0, function* () {
            let body;
            if ((0, helpers_1.isTextSource)(source)) {
                body = JSON.stringify(source);
            }
            else {
                throw new errors_1.DeepgramError("Unknown transcription source type");
            }
            const requestUrl = this.getRequestUrl(endpoint, {}, Object.assign({ model: "aura-asteria-en" }, options));
            this.result = yield this.post(requestUrl, body, {
                headers: { Accept: "audio/*", "Content-Type": "application/json" },
            });
            return this;
        });
    }
    /**
     * Retrieves the response body as a readable stream.
     *
     * @returns A promise that resolves to the response body as a readable stream, or `null` if no request has been made yet.
     * @throws {DeepgramUnknownError} If a request has not been made yet.
     */
    getStream() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.result)
                throw new errors_1.DeepgramUnknownError("Tried to get stream before making request", "");
            return this.result.body;
        });
    }
    /**
     * Retrieves the response headers from the previous request.
     *
     * @returns A promise that resolves to the response headers, or throws a `DeepgramUnknownError` if no request has been made yet.
     */
    getHeaders() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.result)
                throw new errors_1.DeepgramUnknownError("Tried to get headers before making request", "");
            return this.result.headers;
        });
    }
}
exports.SpeakRestClient = SpeakRestClient;
//# sourceMappingURL=SpeakRestClient.js.map