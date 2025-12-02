/// <reference types="node" />
import { EventEmitter } from "events";
import type { DeepgramClientOptions, DefaultClientOptions, DefaultNamespaceOptions } from "../lib/types";
export declare const noop: () => void;
/**
 * Represents an abstract Deepgram client that provides a base implementation for interacting with the Deepgram API.
 *
 * The `AbstractClient` class is responsible for:
 * - Initializing the Deepgram API key
 * - Applying default options for the client and namespace
 * - Providing a namespace for organizing API requests
 *
 * Subclasses of `AbstractClient` should implement the specific functionality for interacting with the Deepgram API.
 */
export declare abstract class AbstractClient extends EventEmitter {
    protected factory: Function | undefined;
    protected key: string;
    protected options: DefaultClientOptions;
    namespace: string;
    version: string;
    baseUrl: string;
    logger: Function;
    /**
     * Constructs a new instance of the DeepgramClient class with the provided options.
     *
     * @param options - The options to configure the DeepgramClient instance.
     * @param options.key - The Deepgram API key to use for authentication. If not provided, the `DEEPGRAM_API_KEY` environment variable will be used.
     * @param options.global - Global options that apply to all requests made by the DeepgramClient instance.
     * @param options.global.fetch - Options to configure the fetch requests made by the DeepgramClient instance.
     * @param options.global.fetch.options - Additional options to pass to the fetch function, such as `url` and `headers`.
     * @param options.namespace - Options specific to a particular namespace within the DeepgramClient instance.
     */
    constructor(options: DeepgramClientOptions);
    /**
     * Sets the version for the current instance of the Deepgram API and returns the instance.
     *
     * @param version - The version to set for the Deepgram API instance. Defaults to "v1" if not provided.
     * @returns The current instance of the AbstractClient with the updated version.
     */
    v(version?: string): this;
    /**
     * Gets the namespace options for the current instance of the AbstractClient.
     * The namespace options include the default options merged with the global options,
     * and the API key for the current instance.
     *
     * @returns The namespace options for the current instance.
     */
    get namespaceOptions(): DefaultNamespaceOptions;
    /**
     * Generates a URL for an API endpoint with optional query parameters and transcription options.
     *
     * @param endpoint - The API endpoint URL, which may contain placeholders for fields.
     * @param fields - An optional object containing key-value pairs to replace placeholders in the endpoint URL.
     * @param transcriptionOptions - Optional transcription options to include as query parameters in the URL.
     * @returns A URL object representing the constructed API request URL.
     */
    getRequestUrl(endpoint: string, fields?: {
        [key: string]: string;
    }, transcriptionOptions?: {
        [key: string]: unknown;
    }): URL;
    /**
     * Logs the message.
     *
     * For customized logging, `this.logger` can be overridden.
     */
    log(kind: string, msg: string, data?: any): void;
}
//# sourceMappingURL=AbstractClient.d.ts.map