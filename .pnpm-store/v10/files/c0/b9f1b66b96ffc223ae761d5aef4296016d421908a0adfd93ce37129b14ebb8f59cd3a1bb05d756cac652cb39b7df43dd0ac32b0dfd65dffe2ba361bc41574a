import type * as gax from 'google-gax';
import type { Callback, CallOptions, Descriptors, ClientOptions } from 'google-gax';
import * as protos from '../../protos/protos';
/**
 *  Service that implements Google Cloud Text-to-Speech API.
 * @class
 * @memberof v1beta1
 */
export declare class TextToSpeechClient {
    private _terminated;
    private _opts;
    private _providedCustomServicePath;
    private _gaxModule;
    private _gaxGrpc;
    private _protos;
    private _defaults;
    private _universeDomain;
    private _servicePath;
    private _log;
    auth: gax.GoogleAuth;
    descriptors: Descriptors;
    warn: (code: string, message: string, warnType?: string) => void;
    innerApiCalls: {
        [name: string]: Function;
    };
    pathTemplates: {
        [name: string]: gax.PathTemplate;
    };
    textToSpeechStub?: Promise<{
        [name: string]: Function;
    }>;
    /**
     * Construct an instance of TextToSpeechClient.
     *
     * @param {object} [options] - The configuration object.
     * The options accepted by the constructor are described in detail
     * in [this document](https://github.com/googleapis/gax-nodejs/blob/main/client-libraries.md#creating-the-client-instance).
     * The common options are:
     * @param {object} [options.credentials] - Credentials object.
     * @param {string} [options.credentials.client_email]
     * @param {string} [options.credentials.private_key]
     * @param {string} [options.email] - Account email address. Required when
     *     using a .pem or .p12 keyFilename.
     * @param {string} [options.keyFilename] - Full path to the a .json, .pem, or
     *     .p12 key downloaded from the Google Developers Console. If you provide
     *     a path to a JSON file, the projectId option below is not necessary.
     *     NOTE: .pem and .p12 require you to specify options.email as well.
     * @param {number} [options.port] - The port on which to connect to
     *     the remote host.
     * @param {string} [options.projectId] - The project ID from the Google
     *     Developer's Console, e.g. 'grape-spaceship-123'. We will also check
     *     the environment variable GCLOUD_PROJECT for your project ID. If your
     *     app is running in an environment which supports
     *     {@link https://cloud.google.com/docs/authentication/application-default-credentials Application Default Credentials},
     *     your project ID will be detected automatically.
     * @param {string} [options.apiEndpoint] - The domain name of the
     *     API remote host.
     * @param {gax.ClientConfig} [options.clientConfig] - Client configuration override.
     *     Follows the structure of {@link gapicConfig}.
     * @param {boolean} [options.fallback] - Use HTTP/1.1 REST mode.
     *     For more information, please check the
     *     {@link https://github.com/googleapis/gax-nodejs/blob/main/client-libraries.md#http11-rest-api-mode documentation}.
     * @param {gax} [gaxInstance]: loaded instance of `google-gax`. Useful if you
     *     need to avoid loading the default gRPC version and want to use the fallback
     *     HTTP implementation. Load only fallback version and pass it to the constructor:
     *     ```
     *     const gax = require('google-gax/build/src/fallback'); // avoids loading google-gax with gRPC
     *     const client = new TextToSpeechClient({fallback: true}, gax);
     *     ```
     */
    constructor(opts?: ClientOptions, gaxInstance?: typeof gax | typeof gax.fallback);
    /**
     * Initialize the client.
     * Performs asynchronous operations (such as authentication) and prepares the client.
     * This function will be called automatically when any class method is called for the
     * first time, but if you need to initialize it before calling an actual method,
     * feel free to call initialize() directly.
     *
     * You can await on this method if you want to make sure the client is initialized.
     *
     * @returns {Promise} A promise that resolves to an authenticated service stub.
     */
    initialize(): Promise<{
        [name: string]: Function;
    }>;
    /**
     * The DNS address for this API service.
     * @deprecated Use the apiEndpoint method of the client instance.
     * @returns {string} The DNS address for this service.
     */
    static get servicePath(): string;
    /**
     * The DNS address for this API service - same as servicePath.
     * @deprecated Use the apiEndpoint method of the client instance.
     * @returns {string} The DNS address for this service.
     */
    static get apiEndpoint(): string;
    /**
     * The DNS address for this API service.
     * @returns {string} The DNS address for this service.
     */
    get apiEndpoint(): string;
    get universeDomain(): string;
    /**
     * The port for this API service.
     * @returns {number} The default port for this service.
     */
    static get port(): number;
    /**
     * The scopes needed to make gRPC calls for every method defined
     * in this service.
     * @returns {string[]} List of default scopes.
     */
    static get scopes(): string[];
    getProjectId(): Promise<string>;
    getProjectId(callback: Callback<string, undefined, undefined>): void;
    /**
     * Returns a list of Voice supported for synthesis.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} [request.languageCode]
     *   Optional. Recommended.
     *   [BCP-47](https://www.rfc-editor.org/rfc/bcp/bcp47.txt) language tag.
     *   If not specified, the API will return all supported voices.
     *   If specified, the ListVoices call will only return voices that can be used
     *   to synthesize this language_code. For example, if you specify `"en-NZ"`,
     *   all `"en-NZ"` voices will be returned. If you specify `"no"`, both
     *   `"no-\*"` (Norwegian) and `"nb-\*"` (Norwegian Bokmal) voices will be
     *   returned.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.texttospeech.v1beta1.ListVoicesResponse|ListVoicesResponse}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1beta1/text_to_speech.list_voices.js</caption>
     * region_tag:texttospeech_v1beta1_generated_TextToSpeech_ListVoices_async
     */
    listVoices(request?: protos.google.cloud.texttospeech.v1beta1.IListVoicesRequest, options?: CallOptions): Promise<[
        protos.google.cloud.texttospeech.v1beta1.IListVoicesResponse,
        protos.google.cloud.texttospeech.v1beta1.IListVoicesRequest | undefined,
        {} | undefined
    ]>;
    listVoices(request: protos.google.cloud.texttospeech.v1beta1.IListVoicesRequest, options: CallOptions, callback: Callback<protos.google.cloud.texttospeech.v1beta1.IListVoicesResponse, protos.google.cloud.texttospeech.v1beta1.IListVoicesRequest | null | undefined, {} | null | undefined>): void;
    listVoices(request: protos.google.cloud.texttospeech.v1beta1.IListVoicesRequest, callback: Callback<protos.google.cloud.texttospeech.v1beta1.IListVoicesResponse, protos.google.cloud.texttospeech.v1beta1.IListVoicesRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Synthesizes speech synchronously: receive results after all text input
     * has been processed.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.cloud.texttospeech.v1beta1.SynthesisInput} request.input
     *   Required. The Synthesizer requires either plain text or SSML as input.
     * @param {google.cloud.texttospeech.v1beta1.VoiceSelectionParams} request.voice
     *   Required. The desired voice of the synthesized audio.
     * @param {google.cloud.texttospeech.v1beta1.AudioConfig} request.audioConfig
     *   Required. The configuration of the synthesized audio.
     * @param {number[]} request.enableTimePointing
     *   Whether and what timepoints are returned in the response.
     * @param {google.cloud.texttospeech.v1beta1.AdvancedVoiceOptions} request.advancedVoiceOptions
     *   Advanced voice options.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.texttospeech.v1beta1.SynthesizeSpeechResponse|SynthesizeSpeechResponse}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1beta1/text_to_speech.synthesize_speech.js</caption>
     * region_tag:texttospeech_v1beta1_generated_TextToSpeech_SynthesizeSpeech_async
     */
    synthesizeSpeech(request?: protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest, options?: CallOptions): Promise<[
        protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechResponse,
        protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest | undefined,
        {} | undefined
    ]>;
    synthesizeSpeech(request: protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest, options: CallOptions, callback: Callback<protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechResponse, protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest | null | undefined, {} | null | undefined>): void;
    synthesizeSpeech(request: protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest, callback: Callback<protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechResponse, protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Performs bidirectional streaming speech synthesis: receives audio while
     * sending text.
     *
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which is both readable and writable. It accepts objects
     *   representing {@link protos.google.cloud.texttospeech.v1beta1.StreamingSynthesizeRequest|StreamingSynthesizeRequest} for write() method, and
     *   will emit objects representing {@link protos.google.cloud.texttospeech.v1beta1.StreamingSynthesizeResponse|StreamingSynthesizeResponse} on 'data' event asynchronously.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#bi-directional-streaming | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1beta1/text_to_speech.streaming_synthesize.js</caption>
     * region_tag:texttospeech_v1beta1_generated_TextToSpeech_StreamingSynthesize_async
     */
    streamingSynthesize(options?: CallOptions): gax.CancellableStream;
    /**
     * Return a fully-qualified model resource name string.
     *
     * @param {string} project
     * @param {string} location
     * @param {string} model
     * @returns {string} Resource name string.
     */
    modelPath(project: string, location: string, model: string): string;
    /**
     * Parse the project from Model resource.
     *
     * @param {string} modelName
     *   A fully-qualified path representing Model resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromModelName(modelName: string): string | number;
    /**
     * Parse the location from Model resource.
     *
     * @param {string} modelName
     *   A fully-qualified path representing Model resource.
     * @returns {string} A string representing the location.
     */
    matchLocationFromModelName(modelName: string): string | number;
    /**
     * Parse the model from Model resource.
     *
     * @param {string} modelName
     *   A fully-qualified path representing Model resource.
     * @returns {string} A string representing the model.
     */
    matchModelFromModelName(modelName: string): string | number;
    /**
     * Terminate the gRPC channel and close the client.
     *
     * The client will no longer be usable and all future behavior is undefined.
     * @returns {Promise} A promise that resolves when the client is closed.
     */
    close(): Promise<void>;
}
