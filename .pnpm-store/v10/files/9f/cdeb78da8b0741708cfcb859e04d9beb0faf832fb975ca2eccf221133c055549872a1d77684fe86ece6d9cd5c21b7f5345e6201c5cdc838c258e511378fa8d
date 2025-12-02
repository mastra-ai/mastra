import type * as gax from 'google-gax';
import type { Callback, CallOptions, Descriptors, ClientOptions, LROperation, PaginationCallback, LocationsClient, LocationProtos } from 'google-gax';
import { Transform } from 'stream';
import * as protos from '../../protos/protos';
/**
 *  Enables speech transcription and resource management.
 * @class
 * @memberof v2
 */
export declare class SpeechClient {
    private _terminated;
    private _opts;
    private _providedCustomServicePath;
    private _gaxModule;
    private _gaxGrpc;
    private _protos;
    private _defaults;
    private _universeDomain;
    private _servicePath;
    auth: gax.GoogleAuth;
    descriptors: Descriptors;
    warn: (code: string, message: string, warnType?: string) => void;
    innerApiCalls: {
        [name: string]: Function;
    };
    locationsClient: LocationsClient;
    pathTemplates: {
        [name: string]: gax.PathTemplate;
    };
    operationsClient: gax.OperationsClient;
    speechStub?: Promise<{
        [name: string]: Function;
    }>;
    /**
     * Construct an instance of SpeechClient.
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
     *     {@link https://developers.google.com/identity/protocols/application-default-credentials Application Default Credentials},
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
     *     const client = new SpeechClient({fallback: true}, gax);
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
     * Returns the requested
     * {@link protos.google.cloud.speech.v2.Recognizer|Recognizer}. Fails with
     * {@link protos.google.rpc.Code.NOT_FOUND|NOT_FOUND} if the requested Recognizer doesn't
     * exist.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the Recognizer to retrieve. The expected format is
     *   `projects/{project}/locations/{location}/recognizers/{recognizer}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v2.Recognizer|Recognizer}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.get_recognizer.js</caption>
     * region_tag:speech_v2_generated_Speech_GetRecognizer_async
     */
    getRecognizer(request?: protos.google.cloud.speech.v2.IGetRecognizerRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v2.IRecognizer,
        protos.google.cloud.speech.v2.IGetRecognizerRequest | undefined,
        {} | undefined
    ]>;
    getRecognizer(request: protos.google.cloud.speech.v2.IGetRecognizerRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IGetRecognizerRequest | null | undefined, {} | null | undefined>): void;
    getRecognizer(request: protos.google.cloud.speech.v2.IGetRecognizerRequest, callback: Callback<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IGetRecognizerRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Performs synchronous Speech recognition: receive results after all audio
     * has been sent and processed.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.recognizer
     *   Required. The name of the Recognizer to use during recognition. The
     *   expected format is
     *   `projects/{project}/locations/{location}/recognizers/{recognizer}`. The
     *   {recognizer} segment may be set to `_` to use an empty implicit Recognizer.
     * @param {google.cloud.speech.v2.RecognitionConfig} request.config
     *   Features and audio metadata to use for the Automatic Speech Recognition.
     *   This field in combination with the
     *   {@link protos.google.cloud.speech.v2.RecognizeRequest.config_mask|config_mask} field
     *   can be used to override parts of the
     *   {@link protos.google.cloud.speech.v2.Recognizer.default_recognition_config|default_recognition_config}
     *   of the Recognizer resource.
     * @param {google.protobuf.FieldMask} request.configMask
     *   The list of fields in
     *   {@link protos.google.cloud.speech.v2.RecognizeRequest.config|config} that override the
     *   values in the
     *   {@link protos.google.cloud.speech.v2.Recognizer.default_recognition_config|default_recognition_config}
     *   of the recognizer during this recognition request. If no mask is provided,
     *   all non-default valued fields in
     *   {@link protos.google.cloud.speech.v2.RecognizeRequest.config|config} override the
     *   values in the recognizer for this recognition request. If a mask is
     *   provided, only the fields listed in the mask override the config in the
     *   recognizer for this recognition request. If a wildcard (`*`) is provided,
     *   {@link protos.google.cloud.speech.v2.RecognizeRequest.config|config} completely
     *   overrides and replaces the config in the recognizer for this recognition
     *   request.
     * @param {Buffer} request.content
     *   The audio data bytes encoded as specified in
     *   {@link protos.google.cloud.speech.v2.RecognitionConfig|RecognitionConfig}. As
     *   with all bytes fields, proto buffers use a pure binary representation,
     *   whereas JSON representations use base64.
     * @param {string} request.uri
     *   URI that points to a file that contains audio data bytes as specified in
     *   {@link protos.google.cloud.speech.v2.RecognitionConfig|RecognitionConfig}. The file
     *   must not be compressed (for example, gzip). Currently, only Google Cloud
     *   Storage URIs are supported, which must be specified in the following
     *   format: `gs://bucket_name/object_name` (other URI formats return
     *   {@link protos.google.rpc.Code.INVALID_ARGUMENT|INVALID_ARGUMENT}). For more
     *   information, see [Request
     *   URIs](https://cloud.google.com/storage/docs/reference-uris).
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v2.RecognizeResponse|RecognizeResponse}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.recognize.js</caption>
     * region_tag:speech_v2_generated_Speech_Recognize_async
     */
    recognize(request?: protos.google.cloud.speech.v2.IRecognizeRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v2.IRecognizeResponse,
        protos.google.cloud.speech.v2.IRecognizeRequest | undefined,
        {} | undefined
    ]>;
    recognize(request: protos.google.cloud.speech.v2.IRecognizeRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v2.IRecognizeResponse, protos.google.cloud.speech.v2.IRecognizeRequest | null | undefined, {} | null | undefined>): void;
    recognize(request: protos.google.cloud.speech.v2.IRecognizeRequest, callback: Callback<protos.google.cloud.speech.v2.IRecognizeResponse, protos.google.cloud.speech.v2.IRecognizeRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Returns the requested {@link protos.google.cloud.speech.v2.Config|Config}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the config to retrieve. There is exactly one config
     *   resource per project per location. The expected format is
     *   `projects/{project}/locations/{location}/config`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v2.Config|Config}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.get_config.js</caption>
     * region_tag:speech_v2_generated_Speech_GetConfig_async
     */
    getConfig(request?: protos.google.cloud.speech.v2.IGetConfigRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v2.IConfig,
        protos.google.cloud.speech.v2.IGetConfigRequest | undefined,
        {} | undefined
    ]>;
    getConfig(request: protos.google.cloud.speech.v2.IGetConfigRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v2.IConfig, protos.google.cloud.speech.v2.IGetConfigRequest | null | undefined, {} | null | undefined>): void;
    getConfig(request: protos.google.cloud.speech.v2.IGetConfigRequest, callback: Callback<protos.google.cloud.speech.v2.IConfig, protos.google.cloud.speech.v2.IGetConfigRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Updates the {@link protos.google.cloud.speech.v2.Config|Config}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.cloud.speech.v2.Config} request.config
     *   Required. The config to update.
     *
     *   The config's `name` field is used to identify the config to be updated.
     *   The expected format is `projects/{project}/locations/{location}/config`.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   The list of fields to be updated.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v2.Config|Config}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.update_config.js</caption>
     * region_tag:speech_v2_generated_Speech_UpdateConfig_async
     */
    updateConfig(request?: protos.google.cloud.speech.v2.IUpdateConfigRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v2.IConfig,
        protos.google.cloud.speech.v2.IUpdateConfigRequest | undefined,
        {} | undefined
    ]>;
    updateConfig(request: protos.google.cloud.speech.v2.IUpdateConfigRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v2.IConfig, protos.google.cloud.speech.v2.IUpdateConfigRequest | null | undefined, {} | null | undefined>): void;
    updateConfig(request: protos.google.cloud.speech.v2.IUpdateConfigRequest, callback: Callback<protos.google.cloud.speech.v2.IConfig, protos.google.cloud.speech.v2.IUpdateConfigRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Returns the requested
     * {@link protos.google.cloud.speech.v2.CustomClass|CustomClass}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the CustomClass to retrieve. The expected format is
     *   `projects/{project}/locations/{location}/customClasses/{custom_class}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v2.CustomClass|CustomClass}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.get_custom_class.js</caption>
     * region_tag:speech_v2_generated_Speech_GetCustomClass_async
     */
    getCustomClass(request?: protos.google.cloud.speech.v2.IGetCustomClassRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v2.ICustomClass,
        protos.google.cloud.speech.v2.IGetCustomClassRequest | undefined,
        {} | undefined
    ]>;
    getCustomClass(request: protos.google.cloud.speech.v2.IGetCustomClassRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IGetCustomClassRequest | null | undefined, {} | null | undefined>): void;
    getCustomClass(request: protos.google.cloud.speech.v2.IGetCustomClassRequest, callback: Callback<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IGetCustomClassRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Returns the requested
     * {@link protos.google.cloud.speech.v2.PhraseSet|PhraseSet}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the PhraseSet to retrieve. The expected format is
     *   `projects/{project}/locations/{location}/phraseSets/{phrase_set}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v2.PhraseSet|PhraseSet}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.get_phrase_set.js</caption>
     * region_tag:speech_v2_generated_Speech_GetPhraseSet_async
     */
    getPhraseSet(request?: protos.google.cloud.speech.v2.IGetPhraseSetRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v2.IPhraseSet,
        protos.google.cloud.speech.v2.IGetPhraseSetRequest | undefined,
        {} | undefined
    ]>;
    getPhraseSet(request: protos.google.cloud.speech.v2.IGetPhraseSetRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IGetPhraseSetRequest | null | undefined, {} | null | undefined>): void;
    getPhraseSet(request: protos.google.cloud.speech.v2.IGetPhraseSetRequest, callback: Callback<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IGetPhraseSetRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Performs bidirectional streaming speech recognition: receive results while
     * sending audio. This method is only available via the gRPC API (not REST).
     *
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which is both readable and writable. It accepts objects
     *   representing {@link protos.google.cloud.speech.v2.StreamingRecognizeRequest|StreamingRecognizeRequest} for write() method, and
     *   will emit objects representing {@link protos.google.cloud.speech.v2.StreamingRecognizeResponse|StreamingRecognizeResponse} on 'data' event asynchronously.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#bi-directional-streaming | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.streaming_recognize.js</caption>
     * region_tag:speech_v2_generated_Speech_StreamingRecognize_async
     */
    _streamingRecognize(options?: CallOptions): gax.CancellableStream;
    /**
     * Creates a {@link protos.google.cloud.speech.v2.Recognizer|Recognizer}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.cloud.speech.v2.Recognizer} request.recognizer
     *   Required. The Recognizer to create.
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the Recognizer, but do not
     *   actually create it.
     * @param {string} request.recognizerId
     *   The ID to use for the Recognizer, which will become the final component of
     *   the Recognizer's resource name.
     *
     *   This value should be 4-63 characters, and valid characters
     *   are /{@link protos.0-9|a-z}-/.
     * @param {string} request.parent
     *   Required. The project and location where this Recognizer will be created.
     *   The expected format is `projects/{project}/locations/{location}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.create_recognizer.js</caption>
     * region_tag:speech_v2_generated_Speech_CreateRecognizer_async
     */
    createRecognizer(request?: protos.google.cloud.speech.v2.ICreateRecognizerRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    createRecognizer(request: protos.google.cloud.speech.v2.ICreateRecognizerRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    createRecognizer(request: protos.google.cloud.speech.v2.ICreateRecognizerRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `createRecognizer()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.create_recognizer.js</caption>
     * region_tag:speech_v2_generated_Speech_CreateRecognizer_async
     */
    checkCreateRecognizerProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.Recognizer, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Updates the {@link protos.google.cloud.speech.v2.Recognizer|Recognizer}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.cloud.speech.v2.Recognizer} request.recognizer
     *   Required. The Recognizer to update.
     *
     *   The Recognizer's `name` field is used to identify the Recognizer to update.
     *   Format: `projects/{project}/locations/{location}/recognizers/{recognizer}`.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   The list of fields to update. If empty, all non-default valued fields are
     *   considered for update. Use `*` to update the entire Recognizer resource.
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the updated Recognizer, but do not
     *   actually update it.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.update_recognizer.js</caption>
     * region_tag:speech_v2_generated_Speech_UpdateRecognizer_async
     */
    updateRecognizer(request?: protos.google.cloud.speech.v2.IUpdateRecognizerRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    updateRecognizer(request: protos.google.cloud.speech.v2.IUpdateRecognizerRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    updateRecognizer(request: protos.google.cloud.speech.v2.IUpdateRecognizerRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `updateRecognizer()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.update_recognizer.js</caption>
     * region_tag:speech_v2_generated_Speech_UpdateRecognizer_async
     */
    checkUpdateRecognizerProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.Recognizer, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Deletes the {@link protos.google.cloud.speech.v2.Recognizer|Recognizer}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the Recognizer to delete.
     *   Format: `projects/{project}/locations/{location}/recognizers/{recognizer}`
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the deleted Recognizer, but do not
     *   actually delete it.
     * @param {boolean} request.allowMissing
     *   If set to true, and the Recognizer is not found, the request will succeed
     *   and  be a no-op (no Operation is recorded in this case).
     * @param {string} request.etag
     *   This checksum is computed by the server based on the value of other
     *   fields. This may be sent on update, undelete, and delete requests to ensure
     *   the client has an up-to-date value before proceeding.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.delete_recognizer.js</caption>
     * region_tag:speech_v2_generated_Speech_DeleteRecognizer_async
     */
    deleteRecognizer(request?: protos.google.cloud.speech.v2.IDeleteRecognizerRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    deleteRecognizer(request: protos.google.cloud.speech.v2.IDeleteRecognizerRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    deleteRecognizer(request: protos.google.cloud.speech.v2.IDeleteRecognizerRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `deleteRecognizer()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.delete_recognizer.js</caption>
     * region_tag:speech_v2_generated_Speech_DeleteRecognizer_async
     */
    checkDeleteRecognizerProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.Recognizer, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Undeletes the {@link protos.google.cloud.speech.v2.Recognizer|Recognizer}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the Recognizer to undelete.
     *   Format: `projects/{project}/locations/{location}/recognizers/{recognizer}`
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the undeleted Recognizer, but do
     *   not actually undelete it.
     * @param {string} request.etag
     *   This checksum is computed by the server based on the value of other
     *   fields. This may be sent on update, undelete, and delete requests to ensure
     *   the client has an up-to-date value before proceeding.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.undelete_recognizer.js</caption>
     * region_tag:speech_v2_generated_Speech_UndeleteRecognizer_async
     */
    undeleteRecognizer(request?: protos.google.cloud.speech.v2.IUndeleteRecognizerRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    undeleteRecognizer(request: protos.google.cloud.speech.v2.IUndeleteRecognizerRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    undeleteRecognizer(request: protos.google.cloud.speech.v2.IUndeleteRecognizerRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.IRecognizer, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `undeleteRecognizer()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.undelete_recognizer.js</caption>
     * region_tag:speech_v2_generated_Speech_UndeleteRecognizer_async
     */
    checkUndeleteRecognizerProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.Recognizer, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Performs batch asynchronous speech recognition: send a request with N
     * audio files and receive a long running operation that can be polled to see
     * when the transcriptions are finished.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.recognizer
     *   Required. The name of the Recognizer to use during recognition. The
     *   expected format is
     *   `projects/{project}/locations/{location}/recognizers/{recognizer}`. The
     *   {recognizer} segment may be set to `_` to use an empty implicit Recognizer.
     * @param {google.cloud.speech.v2.RecognitionConfig} request.config
     *   Features and audio metadata to use for the Automatic Speech Recognition.
     *   This field in combination with the
     *   {@link protos.google.cloud.speech.v2.BatchRecognizeRequest.config_mask|config_mask}
     *   field can be used to override parts of the
     *   {@link protos.google.cloud.speech.v2.Recognizer.default_recognition_config|default_recognition_config}
     *   of the Recognizer resource.
     * @param {google.protobuf.FieldMask} request.configMask
     *   The list of fields in
     *   {@link protos.google.cloud.speech.v2.BatchRecognizeRequest.config|config} that override
     *   the values in the
     *   {@link protos.google.cloud.speech.v2.Recognizer.default_recognition_config|default_recognition_config}
     *   of the recognizer during this recognition request. If no mask is provided,
     *   all given fields in
     *   {@link protos.google.cloud.speech.v2.BatchRecognizeRequest.config|config} override the
     *   values in the recognizer for this recognition request. If a mask is
     *   provided, only the fields listed in the mask override the config in the
     *   recognizer for this recognition request. If a wildcard (`*`) is provided,
     *   {@link protos.google.cloud.speech.v2.BatchRecognizeRequest.config|config} completely
     *   overrides and replaces the config in the recognizer for this recognition
     *   request.
     * @param {number[]} request.files
     *   Audio files with file metadata for ASR.
     *   The maximum number of files allowed to be specified is 15.
     * @param {google.cloud.speech.v2.RecognitionOutputConfig} request.recognitionOutputConfig
     *   Configuration options for where to output the transcripts of each file.
     * @param {google.cloud.speech.v2.BatchRecognizeRequest.ProcessingStrategy} request.processingStrategy
     *   Processing strategy to use for this request.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.batch_recognize.js</caption>
     * region_tag:speech_v2_generated_Speech_BatchRecognize_async
     */
    batchRecognize(request?: protos.google.cloud.speech.v2.IBatchRecognizeRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.IBatchRecognizeResponse, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    batchRecognize(request: protos.google.cloud.speech.v2.IBatchRecognizeRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.IBatchRecognizeResponse, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    batchRecognize(request: protos.google.cloud.speech.v2.IBatchRecognizeRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.IBatchRecognizeResponse, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `batchRecognize()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.batch_recognize.js</caption>
     * region_tag:speech_v2_generated_Speech_BatchRecognize_async
     */
    checkBatchRecognizeProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.BatchRecognizeResponse, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Creates a {@link protos.google.cloud.speech.v2.CustomClass|CustomClass}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.cloud.speech.v2.CustomClass} request.customClass
     *   Required. The CustomClass to create.
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the CustomClass, but do not
     *   actually create it.
     * @param {string} request.customClassId
     *   The ID to use for the CustomClass, which will become the final component of
     *   the CustomClass's resource name.
     *
     *   This value should be 4-63 characters, and valid characters
     *   are /{@link protos.0-9|a-z}-/.
     * @param {string} request.parent
     *   Required. The project and location where this CustomClass will be created.
     *   The expected format is `projects/{project}/locations/{location}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.create_custom_class.js</caption>
     * region_tag:speech_v2_generated_Speech_CreateCustomClass_async
     */
    createCustomClass(request?: protos.google.cloud.speech.v2.ICreateCustomClassRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    createCustomClass(request: protos.google.cloud.speech.v2.ICreateCustomClassRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    createCustomClass(request: protos.google.cloud.speech.v2.ICreateCustomClassRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `createCustomClass()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.create_custom_class.js</caption>
     * region_tag:speech_v2_generated_Speech_CreateCustomClass_async
     */
    checkCreateCustomClassProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.CustomClass, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Updates the {@link protos.google.cloud.speech.v2.CustomClass|CustomClass}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.cloud.speech.v2.CustomClass} request.customClass
     *   Required. The CustomClass to update.
     *
     *   The CustomClass's `name` field is used to identify the CustomClass to
     *   update. Format:
     *   `projects/{project}/locations/{location}/customClasses/{custom_class}`.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   The list of fields to be updated. If empty, all fields are considered for
     *   update.
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the updated CustomClass, but do
     *   not actually update it.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.update_custom_class.js</caption>
     * region_tag:speech_v2_generated_Speech_UpdateCustomClass_async
     */
    updateCustomClass(request?: protos.google.cloud.speech.v2.IUpdateCustomClassRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    updateCustomClass(request: protos.google.cloud.speech.v2.IUpdateCustomClassRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    updateCustomClass(request: protos.google.cloud.speech.v2.IUpdateCustomClassRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `updateCustomClass()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.update_custom_class.js</caption>
     * region_tag:speech_v2_generated_Speech_UpdateCustomClass_async
     */
    checkUpdateCustomClassProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.CustomClass, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Deletes the {@link protos.google.cloud.speech.v2.CustomClass|CustomClass}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the CustomClass to delete.
     *   Format:
     *   `projects/{project}/locations/{location}/customClasses/{custom_class}`
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the deleted CustomClass, but do
     *   not actually delete it.
     * @param {boolean} request.allowMissing
     *   If set to true, and the CustomClass is not found, the request will succeed
     *   and  be a no-op (no Operation is recorded in this case).
     * @param {string} request.etag
     *   This checksum is computed by the server based on the value of other
     *   fields. This may be sent on update, undelete, and delete requests to ensure
     *   the client has an up-to-date value before proceeding.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.delete_custom_class.js</caption>
     * region_tag:speech_v2_generated_Speech_DeleteCustomClass_async
     */
    deleteCustomClass(request?: protos.google.cloud.speech.v2.IDeleteCustomClassRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    deleteCustomClass(request: protos.google.cloud.speech.v2.IDeleteCustomClassRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    deleteCustomClass(request: protos.google.cloud.speech.v2.IDeleteCustomClassRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `deleteCustomClass()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.delete_custom_class.js</caption>
     * region_tag:speech_v2_generated_Speech_DeleteCustomClass_async
     */
    checkDeleteCustomClassProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.CustomClass, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Undeletes the {@link protos.google.cloud.speech.v2.CustomClass|CustomClass}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the CustomClass to undelete.
     *   Format:
     *   `projects/{project}/locations/{location}/customClasses/{custom_class}`
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the undeleted CustomClass, but do
     *   not actually undelete it.
     * @param {string} request.etag
     *   This checksum is computed by the server based on the value of other
     *   fields. This may be sent on update, undelete, and delete requests to ensure
     *   the client has an up-to-date value before proceeding.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.undelete_custom_class.js</caption>
     * region_tag:speech_v2_generated_Speech_UndeleteCustomClass_async
     */
    undeleteCustomClass(request?: protos.google.cloud.speech.v2.IUndeleteCustomClassRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    undeleteCustomClass(request: protos.google.cloud.speech.v2.IUndeleteCustomClassRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    undeleteCustomClass(request: protos.google.cloud.speech.v2.IUndeleteCustomClassRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.ICustomClass, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `undeleteCustomClass()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.undelete_custom_class.js</caption>
     * region_tag:speech_v2_generated_Speech_UndeleteCustomClass_async
     */
    checkUndeleteCustomClassProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.CustomClass, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Creates a {@link protos.google.cloud.speech.v2.PhraseSet|PhraseSet}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.cloud.speech.v2.PhraseSet} request.phraseSet
     *   Required. The PhraseSet to create.
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the PhraseSet, but do not
     *   actually create it.
     * @param {string} request.phraseSetId
     *   The ID to use for the PhraseSet, which will become the final component of
     *   the PhraseSet's resource name.
     *
     *   This value should be 4-63 characters, and valid characters
     *   are /{@link protos.0-9|a-z}-/.
     * @param {string} request.parent
     *   Required. The project and location where this PhraseSet will be created.
     *   The expected format is `projects/{project}/locations/{location}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.create_phrase_set.js</caption>
     * region_tag:speech_v2_generated_Speech_CreatePhraseSet_async
     */
    createPhraseSet(request?: protos.google.cloud.speech.v2.ICreatePhraseSetRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    createPhraseSet(request: protos.google.cloud.speech.v2.ICreatePhraseSetRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    createPhraseSet(request: protos.google.cloud.speech.v2.ICreatePhraseSetRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `createPhraseSet()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.create_phrase_set.js</caption>
     * region_tag:speech_v2_generated_Speech_CreatePhraseSet_async
     */
    checkCreatePhraseSetProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.PhraseSet, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Updates the {@link protos.google.cloud.speech.v2.PhraseSet|PhraseSet}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.cloud.speech.v2.PhraseSet} request.phraseSet
     *   Required. The PhraseSet to update.
     *
     *   The PhraseSet's `name` field is used to identify the PhraseSet to update.
     *   Format: `projects/{project}/locations/{location}/phraseSets/{phrase_set}`.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   The list of fields to update. If empty, all non-default valued fields are
     *   considered for update. Use `*` to update the entire PhraseSet resource.
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the updated PhraseSet, but do not
     *   actually update it.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.update_phrase_set.js</caption>
     * region_tag:speech_v2_generated_Speech_UpdatePhraseSet_async
     */
    updatePhraseSet(request?: protos.google.cloud.speech.v2.IUpdatePhraseSetRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    updatePhraseSet(request: protos.google.cloud.speech.v2.IUpdatePhraseSetRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    updatePhraseSet(request: protos.google.cloud.speech.v2.IUpdatePhraseSetRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `updatePhraseSet()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.update_phrase_set.js</caption>
     * region_tag:speech_v2_generated_Speech_UpdatePhraseSet_async
     */
    checkUpdatePhraseSetProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.PhraseSet, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Deletes the {@link protos.google.cloud.speech.v2.PhraseSet|PhraseSet}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the PhraseSet to delete.
     *   Format: `projects/{project}/locations/{location}/phraseSets/{phrase_set}`
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the deleted PhraseSet, but do not
     *   actually delete it.
     * @param {boolean} request.allowMissing
     *   If set to true, and the PhraseSet is not found, the request will succeed
     *   and  be a no-op (no Operation is recorded in this case).
     * @param {string} request.etag
     *   This checksum is computed by the server based on the value of other
     *   fields. This may be sent on update, undelete, and delete requests to ensure
     *   the client has an up-to-date value before proceeding.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.delete_phrase_set.js</caption>
     * region_tag:speech_v2_generated_Speech_DeletePhraseSet_async
     */
    deletePhraseSet(request?: protos.google.cloud.speech.v2.IDeletePhraseSetRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    deletePhraseSet(request: protos.google.cloud.speech.v2.IDeletePhraseSetRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    deletePhraseSet(request: protos.google.cloud.speech.v2.IDeletePhraseSetRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `deletePhraseSet()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.delete_phrase_set.js</caption>
     * region_tag:speech_v2_generated_Speech_DeletePhraseSet_async
     */
    checkDeletePhraseSetProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.PhraseSet, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Undeletes the {@link protos.google.cloud.speech.v2.PhraseSet|PhraseSet}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the PhraseSet to undelete.
     *   Format: `projects/{project}/locations/{location}/phraseSets/{phrase_set}`
     * @param {boolean} request.validateOnly
     *   If set, validate the request and preview the undeleted PhraseSet, but do
     *   not actually undelete it.
     * @param {string} request.etag
     *   This checksum is computed by the server based on the value of other
     *   fields. This may be sent on update, undelete, and delete requests to ensure
     *   the client has an up-to-date value before proceeding.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.undelete_phrase_set.js</caption>
     * region_tag:speech_v2_generated_Speech_UndeletePhraseSet_async
     */
    undeletePhraseSet(request?: protos.google.cloud.speech.v2.IUndeletePhraseSetRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    undeletePhraseSet(request: protos.google.cloud.speech.v2.IUndeletePhraseSetRequest, options: CallOptions, callback: Callback<LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    undeletePhraseSet(request: protos.google.cloud.speech.v2.IUndeletePhraseSetRequest, callback: Callback<LROperation<protos.google.cloud.speech.v2.IPhraseSet, protos.google.cloud.speech.v2.IOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `undeletePhraseSet()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.undelete_phrase_set.js</caption>
     * region_tag:speech_v2_generated_Speech_UndeletePhraseSet_async
     */
    checkUndeletePhraseSetProgress(name: string): Promise<LROperation<protos.google.cloud.speech.v2.PhraseSet, protos.google.cloud.speech.v2.OperationMetadata>>;
    /**
     * Lists Recognizers.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The project and location of Recognizers to list. The expected
     *   format is `projects/{project}/locations/{location}`.
     * @param {number} request.pageSize
     *   The maximum number of Recognizers to return. The service may return fewer
     *   than this value. If unspecified, at most 5 Recognizers will be returned.
     *   The maximum value is 100; values above 100 will be coerced to 100.
     * @param {string} request.pageToken
     *   A page token, received from a previous
     *   {@link protos.google.cloud.speech.v2.Speech.ListRecognizers|ListRecognizers} call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to
     *   {@link protos.google.cloud.speech.v2.Speech.ListRecognizers|ListRecognizers} must match
     *   the call that provided the page token.
     * @param {boolean} request.showDeleted
     *   Whether, or not, to show resources that have been deleted.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of {@link protos.google.cloud.speech.v2.Recognizer|Recognizer}.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listRecognizersAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listRecognizers(request?: protos.google.cloud.speech.v2.IListRecognizersRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v2.IRecognizer[],
        protos.google.cloud.speech.v2.IListRecognizersRequest | null,
        protos.google.cloud.speech.v2.IListRecognizersResponse
    ]>;
    listRecognizers(request: protos.google.cloud.speech.v2.IListRecognizersRequest, options: CallOptions, callback: PaginationCallback<protos.google.cloud.speech.v2.IListRecognizersRequest, protos.google.cloud.speech.v2.IListRecognizersResponse | null | undefined, protos.google.cloud.speech.v2.IRecognizer>): void;
    listRecognizers(request: protos.google.cloud.speech.v2.IListRecognizersRequest, callback: PaginationCallback<protos.google.cloud.speech.v2.IListRecognizersRequest, protos.google.cloud.speech.v2.IListRecognizersResponse | null | undefined, protos.google.cloud.speech.v2.IRecognizer>): void;
    /**
     * Equivalent to `listRecognizers`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The project and location of Recognizers to list. The expected
     *   format is `projects/{project}/locations/{location}`.
     * @param {number} request.pageSize
     *   The maximum number of Recognizers to return. The service may return fewer
     *   than this value. If unspecified, at most 5 Recognizers will be returned.
     *   The maximum value is 100; values above 100 will be coerced to 100.
     * @param {string} request.pageToken
     *   A page token, received from a previous
     *   {@link protos.google.cloud.speech.v2.Speech.ListRecognizers|ListRecognizers} call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to
     *   {@link protos.google.cloud.speech.v2.Speech.ListRecognizers|ListRecognizers} must match
     *   the call that provided the page token.
     * @param {boolean} request.showDeleted
     *   Whether, or not, to show resources that have been deleted.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing {@link protos.google.cloud.speech.v2.Recognizer|Recognizer} on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listRecognizersAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listRecognizersStream(request?: protos.google.cloud.speech.v2.IListRecognizersRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listRecognizers`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The project and location of Recognizers to list. The expected
     *   format is `projects/{project}/locations/{location}`.
     * @param {number} request.pageSize
     *   The maximum number of Recognizers to return. The service may return fewer
     *   than this value. If unspecified, at most 5 Recognizers will be returned.
     *   The maximum value is 100; values above 100 will be coerced to 100.
     * @param {string} request.pageToken
     *   A page token, received from a previous
     *   {@link protos.google.cloud.speech.v2.Speech.ListRecognizers|ListRecognizers} call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to
     *   {@link protos.google.cloud.speech.v2.Speech.ListRecognizers|ListRecognizers} must match
     *   the call that provided the page token.
     * @param {boolean} request.showDeleted
     *   Whether, or not, to show resources that have been deleted.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   {@link protos.google.cloud.speech.v2.Recognizer|Recognizer}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.list_recognizers.js</caption>
     * region_tag:speech_v2_generated_Speech_ListRecognizers_async
     */
    listRecognizersAsync(request?: protos.google.cloud.speech.v2.IListRecognizersRequest, options?: CallOptions): AsyncIterable<protos.google.cloud.speech.v2.IRecognizer>;
    /**
     * Lists CustomClasses.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The project and location of CustomClass resources to list. The
     *   expected format is `projects/{project}/locations/{location}`.
     * @param {number} request.pageSize
     *   Number of results per requests. A valid page_size ranges from 0 to 100
     *   inclusive. If the page_size is zero or unspecified, a page size of 5 will
     *   be chosen. If the page size exceeds 100, it will be coerced down to 100.
     *   Note that a call might return fewer results than the requested page size.
     * @param {string} request.pageToken
     *   A page token, received from a previous
     *   {@link protos.google.cloud.speech.v2.Speech.ListCustomClasses|ListCustomClasses} call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to
     *   {@link protos.google.cloud.speech.v2.Speech.ListCustomClasses|ListCustomClasses} must
     *   match the call that provided the page token.
     * @param {boolean} request.showDeleted
     *   Whether, or not, to show resources that have been deleted.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of {@link protos.google.cloud.speech.v2.CustomClass|CustomClass}.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listCustomClassesAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listCustomClasses(request?: protos.google.cloud.speech.v2.IListCustomClassesRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v2.ICustomClass[],
        protos.google.cloud.speech.v2.IListCustomClassesRequest | null,
        protos.google.cloud.speech.v2.IListCustomClassesResponse
    ]>;
    listCustomClasses(request: protos.google.cloud.speech.v2.IListCustomClassesRequest, options: CallOptions, callback: PaginationCallback<protos.google.cloud.speech.v2.IListCustomClassesRequest, protos.google.cloud.speech.v2.IListCustomClassesResponse | null | undefined, protos.google.cloud.speech.v2.ICustomClass>): void;
    listCustomClasses(request: protos.google.cloud.speech.v2.IListCustomClassesRequest, callback: PaginationCallback<protos.google.cloud.speech.v2.IListCustomClassesRequest, protos.google.cloud.speech.v2.IListCustomClassesResponse | null | undefined, protos.google.cloud.speech.v2.ICustomClass>): void;
    /**
     * Equivalent to `listCustomClasses`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The project and location of CustomClass resources to list. The
     *   expected format is `projects/{project}/locations/{location}`.
     * @param {number} request.pageSize
     *   Number of results per requests. A valid page_size ranges from 0 to 100
     *   inclusive. If the page_size is zero or unspecified, a page size of 5 will
     *   be chosen. If the page size exceeds 100, it will be coerced down to 100.
     *   Note that a call might return fewer results than the requested page size.
     * @param {string} request.pageToken
     *   A page token, received from a previous
     *   {@link protos.google.cloud.speech.v2.Speech.ListCustomClasses|ListCustomClasses} call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to
     *   {@link protos.google.cloud.speech.v2.Speech.ListCustomClasses|ListCustomClasses} must
     *   match the call that provided the page token.
     * @param {boolean} request.showDeleted
     *   Whether, or not, to show resources that have been deleted.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing {@link protos.google.cloud.speech.v2.CustomClass|CustomClass} on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listCustomClassesAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listCustomClassesStream(request?: protos.google.cloud.speech.v2.IListCustomClassesRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listCustomClasses`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The project and location of CustomClass resources to list. The
     *   expected format is `projects/{project}/locations/{location}`.
     * @param {number} request.pageSize
     *   Number of results per requests. A valid page_size ranges from 0 to 100
     *   inclusive. If the page_size is zero or unspecified, a page size of 5 will
     *   be chosen. If the page size exceeds 100, it will be coerced down to 100.
     *   Note that a call might return fewer results than the requested page size.
     * @param {string} request.pageToken
     *   A page token, received from a previous
     *   {@link protos.google.cloud.speech.v2.Speech.ListCustomClasses|ListCustomClasses} call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to
     *   {@link protos.google.cloud.speech.v2.Speech.ListCustomClasses|ListCustomClasses} must
     *   match the call that provided the page token.
     * @param {boolean} request.showDeleted
     *   Whether, or not, to show resources that have been deleted.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   {@link protos.google.cloud.speech.v2.CustomClass|CustomClass}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.list_custom_classes.js</caption>
     * region_tag:speech_v2_generated_Speech_ListCustomClasses_async
     */
    listCustomClassesAsync(request?: protos.google.cloud.speech.v2.IListCustomClassesRequest, options?: CallOptions): AsyncIterable<protos.google.cloud.speech.v2.ICustomClass>;
    /**
     * Lists PhraseSets.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The project and location of PhraseSet resources to list. The
     *   expected format is `projects/{project}/locations/{location}`.
     * @param {number} request.pageSize
     *   The maximum number of PhraseSets to return. The service may return fewer
     *   than this value. If unspecified, at most 5 PhraseSets will be returned.
     *   The maximum value is 100; values above 100 will be coerced to 100.
     * @param {string} request.pageToken
     *   A page token, received from a previous
     *   {@link protos.google.cloud.speech.v2.Speech.ListPhraseSets|ListPhraseSets} call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to
     *   {@link protos.google.cloud.speech.v2.Speech.ListPhraseSets|ListPhraseSets} must match
     *   the call that provided the page token.
     * @param {boolean} request.showDeleted
     *   Whether, or not, to show resources that have been deleted.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of {@link protos.google.cloud.speech.v2.PhraseSet|PhraseSet}.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listPhraseSetsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listPhraseSets(request?: protos.google.cloud.speech.v2.IListPhraseSetsRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v2.IPhraseSet[],
        protos.google.cloud.speech.v2.IListPhraseSetsRequest | null,
        protos.google.cloud.speech.v2.IListPhraseSetsResponse
    ]>;
    listPhraseSets(request: protos.google.cloud.speech.v2.IListPhraseSetsRequest, options: CallOptions, callback: PaginationCallback<protos.google.cloud.speech.v2.IListPhraseSetsRequest, protos.google.cloud.speech.v2.IListPhraseSetsResponse | null | undefined, protos.google.cloud.speech.v2.IPhraseSet>): void;
    listPhraseSets(request: protos.google.cloud.speech.v2.IListPhraseSetsRequest, callback: PaginationCallback<protos.google.cloud.speech.v2.IListPhraseSetsRequest, protos.google.cloud.speech.v2.IListPhraseSetsResponse | null | undefined, protos.google.cloud.speech.v2.IPhraseSet>): void;
    /**
     * Equivalent to `listPhraseSets`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The project and location of PhraseSet resources to list. The
     *   expected format is `projects/{project}/locations/{location}`.
     * @param {number} request.pageSize
     *   The maximum number of PhraseSets to return. The service may return fewer
     *   than this value. If unspecified, at most 5 PhraseSets will be returned.
     *   The maximum value is 100; values above 100 will be coerced to 100.
     * @param {string} request.pageToken
     *   A page token, received from a previous
     *   {@link protos.google.cloud.speech.v2.Speech.ListPhraseSets|ListPhraseSets} call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to
     *   {@link protos.google.cloud.speech.v2.Speech.ListPhraseSets|ListPhraseSets} must match
     *   the call that provided the page token.
     * @param {boolean} request.showDeleted
     *   Whether, or not, to show resources that have been deleted.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing {@link protos.google.cloud.speech.v2.PhraseSet|PhraseSet} on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listPhraseSetsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listPhraseSetsStream(request?: protos.google.cloud.speech.v2.IListPhraseSetsRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listPhraseSets`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The project and location of PhraseSet resources to list. The
     *   expected format is `projects/{project}/locations/{location}`.
     * @param {number} request.pageSize
     *   The maximum number of PhraseSets to return. The service may return fewer
     *   than this value. If unspecified, at most 5 PhraseSets will be returned.
     *   The maximum value is 100; values above 100 will be coerced to 100.
     * @param {string} request.pageToken
     *   A page token, received from a previous
     *   {@link protos.google.cloud.speech.v2.Speech.ListPhraseSets|ListPhraseSets} call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to
     *   {@link protos.google.cloud.speech.v2.Speech.ListPhraseSets|ListPhraseSets} must match
     *   the call that provided the page token.
     * @param {boolean} request.showDeleted
     *   Whether, or not, to show resources that have been deleted.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   {@link protos.google.cloud.speech.v2.PhraseSet|PhraseSet}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v2/speech.list_phrase_sets.js</caption>
     * region_tag:speech_v2_generated_Speech_ListPhraseSets_async
     */
    listPhraseSetsAsync(request?: protos.google.cloud.speech.v2.IListPhraseSetsRequest, options?: CallOptions): AsyncIterable<protos.google.cloud.speech.v2.IPhraseSet>;
    /**
     * Gets information about a location.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Resource name for the location.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html | CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link google.cloud.location.Location | Location}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example
     * ```
     * const [response] = await client.getLocation(request);
     * ```
     */
    getLocation(request: LocationProtos.google.cloud.location.IGetLocationRequest, options?: gax.CallOptions | Callback<LocationProtos.google.cloud.location.ILocation, LocationProtos.google.cloud.location.IGetLocationRequest | null | undefined, {} | null | undefined>, callback?: Callback<LocationProtos.google.cloud.location.ILocation, LocationProtos.google.cloud.location.IGetLocationRequest | null | undefined, {} | null | undefined>): Promise<LocationProtos.google.cloud.location.ILocation>;
    /**
     * Lists information about the supported locations for this service. Returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   The resource that owns the locations collection, if applicable.
     * @param {string} request.filter
     *   The standard list filter.
     * @param {number} request.pageSize
     *   The standard list page size.
     * @param {string} request.pageToken
     *   The standard list page token.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   {@link google.cloud.location.Location | Location}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     * @example
     * ```
     * const iterable = client.listLocationsAsync(request);
     * for await (const response of iterable) {
     *   // process response
     * }
     * ```
     */
    listLocationsAsync(request: LocationProtos.google.cloud.location.IListLocationsRequest, options?: CallOptions): AsyncIterable<LocationProtos.google.cloud.location.ILocation>;
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
    listOperationsAsync(request: protos.google.longrunning.ListOperationsRequest, options?: gax.CallOptions): AsyncIterable<protos.google.longrunning.ListOperationsResponse>;
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
     * Return a fully-qualified config resource name string.
     *
     * @param {string} project
     * @param {string} location
     * @returns {string} Resource name string.
     */
    configPath(project: string, location: string): string;
    /**
     * Parse the project from Config resource.
     *
     * @param {string} configName
     *   A fully-qualified path representing Config resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromConfigName(configName: string): string | number;
    /**
     * Parse the location from Config resource.
     *
     * @param {string} configName
     *   A fully-qualified path representing Config resource.
     * @returns {string} A string representing the location.
     */
    matchLocationFromConfigName(configName: string): string | number;
    /**
     * Return a fully-qualified cryptoKey resource name string.
     *
     * @param {string} project
     * @param {string} location
     * @param {string} key_ring
     * @param {string} crypto_key
     * @returns {string} Resource name string.
     */
    cryptoKeyPath(project: string, location: string, keyRing: string, cryptoKey: string): string;
    /**
     * Parse the project from CryptoKey resource.
     *
     * @param {string} cryptoKeyName
     *   A fully-qualified path representing CryptoKey resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromCryptoKeyName(cryptoKeyName: string): string | number;
    /**
     * Parse the location from CryptoKey resource.
     *
     * @param {string} cryptoKeyName
     *   A fully-qualified path representing CryptoKey resource.
     * @returns {string} A string representing the location.
     */
    matchLocationFromCryptoKeyName(cryptoKeyName: string): string | number;
    /**
     * Parse the key_ring from CryptoKey resource.
     *
     * @param {string} cryptoKeyName
     *   A fully-qualified path representing CryptoKey resource.
     * @returns {string} A string representing the key_ring.
     */
    matchKeyRingFromCryptoKeyName(cryptoKeyName: string): string | number;
    /**
     * Parse the crypto_key from CryptoKey resource.
     *
     * @param {string} cryptoKeyName
     *   A fully-qualified path representing CryptoKey resource.
     * @returns {string} A string representing the crypto_key.
     */
    matchCryptoKeyFromCryptoKeyName(cryptoKeyName: string): string | number;
    /**
     * Return a fully-qualified cryptoKeyVersion resource name string.
     *
     * @param {string} project
     * @param {string} location
     * @param {string} key_ring
     * @param {string} crypto_key
     * @param {string} crypto_key_version
     * @returns {string} Resource name string.
     */
    cryptoKeyVersionPath(project: string, location: string, keyRing: string, cryptoKey: string, cryptoKeyVersion: string): string;
    /**
     * Parse the project from CryptoKeyVersion resource.
     *
     * @param {string} cryptoKeyVersionName
     *   A fully-qualified path representing CryptoKeyVersion resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromCryptoKeyVersionName(cryptoKeyVersionName: string): string | number;
    /**
     * Parse the location from CryptoKeyVersion resource.
     *
     * @param {string} cryptoKeyVersionName
     *   A fully-qualified path representing CryptoKeyVersion resource.
     * @returns {string} A string representing the location.
     */
    matchLocationFromCryptoKeyVersionName(cryptoKeyVersionName: string): string | number;
    /**
     * Parse the key_ring from CryptoKeyVersion resource.
     *
     * @param {string} cryptoKeyVersionName
     *   A fully-qualified path representing CryptoKeyVersion resource.
     * @returns {string} A string representing the key_ring.
     */
    matchKeyRingFromCryptoKeyVersionName(cryptoKeyVersionName: string): string | number;
    /**
     * Parse the crypto_key from CryptoKeyVersion resource.
     *
     * @param {string} cryptoKeyVersionName
     *   A fully-qualified path representing CryptoKeyVersion resource.
     * @returns {string} A string representing the crypto_key.
     */
    matchCryptoKeyFromCryptoKeyVersionName(cryptoKeyVersionName: string): string | number;
    /**
     * Parse the crypto_key_version from CryptoKeyVersion resource.
     *
     * @param {string} cryptoKeyVersionName
     *   A fully-qualified path representing CryptoKeyVersion resource.
     * @returns {string} A string representing the crypto_key_version.
     */
    matchCryptoKeyVersionFromCryptoKeyVersionName(cryptoKeyVersionName: string): string | number;
    /**
     * Return a fully-qualified customClass resource name string.
     *
     * @param {string} project
     * @param {string} location
     * @param {string} custom_class
     * @returns {string} Resource name string.
     */
    customClassPath(project: string, location: string, customClass: string): string;
    /**
     * Parse the project from CustomClass resource.
     *
     * @param {string} customClassName
     *   A fully-qualified path representing CustomClass resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromCustomClassName(customClassName: string): string | number;
    /**
     * Parse the location from CustomClass resource.
     *
     * @param {string} customClassName
     *   A fully-qualified path representing CustomClass resource.
     * @returns {string} A string representing the location.
     */
    matchLocationFromCustomClassName(customClassName: string): string | number;
    /**
     * Parse the custom_class from CustomClass resource.
     *
     * @param {string} customClassName
     *   A fully-qualified path representing CustomClass resource.
     * @returns {string} A string representing the custom_class.
     */
    matchCustomClassFromCustomClassName(customClassName: string): string | number;
    /**
     * Return a fully-qualified location resource name string.
     *
     * @param {string} project
     * @param {string} location
     * @returns {string} Resource name string.
     */
    locationPath(project: string, location: string): string;
    /**
     * Parse the project from Location resource.
     *
     * @param {string} locationName
     *   A fully-qualified path representing Location resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromLocationName(locationName: string): string | number;
    /**
     * Parse the location from Location resource.
     *
     * @param {string} locationName
     *   A fully-qualified path representing Location resource.
     * @returns {string} A string representing the location.
     */
    matchLocationFromLocationName(locationName: string): string | number;
    /**
     * Return a fully-qualified phraseSet resource name string.
     *
     * @param {string} project
     * @param {string} location
     * @param {string} phrase_set
     * @returns {string} Resource name string.
     */
    phraseSetPath(project: string, location: string, phraseSet: string): string;
    /**
     * Parse the project from PhraseSet resource.
     *
     * @param {string} phraseSetName
     *   A fully-qualified path representing PhraseSet resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromPhraseSetName(phraseSetName: string): string | number;
    /**
     * Parse the location from PhraseSet resource.
     *
     * @param {string} phraseSetName
     *   A fully-qualified path representing PhraseSet resource.
     * @returns {string} A string representing the location.
     */
    matchLocationFromPhraseSetName(phraseSetName: string): string | number;
    /**
     * Parse the phrase_set from PhraseSet resource.
     *
     * @param {string} phraseSetName
     *   A fully-qualified path representing PhraseSet resource.
     * @returns {string} A string representing the phrase_set.
     */
    matchPhraseSetFromPhraseSetName(phraseSetName: string): string | number;
    /**
     * Return a fully-qualified project resource name string.
     *
     * @param {string} project
     * @returns {string} Resource name string.
     */
    projectPath(project: string): string;
    /**
     * Parse the project from Project resource.
     *
     * @param {string} projectName
     *   A fully-qualified path representing Project resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromProjectName(projectName: string): string | number;
    /**
     * Return a fully-qualified recognizer resource name string.
     *
     * @param {string} project
     * @param {string} location
     * @param {string} recognizer
     * @returns {string} Resource name string.
     */
    recognizerPath(project: string, location: string, recognizer: string): string;
    /**
     * Parse the project from Recognizer resource.
     *
     * @param {string} recognizerName
     *   A fully-qualified path representing Recognizer resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromRecognizerName(recognizerName: string): string | number;
    /**
     * Parse the location from Recognizer resource.
     *
     * @param {string} recognizerName
     *   A fully-qualified path representing Recognizer resource.
     * @returns {string} A string representing the location.
     */
    matchLocationFromRecognizerName(recognizerName: string): string | number;
    /**
     * Parse the recognizer from Recognizer resource.
     *
     * @param {string} recognizerName
     *   A fully-qualified path representing Recognizer resource.
     * @returns {string} A string representing the recognizer.
     */
    matchRecognizerFromRecognizerName(recognizerName: string): string | number;
    /**
     * Terminate the gRPC channel and close the client.
     *
     * The client will no longer be usable and all future behavior is undefined.
     * @returns {Promise} A promise that resolves when the client is closed.
     */
    close(): Promise<void>;
}
import { ImprovedStreamingClient } from '../helpers';
export interface SpeechClient extends ImprovedStreamingClient {
}
