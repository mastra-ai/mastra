import { SpeakSchema, TextSource } from "../lib/types";
import { AbstractRestClient } from "./AbstractRestClient";
/**
 * Provides a client for interacting with the Deepgram Text-to-Speech API.
 */
export declare class SpeakRestClient extends AbstractRestClient {
    namespace: string;
    result: undefined | Response;
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
    request(source: TextSource, options?: SpeakSchema, endpoint?: string): Promise<SpeakRestClient>;
    /**
     * Retrieves the response body as a readable stream.
     *
     * @returns A promise that resolves to the response body as a readable stream, or `null` if no request has been made yet.
     * @throws {DeepgramUnknownError} If a request has not been made yet.
     */
    getStream(): Promise<ReadableStream<Uint8Array> | null>;
    /**
     * Retrieves the response headers from the previous request.
     *
     * @returns A promise that resolves to the response headers, or throws a `DeepgramUnknownError` if no request has been made yet.
     */
    getHeaders(): Promise<Headers>;
}
//# sourceMappingURL=SpeakRestClient.d.ts.map