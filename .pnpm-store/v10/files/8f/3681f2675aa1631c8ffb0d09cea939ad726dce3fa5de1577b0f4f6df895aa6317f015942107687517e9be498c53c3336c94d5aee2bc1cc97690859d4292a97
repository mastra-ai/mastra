import type * as gax from 'google-gax';
import type { Callback, CallOptions, Descriptors, ClientOptions, LROperation } from 'google-gax';
import * as protos from '../../protos/protos';
/**
 *  Service that implements Google Cloud Text-to-Speech API.
 * @class
 * @memberof v1
 */
export declare class TextToSpeechLongAudioSynthesizeClient {
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
    operationsClient: gax.OperationsClient;
    textToSpeechLongAudioSynthesizeStub?: Promise<{
        [name: string]: Function;
    }>;
    /**
     * Construct an instance of TextToSpeechLongAudioSynthesizeClient.
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
     *     const client = new TextToSpeechLongAudioSynthesizeClient({fallback: true}, gax);
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
     * Synthesizes long form text asynchronously.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   The resource states of the request in the form of
     *   `projects/* /locations/*`.
     * @param {google.cloud.texttospeech.v1.SynthesisInput} request.input
     *   Required. The Synthesizer requires either plain text or SSML as input.
     * @param {google.cloud.texttospeech.v1.AudioConfig} request.audioConfig
     *   Required. The configuration of the synthesized audio.
     * @param {string} request.outputGcsUri
     *   Required. Specifies a Cloud Storage URI for the synthesis results. Must be
     *   specified in the format: `gs://bucket_name/object_name`, and the bucket
     *   must already exist.
     * @param {google.cloud.texttospeech.v1.VoiceSelectionParams} request.voice
     *   Required. The desired voice of the synthesized audio.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/text_to_speech_long_audio_synthesize.synthesize_long_audio.js</caption>
     * region_tag:texttospeech_v1_generated_TextToSpeechLongAudioSynthesize_SynthesizeLongAudio_async
     */
    synthesizeLongAudio(request?: protos.google.cloud.texttospeech.v1.ISynthesizeLongAudioRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.texttospeech.v1.ISynthesizeLongAudioResponse, protos.google.cloud.texttospeech.v1.ISynthesizeLongAudioMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    synthesizeLongAudio(request: protos.google.cloud.texttospeech.v1.ISynthesizeLongAudioRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.texttospeech.v1.ISynthesizeLongAudioResponse, protos.google.cloud.texttospeech.v1.ISynthesizeLongAudioMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    synthesizeLongAudio(request: protos.google.cloud.texttospeech.v1.ISynthesizeLongAudioRequest, callback: Callback<LROperation<protos.google.cloud.texttospeech.v1.ISynthesizeLongAudioResponse, protos.google.cloud.texttospeech.v1.ISynthesizeLongAudioMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `synthesizeLongAudio()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/text_to_speech_long_audio_synthesize.synthesize_long_audio.js</caption>
     * region_tag:texttospeech_v1_generated_TextToSpeechLongAudioSynthesize_SynthesizeLongAudio_async
     */
    checkSynthesizeLongAudioProgress(name: string): Promise<LROperation<protos.google.cloud.texttospeech.v1.SynthesizeLongAudioResponse, protos.google.cloud.texttospeech.v1.SynthesizeLongAudioMetadata>>;
    /**
       * Gets the latest state of a long-running operation.  Clients can use this
       * method to poll the operation result at intervals as recommended by the API
       * service.
       *
       * @param {Object} request - The request object that will be sent.
       * @param {string} request.name - The name of the operation resource.
       * @param {Object=} options
       *   Optional parameters. You can override the default settings for this call,
       *   e.g, timeout, retries, paginations, etc. See {@link
       *   https://googleapis.github.io/gax-nodejs/global.html#CallOptions | gax.CallOptions}
       *   for the details.
       * @param {function(?Error, ?Object)=} callback
       *   The function which will be called with the result of the API call.
       *
       *   The second parameter to the callback is an object representing
       *   {@link google.longrunning.Operation | google.longrunning.Operation}.
       * @return {Promise} - The promise which resolves to an array.
       *   The first element of the array is an object representing
       * {@link google.longrunning.Operation | google.longrunning.Operation}.
       * The promise has a method named "cancel" which cancels the ongoing API call.
       *
       * @example
       * ```
       * const client = longrunning.operationsClient();
       * const name = '';
       * const [response] = await client.getOperation({name});
       * // doThingsWith(response)
       * ```
       */
    getOperation(request: protos.google.longrunning.GetOperationRequest, optionsOrCallback?: gax.CallOptions | Callback<protos.google.longrunning.Operation, protos.google.longrunning.GetOperationRequest, {} | null | undefined>, callback?: Callback<protos.google.longrunning.Operation, protos.google.longrunning.GetOperationRequest, {} | null | undefined>): Promise<[protos.google.longrunning.Operation]>;
    /**
     * Lists operations that match the specified filter in the request. If the
     * server doesn't support this method, it returns `UNIMPLEMENTED`. Returns an iterable object.
     *
     * For-await-of syntax is used with the iterable to recursively get response element on-demand.
     *
     * @param {Object} request - The request object that will be sent.
     * @param {string} request.name - The name of the operation collection.
     * @param {string} request.filter - The standard list filter.
     * @param {number=} request.pageSize -
     *   The maximum number of resources contained in the underlying API
     *   response. If page streaming is performed per-resource, this
     *   parameter does not affect the return value. If page streaming is
     *   performed per-page, this determines the maximum number of
     *   resources in a page.
     * @param {Object=} options
     *   Optional parameters. You can override the default settings for this call,
     *   e.g, timeout, retries, paginations, etc. See {@link
     *   https://googleapis.github.io/gax-nodejs/global.html#CallOptions | gax.CallOptions} for the
     *   details.
     * @returns {Object}
     *   An iterable Object that conforms to {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | iteration protocols}.
     *
     * @example
     * ```
     * const client = longrunning.operationsClient();
     * for await (const response of client.listOperationsAsync(request));
     * // doThingsWith(response)
     * ```
     */
    listOperationsAsync(request: protos.google.longrunning.ListOperationsRequest, options?: gax.CallOptions): AsyncIterable<protos.google.longrunning.IOperation>;
    /**
     * Starts asynchronous cancellation on a long-running operation.  The server
     * makes a best effort to cancel the operation, but success is not
     * guaranteed.  If the server doesn't support this method, it returns
     * `google.rpc.Code.UNIMPLEMENTED`.  Clients can use
     * {@link Operations.GetOperation} or
     * other methods to check whether the cancellation succeeded or whether the
     * operation completed despite cancellation. On successful cancellation,
     * the operation is not deleted; instead, it becomes an operation with
     * an {@link Operation.error} value with a {@link google.rpc.Status.code} of
     * 1, corresponding to `Code.CANCELLED`.
     *
     * @param {Object} request - The request object that will be sent.
     * @param {string} request.name - The name of the operation resource to be cancelled.
     * @param {Object=} options
     *   Optional parameters. You can override the default settings for this call,
     * e.g, timeout, retries, paginations, etc. See {@link
     * https://googleapis.github.io/gax-nodejs/global.html#CallOptions | gax.CallOptions} for the
     * details.
     * @param {function(?Error)=} callback
     *   The function which will be called with the result of the API call.
     * @return {Promise} - The promise which resolves when API call finishes.
     *   The promise has a method named "cancel" which cancels the ongoing API
     * call.
     *
     * @example
     * ```
     * const client = longrunning.operationsClient();
     * await client.cancelOperation({name: ''});
     * ```
     */
    cancelOperation(request: protos.google.longrunning.CancelOperationRequest, optionsOrCallback?: gax.CallOptions | Callback<protos.google.longrunning.CancelOperationRequest, protos.google.protobuf.Empty, {} | undefined | null>, callback?: Callback<protos.google.longrunning.CancelOperationRequest, protos.google.protobuf.Empty, {} | undefined | null>): Promise<protos.google.protobuf.Empty>;
    /**
     * Deletes a long-running operation. This method indicates that the client is
     * no longer interested in the operation result. It does not cancel the
     * operation. If the server doesn't support this method, it returns
     * `google.rpc.Code.UNIMPLEMENTED`.
     *
     * @param {Object} request - The request object that will be sent.
     * @param {string} request.name - The name of the operation resource to be deleted.
     * @param {Object=} options
     *   Optional parameters. You can override the default settings for this call,
     * e.g, timeout, retries, paginations, etc. See {@link
     * https://googleapis.github.io/gax-nodejs/global.html#CallOptions | gax.CallOptions}
     * for the details.
     * @param {function(?Error)=} callback
     *   The function which will be called with the result of the API call.
     * @return {Promise} - The promise which resolves when API call finishes.
     *   The promise has a method named "cancel" which cancels the ongoing API
     * call.
     *
     * @example
     * ```
     * const client = longrunning.operationsClient();
     * await client.deleteOperation({name: ''});
     * ```
     */
    deleteOperation(request: protos.google.longrunning.DeleteOperationRequest, optionsOrCallback?: gax.CallOptions | Callback<protos.google.protobuf.Empty, protos.google.longrunning.DeleteOperationRequest, {} | null | undefined>, callback?: Callback<protos.google.protobuf.Empty, protos.google.longrunning.DeleteOperationRequest, {} | null | undefined>): Promise<protos.google.protobuf.Empty>;
    /**
     * Terminate the gRPC channel and close the client.
     *
     * The client will no longer be usable and all future behavior is undefined.
     * @returns {Promise} A promise that resolves when the client is closed.
     */
    close(): Promise<void>;
}
