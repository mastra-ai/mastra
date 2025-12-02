import type * as gax from 'google-gax';
import type { Callback, CallOptions, Descriptors, ClientOptions, LROperation, PaginationCallback, LocationsClient, LocationProtos } from 'google-gax';
import { Transform } from 'stream';
import * as protos from '../../protos/firestore_admin_v1_proto_api';
/**
 *  The Cloud Firestore Admin API.
 *
 *  This API provides several administrative services for Cloud Firestore.
 *
 *  Project, Database, Namespace, Collection, Collection Group, and Document are
 *  used as defined in the Google Cloud Firestore API.
 *
 *  Operation: An Operation represents work being performed in the background.
 *
 *  The index service manages Cloud Firestore indexes.
 *
 *  Index creation is performed asynchronously.
 *  An Operation resource is created for each such asynchronous operation.
 *  The state of the operation (including any errors encountered)
 *  may be queried via the Operation resource.
 *
 *  The Operations collection provides a record of actions performed for the
 *  specified Project (including any Operations in progress). Operations are not
 *  created directly but through calls on other collections or resources.
 *
 *  An Operation that is done may be deleted so that it is no longer listed as
 *  part of the Operation collection. Operations are garbage collected after
 *  30 days. By default, ListOperations will only return in progress and failed
 *  operations. To list completed operation, issue a ListOperations request with
 *  the filter `done: true`.
 *
 *  Operations are created by service `FirestoreAdmin`, but are accessed via
 *  service `google.longrunning.Operations`.
 * @class
 * @memberof v1
 */
