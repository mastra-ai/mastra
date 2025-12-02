import type * as gax from 'google-gax';
import type { Callback, CallOptions, Descriptors, ClientOptions, PaginationCallback } from 'google-gax';
import { Transform } from 'stream';
import * as protos from '../../protos/protos';
/**
 *  Service that implements Google Cloud Speech Adaptation API.
 * @class
 * @memberof v1
 */
export declare class AdaptationClient {
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
    pathTemplates: {
        [name: string]: gax.PathTemplate;
    };
    adaptationStub?: Promise<{
        [name: string]: Function;
    }>;
    /**
     * Construct an instance of AdaptationClient.
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
     *     const client = new AdaptationClient({fallback: true}, gax);
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
     * Create a set of phrase hints. Each item in the set can be a single word or
     * a multi-word phrase. The items in the PhraseSet are favored by the
     * recognition model when you send a call that includes the PhraseSet.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The parent resource where this phrase set will be created.
     *   Format:
     *
     *   `projects/{project}/locations/{location}`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {string} request.phraseSetId
     *   Required. The ID to use for the phrase set, which will become the final
     *   component of the phrase set's resource name.
     *
     *   This value should restrict to letters, numbers, and hyphens, with the first
     *   character a letter, the last a letter or a number, and be 4-63 characters.
     * @param {google.cloud.speech.v1.PhraseSet} request.phraseSet
     *   Required. The phrase set to create.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v1.PhraseSet|PhraseSet}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/adaptation.create_phrase_set.js</caption>
     * region_tag:speech_v1_generated_Adaptation_CreatePhraseSet_async
     */
    createPhraseSet(request?: protos.google.cloud.speech.v1.ICreatePhraseSetRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v1.IPhraseSet,
        protos.google.cloud.speech.v1.ICreatePhraseSetRequest | undefined,
        {} | undefined
    ]>;
    createPhraseSet(request: protos.google.cloud.speech.v1.ICreatePhraseSetRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v1.IPhraseSet, protos.google.cloud.speech.v1.ICreatePhraseSetRequest | null | undefined, {} | null | undefined>): void;
    createPhraseSet(request: protos.google.cloud.speech.v1.ICreatePhraseSetRequest, callback: Callback<protos.google.cloud.speech.v1.IPhraseSet, protos.google.cloud.speech.v1.ICreatePhraseSetRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Get a phrase set.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the phrase set to retrieve. Format:
     *
     *   `projects/{project}/locations/{location}/phraseSets/{phrase_set}`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v1.PhraseSet|PhraseSet}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/adaptation.get_phrase_set.js</caption>
     * region_tag:speech_v1_generated_Adaptation_GetPhraseSet_async
     */
    getPhraseSet(request?: protos.google.cloud.speech.v1.IGetPhraseSetRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v1.IPhraseSet,
        protos.google.cloud.speech.v1.IGetPhraseSetRequest | undefined,
        {} | undefined
    ]>;
    getPhraseSet(request: protos.google.cloud.speech.v1.IGetPhraseSetRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v1.IPhraseSet, protos.google.cloud.speech.v1.IGetPhraseSetRequest | null | undefined, {} | null | undefined>): void;
    getPhraseSet(request: protos.google.cloud.speech.v1.IGetPhraseSetRequest, callback: Callback<protos.google.cloud.speech.v1.IPhraseSet, protos.google.cloud.speech.v1.IGetPhraseSetRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Update a phrase set.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.cloud.speech.v1.PhraseSet} request.phraseSet
     *   Required. The phrase set to update.
     *
     *   The phrase set's `name` field is used to identify the set to be
     *   updated. Format:
     *
     *   `projects/{project}/locations/{location}/phraseSets/{phrase_set}`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   The list of fields to be updated.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v1.PhraseSet|PhraseSet}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/adaptation.update_phrase_set.js</caption>
     * region_tag:speech_v1_generated_Adaptation_UpdatePhraseSet_async
     */
    updatePhraseSet(request?: protos.google.cloud.speech.v1.IUpdatePhraseSetRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v1.IPhraseSet,
        protos.google.cloud.speech.v1.IUpdatePhraseSetRequest | undefined,
        {} | undefined
    ]>;
    updatePhraseSet(request: protos.google.cloud.speech.v1.IUpdatePhraseSetRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v1.IPhraseSet, protos.google.cloud.speech.v1.IUpdatePhraseSetRequest | null | undefined, {} | null | undefined>): void;
    updatePhraseSet(request: protos.google.cloud.speech.v1.IUpdatePhraseSetRequest, callback: Callback<protos.google.cloud.speech.v1.IPhraseSet, protos.google.cloud.speech.v1.IUpdatePhraseSetRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Delete a phrase set.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the phrase set to delete. Format:
     *
     *   `projects/{project}/locations/{location}/phraseSets/{phrase_set}`
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.protobuf.Empty|Empty}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/adaptation.delete_phrase_set.js</caption>
     * region_tag:speech_v1_generated_Adaptation_DeletePhraseSet_async
     */
    deletePhraseSet(request?: protos.google.cloud.speech.v1.IDeletePhraseSetRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.cloud.speech.v1.IDeletePhraseSetRequest | undefined,
        {} | undefined
    ]>;
    deletePhraseSet(request: protos.google.cloud.speech.v1.IDeletePhraseSetRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.cloud.speech.v1.IDeletePhraseSetRequest | null | undefined, {} | null | undefined>): void;
    deletePhraseSet(request: protos.google.cloud.speech.v1.IDeletePhraseSetRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.cloud.speech.v1.IDeletePhraseSetRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Create a custom class.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The parent resource where this custom class will be created.
     *   Format:
     *
     *   `projects/{project}/locations/{location}/customClasses`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {string} request.customClassId
     *   Required. The ID to use for the custom class, which will become the final
     *   component of the custom class' resource name.
     *
     *   This value should restrict to letters, numbers, and hyphens, with the first
     *   character a letter, the last a letter or a number, and be 4-63 characters.
     * @param {google.cloud.speech.v1.CustomClass} request.customClass
     *   Required. The custom class to create.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v1.CustomClass|CustomClass}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/adaptation.create_custom_class.js</caption>
     * region_tag:speech_v1_generated_Adaptation_CreateCustomClass_async
     */
    createCustomClass(request?: protos.google.cloud.speech.v1.ICreateCustomClassRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v1.ICustomClass,
        protos.google.cloud.speech.v1.ICreateCustomClassRequest | undefined,
        {} | undefined
    ]>;
    createCustomClass(request: protos.google.cloud.speech.v1.ICreateCustomClassRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v1.ICustomClass, protos.google.cloud.speech.v1.ICreateCustomClassRequest | null | undefined, {} | null | undefined>): void;
    createCustomClass(request: protos.google.cloud.speech.v1.ICreateCustomClassRequest, callback: Callback<protos.google.cloud.speech.v1.ICustomClass, protos.google.cloud.speech.v1.ICreateCustomClassRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Get a custom class.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the custom class to retrieve. Format:
     *
     *   `projects/{project}/locations/{location}/customClasses/{custom_class}`
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v1.CustomClass|CustomClass}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/adaptation.get_custom_class.js</caption>
     * region_tag:speech_v1_generated_Adaptation_GetCustomClass_async
     */
    getCustomClass(request?: protos.google.cloud.speech.v1.IGetCustomClassRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v1.ICustomClass,
        protos.google.cloud.speech.v1.IGetCustomClassRequest | undefined,
        {} | undefined
    ]>;
    getCustomClass(request: protos.google.cloud.speech.v1.IGetCustomClassRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v1.ICustomClass, protos.google.cloud.speech.v1.IGetCustomClassRequest | null | undefined, {} | null | undefined>): void;
    getCustomClass(request: protos.google.cloud.speech.v1.IGetCustomClassRequest, callback: Callback<protos.google.cloud.speech.v1.ICustomClass, protos.google.cloud.speech.v1.IGetCustomClassRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Update a custom class.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.cloud.speech.v1.CustomClass} request.customClass
     *   Required. The custom class to update.
     *
     *   The custom class's `name` field is used to identify the custom class to be
     *   updated. Format:
     *
     *   `projects/{project}/locations/{location}/customClasses/{custom_class}`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   The list of fields to be updated.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.cloud.speech.v1.CustomClass|CustomClass}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/adaptation.update_custom_class.js</caption>
     * region_tag:speech_v1_generated_Adaptation_UpdateCustomClass_async
     */
    updateCustomClass(request?: protos.google.cloud.speech.v1.IUpdateCustomClassRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v1.ICustomClass,
        protos.google.cloud.speech.v1.IUpdateCustomClassRequest | undefined,
        {} | undefined
    ]>;
    updateCustomClass(request: protos.google.cloud.speech.v1.IUpdateCustomClassRequest, options: CallOptions, callback: Callback<protos.google.cloud.speech.v1.ICustomClass, protos.google.cloud.speech.v1.IUpdateCustomClassRequest | null | undefined, {} | null | undefined>): void;
    updateCustomClass(request: protos.google.cloud.speech.v1.IUpdateCustomClassRequest, callback: Callback<protos.google.cloud.speech.v1.ICustomClass, protos.google.cloud.speech.v1.IUpdateCustomClassRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Delete a custom class.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the custom class to delete. Format:
     *
     *   `projects/{project}/locations/{location}/customClasses/{custom_class}`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.protobuf.Empty|Empty}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/adaptation.delete_custom_class.js</caption>
     * region_tag:speech_v1_generated_Adaptation_DeleteCustomClass_async
     */
    deleteCustomClass(request?: protos.google.cloud.speech.v1.IDeleteCustomClassRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.cloud.speech.v1.IDeleteCustomClassRequest | undefined,
        {} | undefined
    ]>;
    deleteCustomClass(request: protos.google.cloud.speech.v1.IDeleteCustomClassRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.cloud.speech.v1.IDeleteCustomClassRequest | null | undefined, {} | null | undefined>): void;
    deleteCustomClass(request: protos.google.cloud.speech.v1.IDeleteCustomClassRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.cloud.speech.v1.IDeleteCustomClassRequest | null | undefined, {} | null | undefined>): void;
    /**
     * List phrase sets.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The parent, which owns this collection of phrase set. Format:
     *
     *   `projects/{project}/locations/{location}`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {number} request.pageSize
     *   The maximum number of phrase sets to return. The service may return
     *   fewer than this value. If unspecified, at most 50 phrase sets will be
     *   returned. The maximum value is 1000; values above 1000 will be coerced to
     *   1000.
     * @param {string} request.pageToken
     *   A page token, received from a previous `ListPhraseSet` call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to `ListPhraseSet` must
     *   match the call that provided the page token.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of {@link protos.google.cloud.speech.v1.PhraseSet|PhraseSet}.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listPhraseSetAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listPhraseSet(request?: protos.google.cloud.speech.v1.IListPhraseSetRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v1.IPhraseSet[],
        protos.google.cloud.speech.v1.IListPhraseSetRequest | null,
        protos.google.cloud.speech.v1.IListPhraseSetResponse
    ]>;
    listPhraseSet(request: protos.google.cloud.speech.v1.IListPhraseSetRequest, options: CallOptions, callback: PaginationCallback<protos.google.cloud.speech.v1.IListPhraseSetRequest, protos.google.cloud.speech.v1.IListPhraseSetResponse | null | undefined, protos.google.cloud.speech.v1.IPhraseSet>): void;
    listPhraseSet(request: protos.google.cloud.speech.v1.IListPhraseSetRequest, callback: PaginationCallback<protos.google.cloud.speech.v1.IListPhraseSetRequest, protos.google.cloud.speech.v1.IListPhraseSetResponse | null | undefined, protos.google.cloud.speech.v1.IPhraseSet>): void;
    /**
     * Equivalent to `listPhraseSet`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The parent, which owns this collection of phrase set. Format:
     *
     *   `projects/{project}/locations/{location}`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {number} request.pageSize
     *   The maximum number of phrase sets to return. The service may return
     *   fewer than this value. If unspecified, at most 50 phrase sets will be
     *   returned. The maximum value is 1000; values above 1000 will be coerced to
     *   1000.
     * @param {string} request.pageToken
     *   A page token, received from a previous `ListPhraseSet` call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to `ListPhraseSet` must
     *   match the call that provided the page token.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing {@link protos.google.cloud.speech.v1.PhraseSet|PhraseSet} on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listPhraseSetAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listPhraseSetStream(request?: protos.google.cloud.speech.v1.IListPhraseSetRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listPhraseSet`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The parent, which owns this collection of phrase set. Format:
     *
     *   `projects/{project}/locations/{location}`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {number} request.pageSize
     *   The maximum number of phrase sets to return. The service may return
     *   fewer than this value. If unspecified, at most 50 phrase sets will be
     *   returned. The maximum value is 1000; values above 1000 will be coerced to
     *   1000.
     * @param {string} request.pageToken
     *   A page token, received from a previous `ListPhraseSet` call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to `ListPhraseSet` must
     *   match the call that provided the page token.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   {@link protos.google.cloud.speech.v1.PhraseSet|PhraseSet}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/adaptation.list_phrase_set.js</caption>
     * region_tag:speech_v1_generated_Adaptation_ListPhraseSet_async
     */
    listPhraseSetAsync(request?: protos.google.cloud.speech.v1.IListPhraseSetRequest, options?: CallOptions): AsyncIterable<protos.google.cloud.speech.v1.IPhraseSet>;
    /**
     * List custom classes.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The parent, which owns this collection of custom classes. Format:
     *
     *   `projects/{project}/locations/{location}/customClasses`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {number} request.pageSize
     *   The maximum number of custom classes to return. The service may return
     *   fewer than this value. If unspecified, at most 50 custom classes will be
     *   returned. The maximum value is 1000; values above 1000 will be coerced to
     *   1000.
     * @param {string} request.pageToken
     *   A page token, received from a previous `ListCustomClass` call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to `ListCustomClass` must
     *   match the call that provided the page token.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of {@link protos.google.cloud.speech.v1.CustomClass|CustomClass}.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listCustomClassesAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listCustomClasses(request?: protos.google.cloud.speech.v1.IListCustomClassesRequest, options?: CallOptions): Promise<[
        protos.google.cloud.speech.v1.ICustomClass[],
        protos.google.cloud.speech.v1.IListCustomClassesRequest | null,
        protos.google.cloud.speech.v1.IListCustomClassesResponse
    ]>;
    listCustomClasses(request: protos.google.cloud.speech.v1.IListCustomClassesRequest, options: CallOptions, callback: PaginationCallback<protos.google.cloud.speech.v1.IListCustomClassesRequest, protos.google.cloud.speech.v1.IListCustomClassesResponse | null | undefined, protos.google.cloud.speech.v1.ICustomClass>): void;
    listCustomClasses(request: protos.google.cloud.speech.v1.IListCustomClassesRequest, callback: PaginationCallback<protos.google.cloud.speech.v1.IListCustomClassesRequest, protos.google.cloud.speech.v1.IListCustomClassesResponse | null | undefined, protos.google.cloud.speech.v1.ICustomClass>): void;
    /**
     * Equivalent to `listCustomClasses`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The parent, which owns this collection of custom classes. Format:
     *
     *   `projects/{project}/locations/{location}/customClasses`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {number} request.pageSize
     *   The maximum number of custom classes to return. The service may return
     *   fewer than this value. If unspecified, at most 50 custom classes will be
     *   returned. The maximum value is 1000; values above 1000 will be coerced to
     *   1000.
     * @param {string} request.pageToken
     *   A page token, received from a previous `ListCustomClass` call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to `ListCustomClass` must
     *   match the call that provided the page token.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing {@link protos.google.cloud.speech.v1.CustomClass|CustomClass} on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listCustomClassesAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listCustomClassesStream(request?: protos.google.cloud.speech.v1.IListCustomClassesRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listCustomClasses`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The parent, which owns this collection of custom classes. Format:
     *
     *   `projects/{project}/locations/{location}/customClasses`
     *
     *   Speech-to-Text supports three locations: `global`, `us` (US North America),
     *   and `eu` (Europe). If you are calling the `speech.googleapis.com`
     *   endpoint, use the `global` location. To specify a region, use a
     *   [regional endpoint](https://cloud.google.com/speech-to-text/docs/endpoints)
     *   with matching `us` or `eu` location value.
     * @param {number} request.pageSize
     *   The maximum number of custom classes to return. The service may return
     *   fewer than this value. If unspecified, at most 50 custom classes will be
     *   returned. The maximum value is 1000; values above 1000 will be coerced to
     *   1000.
     * @param {string} request.pageToken
     *   A page token, received from a previous `ListCustomClass` call.
     *   Provide this to retrieve the subsequent page.
     *
     *   When paginating, all other parameters provided to `ListCustomClass` must
     *   match the call that provided the page token.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   {@link protos.google.cloud.speech.v1.CustomClass|CustomClass}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/adaptation.list_custom_classes.js</caption>
     * region_tag:speech_v1_generated_Adaptation_ListCustomClasses_async
     */
    listCustomClassesAsync(request?: protos.google.cloud.speech.v1.IListCustomClassesRequest, options?: CallOptions): AsyncIterable<protos.google.cloud.speech.v1.ICustomClass>;
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
     * Terminate the gRPC channel and close the client.
     *
     * The client will no longer be usable and all future behavior is undefined.
     * @returns {Promise} A promise that resolves when the client is closed.
     */
    close(): Promise<void>;
}