export declare class FirestoreAdminClient {
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
    firestoreAdminStub?: Promise<{
        [name: string]: Function;
    }>;
    /**
     * Construct an instance of FirestoreAdminClient.
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
     *     const client = new FirestoreAdminClient({fallback: true}, gax);
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
     * Gets a composite index.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. A name of the form
     *   `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}/indexes/{index_id}`
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.firestore.admin.v1.Index|Index}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.get_index.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_GetIndex_async
     */
    getIndex(request?: protos.google.firestore.admin.v1.IGetIndexRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IIndex,
        protos.google.firestore.admin.v1.IGetIndexRequest | undefined,
        {} | undefined
    ]>;
    getIndex(request: protos.google.firestore.admin.v1.IGetIndexRequest, options: CallOptions, callback: Callback<protos.google.firestore.admin.v1.IIndex, protos.google.firestore.admin.v1.IGetIndexRequest | null | undefined, {} | null | undefined>): void;
    getIndex(request: protos.google.firestore.admin.v1.IGetIndexRequest, callback: Callback<protos.google.firestore.admin.v1.IIndex, protos.google.firestore.admin.v1.IGetIndexRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Deletes a composite index.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. A name of the form
     *   `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}/indexes/{index_id}`
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.protobuf.Empty|Empty}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.delete_index.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_DeleteIndex_async
     */
    deleteIndex(request?: protos.google.firestore.admin.v1.IDeleteIndexRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.firestore.admin.v1.IDeleteIndexRequest | undefined,
        {} | undefined
    ]>;
    deleteIndex(request: protos.google.firestore.admin.v1.IDeleteIndexRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.firestore.admin.v1.IDeleteIndexRequest | null | undefined, {} | null | undefined>): void;
    deleteIndex(request: protos.google.firestore.admin.v1.IDeleteIndexRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.firestore.admin.v1.IDeleteIndexRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Gets the metadata and configuration for a Field.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. A name of the form
     *   `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}/fields/{field_id}`
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.firestore.admin.v1.Field|Field}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.get_field.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_GetField_async
     */
    getField(request?: protos.google.firestore.admin.v1.IGetFieldRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IField,
        protos.google.firestore.admin.v1.IGetFieldRequest | undefined,
        {} | undefined
    ]>;
    getField(request: protos.google.firestore.admin.v1.IGetFieldRequest, options: CallOptions, callback: Callback<protos.google.firestore.admin.v1.IField, protos.google.firestore.admin.v1.IGetFieldRequest | null | undefined, {} | null | undefined>): void;
    getField(request: protos.google.firestore.admin.v1.IGetFieldRequest, callback: Callback<protos.google.firestore.admin.v1.IField, protos.google.firestore.admin.v1.IGetFieldRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Gets information about a database.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. A name of the form
     *   `projects/{project_id}/databases/{database_id}`
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.firestore.admin.v1.Database|Database}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.get_database.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_GetDatabase_async
     */
    getDatabase(request?: protos.google.firestore.admin.v1.IGetDatabaseRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IDatabase,
        protos.google.firestore.admin.v1.IGetDatabaseRequest | undefined,
        {} | undefined
    ]>;
    getDatabase(request: protos.google.firestore.admin.v1.IGetDatabaseRequest, options: CallOptions, callback: Callback<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.IGetDatabaseRequest | null | undefined, {} | null | undefined>): void;
    getDatabase(request: protos.google.firestore.admin.v1.IGetDatabaseRequest, callback: Callback<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.IGetDatabaseRequest | null | undefined, {} | null | undefined>): void;
    /**
     * List all the databases in the project.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. A parent name of the form
     *   `projects/{project_id}`
     * @param {boolean} request.showDeleted
     *   If true, also returns deleted resources.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.firestore.admin.v1.ListDatabasesResponse|ListDatabasesResponse}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.list_databases.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_ListDatabases_async
     */
    listDatabases(request?: protos.google.firestore.admin.v1.IListDatabasesRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IListDatabasesResponse,
        protos.google.firestore.admin.v1.IListDatabasesRequest | undefined,
        {} | undefined
    ]>;
    listDatabases(request: protos.google.firestore.admin.v1.IListDatabasesRequest, options: CallOptions, callback: Callback<protos.google.firestore.admin.v1.IListDatabasesResponse, protos.google.firestore.admin.v1.IListDatabasesRequest | null | undefined, {} | null | undefined>): void;
    listDatabases(request: protos.google.firestore.admin.v1.IListDatabasesRequest, callback: Callback<protos.google.firestore.admin.v1.IListDatabasesResponse, protos.google.firestore.admin.v1.IListDatabasesRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Gets information about a backup.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. Name of the backup to fetch.
     *
     *   Format is `projects/{project}/locations/{location}/backups/{backup}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.firestore.admin.v1.Backup|Backup}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.get_backup.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_GetBackup_async
     */
    getBackup(request?: protos.google.firestore.admin.v1.IGetBackupRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IBackup,
        protos.google.firestore.admin.v1.IGetBackupRequest | undefined,
        {} | undefined
    ]>;
    getBackup(request: protos.google.firestore.admin.v1.IGetBackupRequest, options: CallOptions, callback: Callback<protos.google.firestore.admin.v1.IBackup, protos.google.firestore.admin.v1.IGetBackupRequest | null | undefined, {} | null | undefined>): void;
    getBackup(request: protos.google.firestore.admin.v1.IGetBackupRequest, callback: Callback<protos.google.firestore.admin.v1.IBackup, protos.google.firestore.admin.v1.IGetBackupRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Lists all the backups.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The location to list backups from.
     *
     *   Format is `projects/{project}/locations/{location}`.
     *   Use `{location} = '-'` to list backups from all locations for the given
     *   project. This allows listing backups from a single location or from all
     *   locations.
     * @param {string} request.filter
     *   An expression that filters the list of returned backups.
     *
     *   A filter expression consists of a field name, a comparison operator, and a
     *   value for filtering.
     *   The value must be a string, a number, or a boolean. The comparison operator
     *   must be one of: `<`, `>`, `<=`, `>=`, `!=`, `=`, or `:`.
     *   Colon `:` is the contains operator. Filter rules are not case sensitive.
     *
     *   The following fields in the {@link protos.google.firestore.admin.v1.Backup|Backup} are
     *   eligible for filtering:
     *
     *     * `database_uid` (supports `=` only)
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.firestore.admin.v1.ListBackupsResponse|ListBackupsResponse}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.list_backups.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_ListBackups_async
     */
    listBackups(request?: protos.google.firestore.admin.v1.IListBackupsRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IListBackupsResponse,
        protos.google.firestore.admin.v1.IListBackupsRequest | undefined,
        {} | undefined
    ]>;
    listBackups(request: protos.google.firestore.admin.v1.IListBackupsRequest, options: CallOptions, callback: Callback<protos.google.firestore.admin.v1.IListBackupsResponse, protos.google.firestore.admin.v1.IListBackupsRequest | null | undefined, {} | null | undefined>): void;
    listBackups(request: protos.google.firestore.admin.v1.IListBackupsRequest, callback: Callback<protos.google.firestore.admin.v1.IListBackupsResponse, protos.google.firestore.admin.v1.IListBackupsRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Deletes a backup.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. Name of the backup to delete.
     *
     *   format is `projects/{project}/locations/{location}/backups/{backup}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.protobuf.Empty|Empty}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.delete_backup.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_DeleteBackup_async
     */
    deleteBackup(request?: protos.google.firestore.admin.v1.IDeleteBackupRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.firestore.admin.v1.IDeleteBackupRequest | undefined,
        {} | undefined
    ]>;
    deleteBackup(request: protos.google.firestore.admin.v1.IDeleteBackupRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.firestore.admin.v1.IDeleteBackupRequest | null | undefined, {} | null | undefined>): void;
    deleteBackup(request: protos.google.firestore.admin.v1.IDeleteBackupRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.firestore.admin.v1.IDeleteBackupRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Creates a backup schedule on a database.
     * At most two backup schedules can be configured on a database, one daily
     * backup schedule and one weekly backup schedule.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The parent database.
     *
     *    Format `projects/{project}/databases/{database}`
     * @param {google.firestore.admin.v1.BackupSchedule} request.backupSchedule
     *   Required. The backup schedule to create.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.firestore.admin.v1.BackupSchedule|BackupSchedule}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.create_backup_schedule.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_CreateBackupSchedule_async
     */
    createBackupSchedule(request?: protos.google.firestore.admin.v1.ICreateBackupScheduleRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IBackupSchedule,
        protos.google.firestore.admin.v1.ICreateBackupScheduleRequest | undefined,
        {} | undefined
    ]>;
    createBackupSchedule(request: protos.google.firestore.admin.v1.ICreateBackupScheduleRequest, options: CallOptions, callback: Callback<protos.google.firestore.admin.v1.IBackupSchedule, protos.google.firestore.admin.v1.ICreateBackupScheduleRequest | null | undefined, {} | null | undefined>): void;
    createBackupSchedule(request: protos.google.firestore.admin.v1.ICreateBackupScheduleRequest, callback: Callback<protos.google.firestore.admin.v1.IBackupSchedule, protos.google.firestore.admin.v1.ICreateBackupScheduleRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Gets information about a backup schedule.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the backup schedule.
     *
     *   Format
     *   `projects/{project}/databases/{database}/backupSchedules/{backup_schedule}`
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.firestore.admin.v1.BackupSchedule|BackupSchedule}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.get_backup_schedule.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_GetBackupSchedule_async
     */
    getBackupSchedule(request?: protos.google.firestore.admin.v1.IGetBackupScheduleRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IBackupSchedule,
        protos.google.firestore.admin.v1.IGetBackupScheduleRequest | undefined,
        {} | undefined
    ]>;
    getBackupSchedule(request: protos.google.firestore.admin.v1.IGetBackupScheduleRequest, options: CallOptions, callback: Callback<protos.google.firestore.admin.v1.IBackupSchedule, protos.google.firestore.admin.v1.IGetBackupScheduleRequest | null | undefined, {} | null | undefined>): void;
    getBackupSchedule(request: protos.google.firestore.admin.v1.IGetBackupScheduleRequest, callback: Callback<protos.google.firestore.admin.v1.IBackupSchedule, protos.google.firestore.admin.v1.IGetBackupScheduleRequest | null | undefined, {} | null | undefined>): void;
    /**
     * List backup schedules.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The parent database.
     *
     *   Format is `projects/{project}/databases/{database}`.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.firestore.admin.v1.ListBackupSchedulesResponse|ListBackupSchedulesResponse}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.list_backup_schedules.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_ListBackupSchedules_async
     */
    listBackupSchedules(request?: protos.google.firestore.admin.v1.IListBackupSchedulesRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IListBackupSchedulesResponse,
        protos.google.firestore.admin.v1.IListBackupSchedulesRequest | undefined,
        {} | undefined
    ]>;
    listBackupSchedules(request: protos.google.firestore.admin.v1.IListBackupSchedulesRequest, options: CallOptions, callback: Callback<protos.google.firestore.admin.v1.IListBackupSchedulesResponse, protos.google.firestore.admin.v1.IListBackupSchedulesRequest | null | undefined, {} | null | undefined>): void;
    listBackupSchedules(request: protos.google.firestore.admin.v1.IListBackupSchedulesRequest, callback: Callback<protos.google.firestore.admin.v1.IListBackupSchedulesResponse, protos.google.firestore.admin.v1.IListBackupSchedulesRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Updates a backup schedule.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.firestore.admin.v1.BackupSchedule} request.backupSchedule
     *   Required. The backup schedule to update.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   The list of fields to be updated.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.firestore.admin.v1.BackupSchedule|BackupSchedule}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.update_backup_schedule.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_UpdateBackupSchedule_async
     */
    updateBackupSchedule(request?: protos.google.firestore.admin.v1.IUpdateBackupScheduleRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IBackupSchedule,
        protos.google.firestore.admin.v1.IUpdateBackupScheduleRequest | undefined,
        {} | undefined
    ]>;
    updateBackupSchedule(request: protos.google.firestore.admin.v1.IUpdateBackupScheduleRequest, options: CallOptions, callback: Callback<protos.google.firestore.admin.v1.IBackupSchedule, protos.google.firestore.admin.v1.IUpdateBackupScheduleRequest | null | undefined, {} | null | undefined>): void;
    updateBackupSchedule(request: protos.google.firestore.admin.v1.IUpdateBackupScheduleRequest, callback: Callback<protos.google.firestore.admin.v1.IBackupSchedule, protos.google.firestore.admin.v1.IUpdateBackupScheduleRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Deletes a backup schedule.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. The name of the backup schedule.
     *
     *   Format
     *   `projects/{project}/databases/{database}/backupSchedules/{backup_schedule}`
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing {@link protos.google.protobuf.Empty|Empty}.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#regular-methods | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.delete_backup_schedule.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_DeleteBackupSchedule_async
     */
    deleteBackupSchedule(request?: protos.google.firestore.admin.v1.IDeleteBackupScheduleRequest, options?: CallOptions): Promise<[
        protos.google.protobuf.IEmpty,
        protos.google.firestore.admin.v1.IDeleteBackupScheduleRequest | undefined,
        {} | undefined
    ]>;
    deleteBackupSchedule(request: protos.google.firestore.admin.v1.IDeleteBackupScheduleRequest, options: CallOptions, callback: Callback<protos.google.protobuf.IEmpty, protos.google.firestore.admin.v1.IDeleteBackupScheduleRequest | null | undefined, {} | null | undefined>): void;
    deleteBackupSchedule(request: protos.google.firestore.admin.v1.IDeleteBackupScheduleRequest, callback: Callback<protos.google.protobuf.IEmpty, protos.google.firestore.admin.v1.IDeleteBackupScheduleRequest | null | undefined, {} | null | undefined>): void;
    /**
     * Creates a composite index. This returns a
     * {@link protos.google.longrunning.Operation|google.longrunning.Operation} which may be
     * used to track the status of the creation. The metadata for the operation
     * will be the type
     * {@link protos.google.firestore.admin.v1.IndexOperationMetadata|IndexOperationMetadata}.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. A parent name of the form
     *   `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}`
     * @param {google.firestore.admin.v1.Index} request.index
     *   Required. The composite index to create.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.create_index.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_CreateIndex_async
     */
    createIndex(request?: protos.google.firestore.admin.v1.ICreateIndexRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.firestore.admin.v1.IIndex, protos.google.firestore.admin.v1.IIndexOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    createIndex(request: protos.google.firestore.admin.v1.ICreateIndexRequest, options: CallOptions, callback: Callback<LROperation<protos.google.firestore.admin.v1.IIndex, protos.google.firestore.admin.v1.IIndexOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    createIndex(request: protos.google.firestore.admin.v1.ICreateIndexRequest, callback: Callback<LROperation<protos.google.firestore.admin.v1.IIndex, protos.google.firestore.admin.v1.IIndexOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `createIndex()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.create_index.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_CreateIndex_async
     */
    checkCreateIndexProgress(name: string): Promise<LROperation<protos.google.firestore.admin.v1.Index, protos.google.firestore.admin.v1.IndexOperationMetadata>>;
    /**
     * Updates a field configuration. Currently, field updates apply only to
     * single field index configuration. However, calls to
     * {@link protos.google.firestore.admin.v1.FirestoreAdmin.UpdateField|FirestoreAdmin.UpdateField}
     * should provide a field mask to avoid changing any configuration that the
     * caller isn't aware of. The field mask should be specified as: `{ paths:
     * "index_config" }`.
     *
     * This call returns a
     * {@link protos.google.longrunning.Operation|google.longrunning.Operation} which may be
     * used to track the status of the field update. The metadata for the
     * operation will be the type
     * {@link protos.google.firestore.admin.v1.FieldOperationMetadata|FieldOperationMetadata}.
     *
     * To configure the default field settings for the database, use
     * the special `Field` with resource name:
     * `projects/{project_id}/databases/{database_id}/collectionGroups/__default__/fields/*`.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.firestore.admin.v1.Field} request.field
     *   Required. The field to be updated.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   A mask, relative to the field. If specified, only configuration specified
     *   by this field_mask will be updated in the field.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.update_field.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_UpdateField_async
     */
    updateField(request?: protos.google.firestore.admin.v1.IUpdateFieldRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.firestore.admin.v1.IField, protos.google.firestore.admin.v1.IFieldOperationMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    updateField(request: protos.google.firestore.admin.v1.IUpdateFieldRequest, options: CallOptions, callback: Callback<LROperation<protos.google.firestore.admin.v1.IField, protos.google.firestore.admin.v1.IFieldOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    updateField(request: protos.google.firestore.admin.v1.IUpdateFieldRequest, callback: Callback<LROperation<protos.google.firestore.admin.v1.IField, protos.google.firestore.admin.v1.IFieldOperationMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `updateField()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.update_field.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_UpdateField_async
     */
    checkUpdateFieldProgress(name: string): Promise<LROperation<protos.google.firestore.admin.v1.Field, protos.google.firestore.admin.v1.FieldOperationMetadata>>;
    /**
     * Exports a copy of all or a subset of documents from Google Cloud Firestore
     * to another storage system, such as Google Cloud Storage. Recent updates to
     * documents may not be reflected in the export. The export occurs in the
     * background and its progress can be monitored and managed via the
     * Operation resource that is created. The output of an export may only be
     * used once the associated operation is done. If an export operation is
     * cancelled before completion it may leave partial data behind in Google
     * Cloud Storage.
     *
     * For more details on export behavior and output format, refer to:
     * https://cloud.google.com/firestore/docs/manage-data/export-import
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. Database to export. Should be of the form:
     *   `projects/{project_id}/databases/{database_id}`.
     * @param {string[]} request.collectionIds
     *   Which collection IDs to export. Unspecified means all collections. Each
     *   collection ID in this list must be unique.
     * @param {string} request.outputUriPrefix
     *   The output URI. Currently only supports Google Cloud Storage URIs of the
     *   form: `gs://BUCKET_NAME[/NAMESPACE_PATH]`, where `BUCKET_NAME` is the name
     *   of the Google Cloud Storage bucket and `NAMESPACE_PATH` is an optional
     *   Google Cloud Storage namespace path. When
     *   choosing a name, be sure to consider Google Cloud Storage naming
     *   guidelines: https://cloud.google.com/storage/docs/naming.
     *   If the URI is a bucket (without a namespace path), a prefix will be
     *   generated based on the start time.
     * @param {string[]} request.namespaceIds
     *   An empty list represents all namespaces. This is the preferred
     *   usage for databases that don't use namespaces.
     *
     *   An empty string element represents the default namespace. This should be
     *   used if the database has data in non-default namespaces, but doesn't want
     *   to include them. Each namespace in this list must be unique.
     * @param {google.protobuf.Timestamp} request.snapshotTime
     *   The timestamp that corresponds to the version of the database to be
     *   exported. The timestamp must be in the past, rounded to the minute and not
     *   older than
     *   {@link protos.google.firestore.admin.v1.Database.earliest_version_time|earliestVersionTime}.
     *   If specified, then the exported documents will represent a consistent view
     *   of the database at the provided time. Otherwise, there are no guarantees
     *   about the consistency of the exported documents.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.export_documents.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_ExportDocuments_async
     */
    exportDocuments(request?: protos.google.firestore.admin.v1.IExportDocumentsRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.firestore.admin.v1.IExportDocumentsResponse, protos.google.firestore.admin.v1.IExportDocumentsMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    exportDocuments(request: protos.google.firestore.admin.v1.IExportDocumentsRequest, options: CallOptions, callback: Callback<LROperation<protos.google.firestore.admin.v1.IExportDocumentsResponse, protos.google.firestore.admin.v1.IExportDocumentsMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    exportDocuments(request: protos.google.firestore.admin.v1.IExportDocumentsRequest, callback: Callback<LROperation<protos.google.firestore.admin.v1.IExportDocumentsResponse, protos.google.firestore.admin.v1.IExportDocumentsMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `exportDocuments()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.export_documents.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_ExportDocuments_async
     */
    checkExportDocumentsProgress(name: string): Promise<LROperation<protos.google.firestore.admin.v1.ExportDocumentsResponse, protos.google.firestore.admin.v1.ExportDocumentsMetadata>>;
    /**
     * Imports documents into Google Cloud Firestore. Existing documents with the
     * same name are overwritten. The import occurs in the background and its
     * progress can be monitored and managed via the Operation resource that is
     * created. If an ImportDocuments operation is cancelled, it is possible
     * that a subset of the data has already been imported to Cloud Firestore.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. Database to import into. Should be of the form:
     *   `projects/{project_id}/databases/{database_id}`.
     * @param {string[]} request.collectionIds
     *   Which collection IDs to import. Unspecified means all collections included
     *   in the import. Each collection ID in this list must be unique.
     * @param {string} request.inputUriPrefix
     *   Location of the exported files.
     *   This must match the output_uri_prefix of an ExportDocumentsResponse from
     *   an export that has completed successfully.
     *   See:
     *   {@link protos.google.firestore.admin.v1.ExportDocumentsResponse.output_uri_prefix|google.firestore.admin.v1.ExportDocumentsResponse.output_uri_prefix}.
     * @param {string[]} request.namespaceIds
     *   An empty list represents all namespaces. This is the preferred
     *   usage for databases that don't use namespaces.
     *
     *   An empty string element represents the default namespace. This should be
     *   used if the database has data in non-default namespaces, but doesn't want
     *   to include them. Each namespace in this list must be unique.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.import_documents.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_ImportDocuments_async
     */
    importDocuments(request?: protos.google.firestore.admin.v1.IImportDocumentsRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.protobuf.IEmpty, protos.google.firestore.admin.v1.IImportDocumentsMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    importDocuments(request: protos.google.firestore.admin.v1.IImportDocumentsRequest, options: CallOptions, callback: Callback<LROperation<protos.google.protobuf.IEmpty, protos.google.firestore.admin.v1.IImportDocumentsMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    importDocuments(request: protos.google.firestore.admin.v1.IImportDocumentsRequest, callback: Callback<LROperation<protos.google.protobuf.IEmpty, protos.google.firestore.admin.v1.IImportDocumentsMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `importDocuments()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.import_documents.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_ImportDocuments_async
     */
    checkImportDocumentsProgress(name: string): Promise<LROperation<protos.google.protobuf.Empty, protos.google.firestore.admin.v1.ImportDocumentsMetadata>>;
    /**
     * Bulk deletes a subset of documents from Google Cloud Firestore.
     * Documents created or updated after the underlying system starts to process
     * the request will not be deleted. The bulk delete occurs in the background
     * and its progress can be monitored and managed via the Operation resource
     * that is created.
     *
     * For more details on bulk delete behavior, refer to:
     * https://cloud.google.com/firestore/docs/manage-data/bulk-delete
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. Database to operate. Should be of the form:
     *   `projects/{project_id}/databases/{database_id}`.
     * @param {string[]} [request.collectionIds]
     *   Optional. IDs of the collection groups to delete. Unspecified means all
     *   collection groups.
     *
     *   Each collection group in this list must be unique.
     * @param {string[]} [request.namespaceIds]
     *   Optional. Namespaces to delete.
     *
     *   An empty list means all namespaces. This is the recommended
     *   usage for databases that don't use namespaces.
     *
     *   An empty string element represents the default namespace. This should be
     *   used if the database has data in non-default namespaces, but doesn't want
     *   to delete from them.
     *
     *   Each namespace in this list must be unique.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.bulk_delete_documents.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_BulkDeleteDocuments_async
     */
    bulkDeleteDocuments(request?: protos.google.firestore.admin.v1.IBulkDeleteDocumentsRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.firestore.admin.v1.IBulkDeleteDocumentsResponse, protos.google.firestore.admin.v1.IBulkDeleteDocumentsMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    bulkDeleteDocuments(request: protos.google.firestore.admin.v1.IBulkDeleteDocumentsRequest, options: CallOptions, callback: Callback<LROperation<protos.google.firestore.admin.v1.IBulkDeleteDocumentsResponse, protos.google.firestore.admin.v1.IBulkDeleteDocumentsMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    bulkDeleteDocuments(request: protos.google.firestore.admin.v1.IBulkDeleteDocumentsRequest, callback: Callback<LROperation<protos.google.firestore.admin.v1.IBulkDeleteDocumentsResponse, protos.google.firestore.admin.v1.IBulkDeleteDocumentsMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `bulkDeleteDocuments()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.bulk_delete_documents.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_BulkDeleteDocuments_async
     */
    checkBulkDeleteDocumentsProgress(name: string): Promise<LROperation<protos.google.firestore.admin.v1.BulkDeleteDocumentsResponse, protos.google.firestore.admin.v1.BulkDeleteDocumentsMetadata>>;
    /**
     * Create a database.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. A parent name of the form
     *   `projects/{project_id}`
     * @param {google.firestore.admin.v1.Database} request.database
     *   Required. The Database to create.
     * @param {string} request.databaseId
     *   Required. The ID to use for the database, which will become the final
     *   component of the database's resource name.
     *
     *   This value should be 4-63 characters. Valid characters are /{@link protos.0-9|a-z}-/
     *   with first character a letter and the last a letter or a number. Must not
     *   be UUID-like /[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/.
     *
     *   "(default)" database ID is also valid.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.create_database.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_CreateDatabase_async
     */
    createDatabase(request?: protos.google.firestore.admin.v1.ICreateDatabaseRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.ICreateDatabaseMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    createDatabase(request: protos.google.firestore.admin.v1.ICreateDatabaseRequest, options: CallOptions, callback: Callback<LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.ICreateDatabaseMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    createDatabase(request: protos.google.firestore.admin.v1.ICreateDatabaseRequest, callback: Callback<LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.ICreateDatabaseMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `createDatabase()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.create_database.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_CreateDatabase_async
     */
    checkCreateDatabaseProgress(name: string): Promise<LROperation<protos.google.firestore.admin.v1.Database, protos.google.firestore.admin.v1.CreateDatabaseMetadata>>;
    /**
     * Updates a database.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {google.firestore.admin.v1.Database} request.database
     *   Required. The database to update.
     * @param {google.protobuf.FieldMask} request.updateMask
     *   The list of fields to be updated.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.update_database.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_UpdateDatabase_async
     */
    updateDatabase(request?: protos.google.firestore.admin.v1.IUpdateDatabaseRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.IUpdateDatabaseMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    updateDatabase(request: protos.google.firestore.admin.v1.IUpdateDatabaseRequest, options: CallOptions, callback: Callback<LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.IUpdateDatabaseMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    updateDatabase(request: protos.google.firestore.admin.v1.IUpdateDatabaseRequest, callback: Callback<LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.IUpdateDatabaseMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `updateDatabase()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.update_database.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_UpdateDatabase_async
     */
    checkUpdateDatabaseProgress(name: string): Promise<LROperation<protos.google.firestore.admin.v1.Database, protos.google.firestore.admin.v1.UpdateDatabaseMetadata>>;
    /**
     * Deletes a database.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.name
     *   Required. A name of the form
     *   `projects/{project_id}/databases/{database_id}`
     * @param {string} request.etag
     *   The current etag of the Database.
     *   If an etag is provided and does not match the current etag of the database,
     *   deletion will be blocked and a FAILED_PRECONDITION error will be returned.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.delete_database.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_DeleteDatabase_async
     */
    deleteDatabase(request?: protos.google.firestore.admin.v1.IDeleteDatabaseRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.IDeleteDatabaseMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    deleteDatabase(request: protos.google.firestore.admin.v1.IDeleteDatabaseRequest, options: CallOptions, callback: Callback<LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.IDeleteDatabaseMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    deleteDatabase(request: protos.google.firestore.admin.v1.IDeleteDatabaseRequest, callback: Callback<LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.IDeleteDatabaseMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `deleteDatabase()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.delete_database.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_DeleteDatabase_async
     */
    checkDeleteDatabaseProgress(name: string): Promise<LROperation<protos.google.firestore.admin.v1.Database, protos.google.firestore.admin.v1.DeleteDatabaseMetadata>>;
    /**
     * Creates a new database by restoring from an existing backup.
     *
     * The new database must be in the same cloud region or multi-region location
     * as the existing backup. This behaves similar to
     * {@link protos.google.firestore.admin.v1.FirestoreAdmin.CreateDatabase|FirestoreAdmin.CreateDatabase}
     * except instead of creating a new empty database, a new database is created
     * with the database type, index configuration, and documents from an existing
     * backup.
     *
     * The {@link protos.google.longrunning.Operation|long-running operation} can be used to
     * track the progress of the restore, with the Operation's
     * {@link protos.google.longrunning.Operation.metadata|metadata} field type being the
     * {@link protos.google.firestore.admin.v1.RestoreDatabaseMetadata|RestoreDatabaseMetadata}.
     * The {@link protos.google.longrunning.Operation.response|response} type is the
     * {@link protos.google.firestore.admin.v1.Database|Database} if the restore was
     * successful. The new database is not readable or writeable until the LRO has
     * completed.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. The project to restore the database in. Format is
     *   `projects/{project_id}`.
     * @param {string} request.databaseId
     *   Required. The ID to use for the database, which will become the final
     *   component of the database's resource name. This database ID must not be
     *   associated with an existing database.
     *
     *   This value should be 4-63 characters. Valid characters are /{@link protos.0-9|a-z}-/
     *   with first character a letter and the last a letter or a number. Must not
     *   be UUID-like /[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/.
     *
     *   "(default)" database ID is also valid.
     * @param {string} request.backup
     *   Required. Backup to restore from. Must be from the same project as the
     *   parent.
     *
     *   The restored database will be created in the same location as the source
     *   backup.
     *
     *   Format is: `projects/{project_id}/locations/{location}/backups/{backup}`
     * @param {google.firestore.admin.v1.Database.EncryptionConfig} [request.encryptionConfig]
     *   Optional. Encryption configuration for the restored database.
     *
     *   If this field is not specified, the restored database will use
     *   the same encryption configuration as the backup, namely
     *   {@link protos.google.firestore.admin.v1.Database.EncryptionConfig.use_source_encryption|use_source_encryption}.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is an object representing
     *   a long running operation. Its `promise()` method returns a promise
     *   you can `await` for.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.restore_database.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_RestoreDatabase_async
     */
    restoreDatabase(request?: protos.google.firestore.admin.v1.IRestoreDatabaseRequest, options?: CallOptions): Promise<[
        LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.IRestoreDatabaseMetadata>,
        protos.google.longrunning.IOperation | undefined,
        {} | undefined
    ]>;
    restoreDatabase(request: protos.google.firestore.admin.v1.IRestoreDatabaseRequest, options: CallOptions, callback: Callback<LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.IRestoreDatabaseMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    restoreDatabase(request: protos.google.firestore.admin.v1.IRestoreDatabaseRequest, callback: Callback<LROperation<protos.google.firestore.admin.v1.IDatabase, protos.google.firestore.admin.v1.IRestoreDatabaseMetadata>, protos.google.longrunning.IOperation | null | undefined, {} | null | undefined>): void;
    /**
     * Check the status of the long running operation returned by `restoreDatabase()`.
     * @param {String} name
     *   The operation name that will be passed.
     * @returns {Promise} - The promise which resolves to an object.
     *   The decoded operation object has result and metadata field to get information from.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#long-running-operations | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.restore_database.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_RestoreDatabase_async
     */
    checkRestoreDatabaseProgress(name: string): Promise<LROperation<protos.google.firestore.admin.v1.Database, protos.google.firestore.admin.v1.RestoreDatabaseMetadata>>;
    /**
     * Lists composite indexes.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. A parent name of the form
     *   `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}`
     * @param {string} request.filter
     *   The filter to apply to list results.
     * @param {number} request.pageSize
     *   The number of results to return.
     * @param {string} request.pageToken
     *   A page token, returned from a previous call to
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListIndexes|FirestoreAdmin.ListIndexes},
     *   that may be used to get the next page of results.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of {@link protos.google.firestore.admin.v1.Index|Index}.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listIndexesAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listIndexes(request?: protos.google.firestore.admin.v1.IListIndexesRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IIndex[],
        protos.google.firestore.admin.v1.IListIndexesRequest | null,
        protos.google.firestore.admin.v1.IListIndexesResponse
    ]>;
    listIndexes(request: protos.google.firestore.admin.v1.IListIndexesRequest, options: CallOptions, callback: PaginationCallback<protos.google.firestore.admin.v1.IListIndexesRequest, protos.google.firestore.admin.v1.IListIndexesResponse | null | undefined, protos.google.firestore.admin.v1.IIndex>): void;
    listIndexes(request: protos.google.firestore.admin.v1.IListIndexesRequest, callback: PaginationCallback<protos.google.firestore.admin.v1.IListIndexesRequest, protos.google.firestore.admin.v1.IListIndexesResponse | null | undefined, protos.google.firestore.admin.v1.IIndex>): void;
    /**
     * Equivalent to `listIndexes`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. A parent name of the form
     *   `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}`
     * @param {string} request.filter
     *   The filter to apply to list results.
     * @param {number} request.pageSize
     *   The number of results to return.
     * @param {string} request.pageToken
     *   A page token, returned from a previous call to
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListIndexes|FirestoreAdmin.ListIndexes},
     *   that may be used to get the next page of results.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing {@link protos.google.firestore.admin.v1.Index|Index} on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listIndexesAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listIndexesStream(request?: protos.google.firestore.admin.v1.IListIndexesRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listIndexes`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. A parent name of the form
     *   `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}`
     * @param {string} request.filter
     *   The filter to apply to list results.
     * @param {number} request.pageSize
     *   The number of results to return.
     * @param {string} request.pageToken
     *   A page token, returned from a previous call to
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListIndexes|FirestoreAdmin.ListIndexes},
     *   that may be used to get the next page of results.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   {@link protos.google.firestore.admin.v1.Index|Index}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.list_indexes.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_ListIndexes_async
     */
    listIndexesAsync(request?: protos.google.firestore.admin.v1.IListIndexesRequest, options?: CallOptions): AsyncIterable<protos.google.firestore.admin.v1.IIndex>;
    /**
     * Lists the field configuration and metadata for this database.
     *
     * Currently,
     * {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListFields|FirestoreAdmin.ListFields}
     * only supports listing fields that have been explicitly overridden. To issue
     * this query, call
     * {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListFields|FirestoreAdmin.ListFields}
     * with the filter set to `indexConfig.usesAncestorConfig:false` or
     * `ttlConfig:*`.
     *
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. A parent name of the form
     *   `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}`
     * @param {string} request.filter
     *   The filter to apply to list results. Currently,
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListFields|FirestoreAdmin.ListFields}
     *   only supports listing fields that have been explicitly overridden. To issue
     *   this query, call
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListFields|FirestoreAdmin.ListFields}
     *   with a filter that includes `indexConfig.usesAncestorConfig:false` or
     *   `ttlConfig:*`.
     * @param {number} request.pageSize
     *   The number of results to return.
     * @param {string} request.pageToken
     *   A page token, returned from a previous call to
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListFields|FirestoreAdmin.ListFields},
     *   that may be used to get the next page of results.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Promise} - The promise which resolves to an array.
     *   The first element of the array is Array of {@link protos.google.firestore.admin.v1.Field|Field}.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed and will merge results from all the pages into this array.
     *   Note that it can affect your quota.
     *   We recommend using `listFieldsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listFields(request?: protos.google.firestore.admin.v1.IListFieldsRequest, options?: CallOptions): Promise<[
        protos.google.firestore.admin.v1.IField[],
        protos.google.firestore.admin.v1.IListFieldsRequest | null,
        protos.google.firestore.admin.v1.IListFieldsResponse
    ]>;
    listFields(request: protos.google.firestore.admin.v1.IListFieldsRequest, options: CallOptions, callback: PaginationCallback<protos.google.firestore.admin.v1.IListFieldsRequest, protos.google.firestore.admin.v1.IListFieldsResponse | null | undefined, protos.google.firestore.admin.v1.IField>): void;
    listFields(request: protos.google.firestore.admin.v1.IListFieldsRequest, callback: PaginationCallback<protos.google.firestore.admin.v1.IListFieldsRequest, protos.google.firestore.admin.v1.IListFieldsResponse | null | undefined, protos.google.firestore.admin.v1.IField>): void;
    /**
     * Equivalent to `listFields`, but returns a NodeJS Stream object.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. A parent name of the form
     *   `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}`
     * @param {string} request.filter
     *   The filter to apply to list results. Currently,
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListFields|FirestoreAdmin.ListFields}
     *   only supports listing fields that have been explicitly overridden. To issue
     *   this query, call
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListFields|FirestoreAdmin.ListFields}
     *   with a filter that includes `indexConfig.usesAncestorConfig:false` or
     *   `ttlConfig:*`.
     * @param {number} request.pageSize
     *   The number of results to return.
     * @param {string} request.pageToken
     *   A page token, returned from a previous call to
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListFields|FirestoreAdmin.ListFields},
     *   that may be used to get the next page of results.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Stream}
     *   An object stream which emits an object representing {@link protos.google.firestore.admin.v1.Field|Field} on 'data' event.
     *   The client library will perform auto-pagination by default: it will call the API as many
     *   times as needed. Note that it can affect your quota.
     *   We recommend using `listFieldsAsync()`
     *   method described below for async iteration which you can stop as needed.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     */
    listFieldsStream(request?: protos.google.firestore.admin.v1.IListFieldsRequest, options?: CallOptions): Transform;
    /**
     * Equivalent to `listFields`, but returns an iterable object.
     *
     * `for`-`await`-`of` syntax is used with the iterable to get response elements on-demand.
     * @param {Object} request
     *   The request object that will be sent.
     * @param {string} request.parent
     *   Required. A parent name of the form
     *   `projects/{project_id}/databases/{database_id}/collectionGroups/{collection_id}`
     * @param {string} request.filter
     *   The filter to apply to list results. Currently,
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListFields|FirestoreAdmin.ListFields}
     *   only supports listing fields that have been explicitly overridden. To issue
     *   this query, call
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListFields|FirestoreAdmin.ListFields}
     *   with a filter that includes `indexConfig.usesAncestorConfig:false` or
     *   `ttlConfig:*`.
     * @param {number} request.pageSize
     *   The number of results to return.
     * @param {string} request.pageToken
     *   A page token, returned from a previous call to
     *   {@link protos.google.firestore.admin.v1.FirestoreAdmin.ListFields|FirestoreAdmin.ListFields},
     *   that may be used to get the next page of results.
     * @param {object} [options]
     *   Call options. See {@link https://googleapis.dev/nodejs/google-gax/latest/interfaces/CallOptions.html|CallOptions} for more details.
     * @returns {Object}
     *   An iterable Object that allows {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols | async iteration }.
     *   When you iterate the returned iterable, each element will be an object representing
     *   {@link protos.google.firestore.admin.v1.Field|Field}. The API will be called under the hood as needed, once per the page,
     *   so you can stop the iteration when you don't need more results.
     *   Please see the {@link https://github.com/googleapis/gax-nodejs/blob/master/client-libraries.md#auto-pagination | documentation }
     *   for more details and examples.
     * @example <caption>include:samples/generated/v1/firestore_admin.list_fields.js</caption>
     * region_tag:firestore_v1_generated_FirestoreAdmin_ListFields_async
     */
    listFieldsAsync(request?: protos.google.firestore.admin.v1.IListFieldsRequest, options?: CallOptions): AsyncIterable<protos.google.firestore.admin.v1.IField>;
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
     * Return a fully-qualified backup resource name string.
     *
     * @param {string} project
     * @param {string} location
     * @param {string} backup
     * @returns {string} Resource name string.
     */
    backupPath(project: string, location: string, backup: string): string;
    /**
     * Parse the project from Backup resource.
     *
     * @param {string} backupName
     *   A fully-qualified path representing Backup resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromBackupName(backupName: string): string | number;
    /**
     * Parse the location from Backup resource.
     *
     * @param {string} backupName
     *   A fully-qualified path representing Backup resource.
     * @returns {string} A string representing the location.
     */
    matchLocationFromBackupName(backupName: string): string | number;
    /**
     * Parse the backup from Backup resource.
     *
     * @param {string} backupName
     *   A fully-qualified path representing Backup resource.
     * @returns {string} A string representing the backup.
     */
    matchBackupFromBackupName(backupName: string): string | number;
    /**
     * Return a fully-qualified backupSchedule resource name string.
     *
     * @param {string} project
     * @param {string} database
     * @param {string} backup_schedule
     * @returns {string} Resource name string.
     */
    backupSchedulePath(project: string, database: string, backupSchedule: string): string;
    /**
     * Parse the project from BackupSchedule resource.
     *
     * @param {string} backupScheduleName
     *   A fully-qualified path representing BackupSchedule resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromBackupScheduleName(backupScheduleName: string): string | number;
    /**
     * Parse the database from BackupSchedule resource.
     *
     * @param {string} backupScheduleName
     *   A fully-qualified path representing BackupSchedule resource.
     * @returns {string} A string representing the database.
     */
    matchDatabaseFromBackupScheduleName(backupScheduleName: string): string | number;
    /**
     * Parse the backup_schedule from BackupSchedule resource.
     *
     * @param {string} backupScheduleName
     *   A fully-qualified path representing BackupSchedule resource.
     * @returns {string} A string representing the backup_schedule.
     */
    matchBackupScheduleFromBackupScheduleName(backupScheduleName: string): string | number;
    /**
     * Return a fully-qualified collectionGroup resource name string.
     *
     * @param {string} project
     * @param {string} database
     * @param {string} collection
     * @returns {string} Resource name string.
     */
    collectionGroupPath(project: string, database: string, collection: string): string;
    /**
     * Parse the project from CollectionGroup resource.
     *
     * @param {string} collectionGroupName
     *   A fully-qualified path representing CollectionGroup resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromCollectionGroupName(collectionGroupName: string): string | number;
    /**
     * Parse the database from CollectionGroup resource.
     *
     * @param {string} collectionGroupName
     *   A fully-qualified path representing CollectionGroup resource.
     * @returns {string} A string representing the database.
     */
    matchDatabaseFromCollectionGroupName(collectionGroupName: string): string | number;
    /**
     * Parse the collection from CollectionGroup resource.
     *
     * @param {string} collectionGroupName
     *   A fully-qualified path representing CollectionGroup resource.
     * @returns {string} A string representing the collection.
     */
    matchCollectionFromCollectionGroupName(collectionGroupName: string): string | number;
    /**
     * Return a fully-qualified database resource name string.
     *
     * @param {string} project
     * @param {string} database
     * @returns {string} Resource name string.
     */
    databasePath(project: string, database: string): string;
    /**
     * Parse the project from Database resource.
     *
     * @param {string} databaseName
     *   A fully-qualified path representing Database resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromDatabaseName(databaseName: string): string | number;
    /**
     * Parse the database from Database resource.
     *
     * @param {string} databaseName
     *   A fully-qualified path representing Database resource.
     * @returns {string} A string representing the database.
     */
    matchDatabaseFromDatabaseName(databaseName: string): string | number;
    /**
     * Return a fully-qualified field resource name string.
     *
     * @param {string} project
     * @param {string} database
     * @param {string} collection
     * @param {string} field
     * @returns {string} Resource name string.
     */
    fieldPath(project: string, database: string, collection: string, field: string): string;
    /**
     * Parse the project from Field resource.
     *
     * @param {string} fieldName
     *   A fully-qualified path representing Field resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromFieldName(fieldName: string): string | number;
    /**
     * Parse the database from Field resource.
     *
     * @param {string} fieldName
     *   A fully-qualified path representing Field resource.
     * @returns {string} A string representing the database.
     */
    matchDatabaseFromFieldName(fieldName: string): string | number;
    /**
     * Parse the collection from Field resource.
     *
     * @param {string} fieldName
     *   A fully-qualified path representing Field resource.
     * @returns {string} A string representing the collection.
     */
    matchCollectionFromFieldName(fieldName: string): string | number;
    /**
     * Parse the field from Field resource.
     *
     * @param {string} fieldName
     *   A fully-qualified path representing Field resource.
     * @returns {string} A string representing the field.
     */
    matchFieldFromFieldName(fieldName: string): string | number;
    /**
     * Return a fully-qualified index resource name string.
     *
     * @param {string} project
     * @param {string} database
     * @param {string} collection
     * @param {string} index
     * @returns {string} Resource name string.
     */
    indexPath(project: string, database: string, collection: string, index: string): string;
    /**
     * Parse the project from Index resource.
     *
     * @param {string} indexName
     *   A fully-qualified path representing Index resource.
     * @returns {string} A string representing the project.
     */
    matchProjectFromIndexName(indexName: string): string | number;
    /**
     * Parse the database from Index resource.
     *
     * @param {string} indexName
     *   A fully-qualified path representing Index resource.
     * @returns {string} A string representing the database.
     */
    matchDatabaseFromIndexName(indexName: string): string | number;
    /**
     * Parse the collection from Index resource.
     *
     * @param {string} indexName
     *   A fully-qualified path representing Index resource.
     * @returns {string} A string representing the collection.
     */
    matchCollectionFromIndexName(indexName: string): string | number;
    /**
     * Parse the index from Index resource.
     *
     * @param {string} indexName
     *   A fully-qualified path representing Index resource.
     * @returns {string} A string representing the index.
     */
    matchIndexFromIndexName(indexName: string): string | number;
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
