// Copyright DataStax, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import TypedEmitter from 'typed-emitter';

declare const __error: unique symbol;

/**
 * The options representing the blocking behavior of many admin operations.
 *
 * Said operations are typically require polling to determine completion. They may or may not be
 * extremely long-running, depending on the operation, but they are not instantaneous.
 *
 * The default behavior is to block until the operation is complete, with a `pollInterval` determined on a
 * method-by-method basis, but able to be overridden.
 *
 * Otherwise, it can be made "non-blocking" by setting `blocking` to `false`, where it's up to the caller
 * to determine when the operation is complete.
 *
 * @example
 * ```typescript
 * // Will block by default until the operation is complete.
 * const dbAdmin1 = await admin.createDatabase({...});
 *
 * // Will not block until the operation is complete.
 * // Still returned an AstraDbAdmin object, but it's not very useful
 * // until the operation completes.
 * const dbAdmin2 = await admin.createDatabase({...}, {
 *   blocking: false,
 * });
 *
 * // Blocks with a custom poll interval (per 5s).
 * const dbAdmin3 = await admin.createDatabase({...}, {
 *   blocking: true,
 *   pollInterval: 5000,
 * });
 * ```
 *
 * @remarks
 * By "blocking", we mean that the operation will not return until the operation is complete, which is
 * determined by polling the operation at a regular interval. "Non-blocking" means that the operation
 * makes the initial request, but then returns immediately, leaving it up to the caller to determine
 * when the operation is complete.
 *
 * If it's chosen not to block, keep in mind that the objects that the operation returns may not be
 * fully usable, or even usable at all, until the operation is complete. createDatabase, for example,
 * returns an AstraDbAdmin object, but there's no initialized database for it to work on until the
 * database is fully created.
 *
 * @field blocking - Whether to block the operation until it is complete.
 * @field pollInterval - The interval at which to poll the operation for completion.
 *
 * @public
 */
export declare type AdminBlockingOptions = PollBlockingOptions | NoBlockingOptions;

/**
 * Common base class for all admin command events.
 *
 * @public
 */
export declare abstract class AdminCommandEvent {
    /**
     * The path for the request, not including the Base URL.
     */
    readonly path: string;
    /**
     * The HTTP method for the request.
     */
    readonly method: 'GET' | 'POST' | 'DELETE';
    /**
     * The request body, if any.
     */
    readonly reqBody?: Record<string, any>;
    /**
     * The query parameters, if any.
     */
    readonly params?: Record<string, any>;
    /**
     * Whether the command is long-running or not, i.e. requires polling.
     */
    readonly longRunning: boolean;
    /* Excluded from this release type: __constructor */
}

/**
 * The events emitted by the {@link DataAPIClient}. These events are emitted at various stages of the
 * admin command's lifecycle. Intended for use for monitoring and logging purposes.
 *
 * @public
 */
export declare type AdminCommandEvents = {
    /**
     * Emitted when an admin command is started, before the initial HTTP request is made.
     */
    adminCommandStarted: (event: AdminCommandStartedEvent) => void;
    /**
     * Emitted when a command is polling in a long-running operation (i.e. create database).
     */
    adminCommandPolling: (event: AdminCommandPollingEvent) => void;
    /**
     * Emitted when an admin command has succeeded, after any necessary polling.
     */
    adminCommandSucceeded: (event: AdminCommandSucceededEvent) => void;
    /**
     * Emitted when an admin command has errored.
     */
    adminCommandFailed: (event: AdminCommandFailedEvent) => void;
};

/**
 * Event emitted when an admin command has errored.
 *
 * See {@link AdminCommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export declare class AdminCommandFailedEvent extends AdminCommandEvent {
    /**
     * The duration of the command, in milliseconds.
     */
    readonly duration: number;
    /**
     * The error that occurred.
     *
     * Typically, some {@link DevOpsAPIError}, commonly a {@link DevOpsAPIResponseError} or sometimes a
     * {@link DevOpsUnexpectedStateError}
     */
    readonly error: Error;
    /* Excluded from this release type: __constructor */
}

/**
 * Event emitted when a command is polling in a long-running operation (i.e. create database).
 *
 * Emits every time the command polls.
 *
 * See {@link AdminCommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export declare class AdminCommandPollingEvent extends AdminCommandEvent {
    /**
     * The elapsed time since the command was started, in milliseconds.
     */
    readonly elapsed: number;
    /**
     * The polling interval, in milliseconds.
     */
    readonly interval: number;
    /* Excluded from this release type: __constructor */
}

/**
 * Event emitted when an admin command is started. This is emitted before the initial HTTP request is made.
 *
 * See {@link AdminCommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export declare class AdminCommandStartedEvent extends AdminCommandEvent {
    /**
     * The timeout for the request, in milliseconds.
     */
    readonly timeout: number;
    /* Excluded from this release type: __constructor */
}

/**
 * Event emitted when an admin command has succeeded, after any necessary polling.
 *
 * See {@link AdminCommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export declare class AdminCommandSucceededEvent extends AdminCommandEvent {
    /**
     * The duration of the command, in milliseconds.
     */
    readonly duration: number;
    /**
     * The response body of the command, if any.
     */
    readonly resBody?: Record<string, any>;
    /**
     * Any warnings returned from the Data API that may point out deprecated/incorrect practices,
     * or any other issues that aren't strictly an error.
     *
     * Does not apply to Astra users, as the admin classes will use the DevOps API instead.
     */
    readonly warnings: string[];
    /* Excluded from this release type: __constructor */
}

/**
 * The options available spawning a new {@link AstraAdmin} instance.
 *
 * **Note that this is only available when using Astra as the underlying database.**
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
 *
 * @public
 */
export declare interface AdminSpawnOptions {
    /**
     * Whether to monitor commands for {@link AstraAdmin}-level & {@link DbAdmin}-level events through an event emitter.
     *
     * Defaults to `false` if never provided. However, if it was provided when creating the {@link DataAPIClient}, it will
     * default to that value instead.
     *
     * @example
     * ```typescript
     * const client = new DataAPIClient('*TOKEN*', {
     *   devopsOptions: {
     *     monitorCommands: true,
     *   },
     * });
     *
     * client.on('adminCommandStarted', (e) => {
     *   console.log(`Running command ${e.method} ${e.path}`);
     * });
     *
     * client.on('adminCommandPolling', (e) => {
     *   console.log(`Command ${e.method} ${e.path} running for ${e.elapsed}ms`);
     * });
     *
     * client.on('adminCommandSucceeded', (e) => {
     *   console.log(`Command ${e.method} ${e.path} took ${e.duration}ms`);
     * });
     *
     * client.on('adminCommandFailed', (e) => {
     *   console.error(`Command ${e.method} ${e.path} failed w/ error ${e.error}`);
     * });
     *
     * const admin = client.admin();
     *
     * // Logs:
     * // - Running command POST /databases
     * // - Command POST /databases running for <time>ms [x10]
     * // - Command POST /databases succeeded in <time>ms
     * await admin.createDatabase({ ... });
     * ```
     *
     * @defaultValue false
     *
     * @see AdminCommandEvents
     */
    monitorCommands?: boolean;
    /**
     * The access token for the DevOps API, typically of the format `'AstraCS:...'`.
     *
     * If never provided, this will default to the token provided when creating the {@link DataAPIClient}.
     *
     * May be useful for if you want to use a stronger token for the DevOps API than the Data API.
     *
     * @example
     * ```typescript
     * const client = new DataAPIClient('weak-token');
     *
     * // Using 'weak-token' as the token
     * const db = client.db();
     *
     * // Using 'strong-token' instead of 'weak-token'
     * const admin = client.admin({ adminToken: 'strong-token' });
     * ```
     */
    adminToken?: string | TokenProvider | null;
    /**
     * The base URL for the devops API, which is typically always going to be the following:
     * ```
     * https://api.astra.datastax.com/v2
     * ```
     */
    endpointUrl?: string;
}

/**
 * Represents *some* bulk write operation.
 *
 * Be careful not to pass in multiple operations in the same object (only one operation per object allowed)
 *
 * @public
 */
export declare type AnyBulkWriteOperation<TSchema extends SomeDoc> = {
    insertOne: InsertOneModel<TSchema>;
} | {
    replaceOne: ReplaceOneModel<TSchema>;
} | {
    updateOne: UpdateOneModel<TSchema>;
} | {
    updateMany: UpdateManyModel<TSchema>;
} | {
    deleteOne: DeleteOneModel<TSchema>;
} | {
    deleteMany: DeleteManyModel<TSchema>;
};

/**
 * Represents filter operations exclusive to array (or dynamically typed) fields
 *
 * @public
 */
export declare interface ArrayFilterOps<Elem> {
    /**
     * Checks if the array is of a certain size.
     */
    $size?: number;
    /**
     * Checks if the array contains all the specified elements.
     */
    $all?: Elem;
}

/**
 * Types some array operations. Not inherently strict or weak.
 *
 * @public
 */
export declare type ArrayUpdate<Schema> = {
    [K in keyof Schema as any[] extends Schema[K] ? K : never]?: PickArrayTypes<Schema[K]>;
};

/**
 * An administrative class for managing Astra databases, including creating, listing, and deleting databases.
 *
 * **Shouldn't be instantiated directly; use {@link DataAPIClient.admin} to obtain an instance of this class.**
 *
 * To perform admin tasks on a per-database basis, see the {@link AstraDbAdmin} class.
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('token');
 *
 * // Create an admin instance with the default token
 * const admin1 = client.admin();
 *
 * // Create an admin instance with a custom token
 * const admin2 = client.admin({ adminToken: 'stronger-token' });
 *
 * const dbs = await admin1.listDatabases();
 * console.log(dbs);
 * ```
 *
 * @see DataAPIClient.admin
 * @see AstraDbAdmin
 *
 * @public
 */
export declare class AstraAdmin {
    #private;
    /* Excluded from this release type: __constructor */
    /**
     * Spawns a new {@link Db} instance using a direct endpoint and given options.
     *
     * This endpoint should include the protocol and the hostname, but not the path. It's typically in the form of
     * `https://<db_id>-<region>.apps.astra.datastax.com`, but it can be used with DSE or any other Data-API-compatible
     * endpoint.
     *
     * The given options will override any default options set when creating the {@link DataAPIClient} through
     * a deep merge (i.e. unset properties in the options object will just default to the default options).
     *
     * @example
     * ```typescript
     * const admin = new DataAPIClient('token').admin();
     *
     * const db1 = admin.db('https://<db_id>-<region>.apps.astra.datastax.com');
     *
     * const db2 = admin.db('https://<db_id>-<region>.apps.astra.datastax.com', {
     *   keyspace: 'my-keyspace',
     *   useHttp2: false,
     * });
     * ```
     *
     * @remarks
     * Note that this does not perform any IO or validation on if the endpoint is valid or not. It's up to the user to
     * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
     * instead.
     *
     * @param endpoint - The direct endpoint to use.
     * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
     *
     * @returns A new {@link Db} instance.
     */
    db(endpoint: string, options?: DbSpawnOptions): Db;
    /**
     * Spawns a new {@link Db} instance using a direct endpoint and given options.
     *
     * This overload is purely for user convenience, but it **only supports using Astra as the underlying database**. For
     * DSE or any other Data-API-compatible endpoint, use the other overload instead.
     *
     * The given options will override any default options set when creating the {@link DataAPIClient} through
     * a deep merge (i.e. unset properties in the options object will just default to the default options).
     *
     * @example
     * ```typescript
     * const admin = new DataAPIClient('token').admin();
     *
     * const db1 = admin.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1');
     *
     * const db2 = admin.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1', {
     *   keyspace: 'my-keyspace',
     *   useHttp2: false,
     * });
     * ```
     *
     * @remarks
     * Note that this does not perform any IO or validation on if the endpoint is valid or not. It's up to the user to
     * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
     * instead.
     *
     * @param id - The database ID to use.
     * @param region - The region to use.
     * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
     *
     * @returns A new {@link Db} instance.
     */
    db(id: string, region: string, options?: DbSpawnOptions): Db;
    /**
     * Spawns a new {@link AstraDbAdmin} instance for a database using a direct endpoint and given options.
     *
     * This endpoint should include the protocol and the hostname, but not the path. It's typically in the form of
     * `https://<db_id>-<region>.apps.astra.datastax.com`, but it can be used with DSE or any other Data-API-compatible
     * endpoint.
     *
     * The given options are for the underlying implicitly-created {@link Db} instance, not the {@link AstraDbAdmin} instance.
     * The db admin will use the same options as this {@link AstraAdmin} instance.
     *
     * The given options will override any default options set when creating the {@link DataAPIClient} through
     * a deep merge (i.e. unset properties in the options object will just default to the default options).
     *
     * @example
     * ```typescript
     * const admin = new DataAPIClient('token').admin();
     *
     * const dbAdmin1 = admin.dbAdmin('https://<db_id>-<region>...');
     *
     * const dbAdmin2 = admin.dbAdmin('https://<db_id>-<region>...', {
     *   keyspace: 'my-keyspace',
     *   useHttp2: false,
     * });
     * ```
     *
     * @remarks
     * Note that this does not perform any IO or validation on if the endpoint is valid or not. It's up to the user to
     * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
     * instead.
     *
     * @param endpoint - The direct endpoint to use.
     * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
     *
     * @returns A new {@link Db} instance.
     */
    dbAdmin(endpoint: string, options?: DbSpawnOptions): AstraDbAdmin;
    /**
     * Spawns a new {@link Db} instance using a direct endpoint and given options.
     *
     * This overload is purely for user convenience, but it **only supports using Astra as the underlying database**. For
     * DSE or any other Data-API-compatible endpoint, use the other overload instead.
     *
     * The given options are for the underlying implicitly-created {@link Db} instance, not the {@link AstraDbAdmin} instance.
     * The db admin will use the same options as this {@link AstraAdmin} instance.
     *
     * The given options will override any default options set when creating the {@link DataAPIClient} through
     * a deep merge (i.e. unset properties in the options object will just default to the default options).
     *
     * @example
     * ```typescript
     * const admin = new DataAPIClient('token').admin();
     *
     * const dbAdmin1 = admin.dbAdmin('a6a1d8d6-...-377566f345bf', 'us-east1');
     *
     * const dbAdmin2 = admin.dbAdmin('a6a1d8d6-...-377566f345bf', 'us-east1', {
     *   keyspace: 'my-keyspace',
     *   useHttp2: false,
     * });
     * ```
     *
     * @remarks
     * Note that this does not perform any IO or validation on if the endpoint is valid or not. It's up to the user to
     * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
     * instead.
     *
     * @param id - The database ID to use.
     * @param region - The region to use.
     * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
     *
     * @returns A new {@link Db} instance.
     */
    dbAdmin(id: string, region: string, options?: DbSpawnOptions): AstraDbAdmin;
    /**
     * Fetches the complete information about the database, such as the database name, IDs, region, status, actions, and
     * other metadata.
     *
     * @example
     * ```typescript
     * const info = await admin.info('<db_id>');
     * console.log(info.info.name, info.creationTime);
     * ```
     *
     * @returns A promise that resolves to the complete database information.
     */
    dbInfo(id: string, options?: WithTimeout): Promise<FullDatabaseInfo>;
    /**
     * Lists all databases in the current org/account, matching the optionally provided filter.
     *
     * Note that this method is paginated, but the page size is high enough that most users won't need to worry about it.
     * However, you can use the `limit` and `skip` options to control the number of results returned and the starting point
     * for the results, as needed.
     *
     * You can also filter by the database status using the `include` option, and by the database provider using the
     * `provider` option.
     *
     * See {@link ListDatabasesOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * const admin = new DataAPIClient('AstraCS:...').admin();
     *
     * const activeDbs = await admin.listDatabases({ include: 'ACTIVE' });
     *
     * for (const db of activeDbs) {
     *   console.log(`Database ${db.name} is active`);
     * }
     * ```
     *
     * @param options - The options to filter the databases by.
     * @returns A list of the complete information for all the databases matching the given filter.
     */
    listDatabases(options?: ListDatabasesOptions): Promise<FullDatabaseInfo[]>;
    /**
     * Creates a new database with the given configuration.
     *
     * **NB. this is a long-running operation. See {@link AdminBlockingOptions} about such blocking operations.** The
     * default polling interval is 10 seconds. Expect it to take roughly 2 min to complete.
     *
     * Note that **the `name` field is non-unique** and thus creating a database, even with the same options, is **not
     * idempotent**.
     *
     * You may also provide options for the implicit {@link Db} instance that will be created with the database, which
     * will override any default options set when creating the {@link DataAPIClient} through a deep merge (i.e. unset
     * properties in the options object will just default to the default options).
     *
     * See {@link CreateDatabaseOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * const newDbAdmin1 = await admin.createDatabase({
     *   name: 'my_database_1',
     *   cloudProvider: 'GCP',
     *   region: 'us-east1',
     * });
     *
     * // Prints '[]' as there are no collections in the database yet
     * console.log(newDbAdmin1.db().listCollections());
     *
     * const newDbAdmin2 = await admin.createDatabase({
     *   name: 'my_database_2',
     *   cloudProvider: 'GCP',
     *   region: 'us-east1',
     *   keyspace: 'my_keyspace',
     * }, {
     *   blocking: false,
     *   dbOptions: {
     *     useHttp2: false,
     *     token: '<weaker-token>',
     *   },
     * });
     *
     * // Can't do much else as the database is still initializing
     * console.log(newDbAdmin2.db().id);
     * ```
     *
     * @remarks
     * Note that if you choose not to block, the returned {@link AstraDbAdmin} object will not be very useful until the
     * operation completes, which is up to the caller to determine.
     *
     * @param config - The configuration for the new database.
     * @param options - The options for the blocking behavior of the operation.
     *
     * @returns The AstraDbAdmin instance for the newly created database.
     */
    createDatabase(config: DatabaseConfig, options?: CreateDatabaseOptions): Promise<AstraDbAdmin>;
    /**
     * Terminates a database by ID or by a given {@link Db} instance.
     *
     * **NB. this is a long-running operation. See {@link AdminBlockingOptions} about such blocking operations.** The
     * default polling interval is 10 seconds. Expect it to take roughly 6-7 min to complete.
     *
     * The database info will still be accessible by ID, or by using the {@link AstraAdmin.listDatabases} method with the filter
     * set to `'ALL'` or `'TERMINATED'`. However, all of its data will very much be lost.
     *
     * @example
     * ```typescript
     * const db = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
     * await admin.dropDatabase(db);
     *
     * // Or just
     * await admin.dropDatabase('a6a1d8d6-31bc-4af8-be57-377566f345bf');
     * ```
     *
     * @param db - The database to drop, either by ID or by instance.
     * @param options - The options for the blocking behavior of the operation.
     *
     * @returns A promise that resolves when the operation completes.
     *
     * @remarks Use with caution. Wear a harness. Don't say I didn't warn you.
     */
    dropDatabase(db: Db | string, options?: AdminBlockingOptions): Promise<void>;
    private get _httpClient();
}

/**
 * An administrative class for managing Astra databases, including creating, listing, and deleting keyspaces.
 *
 * **Shouldn't be instantiated directly; use {@link Db.admin} or {@link AstraDbAdmin.dbAdmin} to obtain an instance of this class.**
 *
 * To manage databases as a whole, see {@link AstraAdmin}.
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('*TOKEN*');
 *
 * // Create an admin instance through a Db
 * const db = client.db('*ENDPOINT*');
 * const dbAdmin1 = db.admin();
 * const dbAdmin2 = db.admin({ adminToken: 'stronger-token' });
 *
 * // Create an admin instance through an AstraAdmin
 * const admin = client.admin();
 * const dbAdmin3 = admin.dbAdmin('*ENDPOINT*');
 * const dbAdmin4 = admin.dbAdmin('*DB_ID*', '*REGION*');
 *
 * const keyspaces = await admin1.listKeyspaces();
 * console.log(keyspaces);
 *
 * const dbInfo = await admin1.info();
 * console.log(dbInfo);
 * ```
 *
 * @see Db.admin
 * @see AstraDbAdmin.dbAdmin
 *
 * @public
 */
export declare class AstraDbAdmin extends DbAdmin {
    #private;
    /* Excluded from this release type: __constructor */
    /**
     * Gets the ID of the Astra DB instance this object is managing.
     *
     * @returns The ID of the Astra DB instance.
     */
    get id(): string;
    /**
     * Gets the underlying `Db` object. The options for the db were set when the `AstraDbAdmin` instance, or whatever
     * spawned it, was created.
     *
     * @example
     * ```typescript
     * const dbAdmin = client.admin().dbAdmin('<endpoint>', {
     *   keyspace: 'my-keyspace',
     *   useHttp2: false,
     * });
     *
     * const db = dbAdmin.db();
     * console.log(db.id);
     * ```
     *
     * @returns The underlying `Db` object.
     */
    db(): Db;
    /**
     * Returns detailed information about the availability and usage of the vectorize embedding providers available on the
     * current database (may vary based on cloud provider & region).
     *
     * @example
     * ```typescript
     * const { embeddingProviders } = await dbAdmin.findEmbeddingProviders();
     *
     * // ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']
     * console.log(embeddingProviders['openai'].models.map(m => m.name));
     * ```
     *
     * @param options - The options for the timeout of the operation.
     *
     * @returns The available embedding providers.
     */
    findEmbeddingProviders(options?: WithTimeout): Promise<FindEmbeddingProvidersResult>;
    /**
     * Fetches the complete information about the database, such as the database name, IDs, region, status, actions, and
     * other metadata.
     *
     * The method issues a request to the DevOps API each time it is invoked, without caching mechanisms;
     * this ensures up-to-date information for usages such as real-time collection validation by the application.
     *
     * @example
     * ```typescript
     * const info = await dbAdmin.info();
     * console.log(info.info.name, info.creationTime);
     * ```
     *
     * @returns A promise that resolves to the complete database information.
     */
    info(options?: WithTimeout): Promise<FullDatabaseInfo>;
    /**
     * Lists the keyspaces in the database.
     *
     * The first element in the returned array is the default keyspace of the database, and the rest are additional
     * keyspaces in no particular order.
     *
     * @example
     * ```typescript
     * const keyspaces = await dbAdmin.listKeyspaces();
     *
     * // ['default_keyspace', 'my_other_keyspace']
     * console.log(keyspaces);
     * ```
     *
     * @returns A promise that resolves to list of all the keyspaces in the database.
     */
    listKeyspaces(options?: WithTimeout): Promise<string[]>;
    /**
     * Lists the keyspaces in the database.
     *
     * This is now a deprecated alias for the strictly equivalent {@link AstraDbAdmin.listKeyspaces}, and will be removed
     * in an upcoming major version.
     *
     * @deprecated - Prefer {@link AstraDbAdmin.listKeyspaces} instead.
     */
    listNamespaces(options?: WithTimeout): Promise<string[]>;
    /**
     * Creates a new, additional, keyspace for this database.
     *
     * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
     * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
     *
     * @example
     * ```typescript
     * await dbAdmin.createKeyspace('my_other_keyspace1');
     *
     * // ['default_keyspace', 'my_other_keyspace1']
     * console.log(await dbAdmin.listKeyspaces());
     *
     * await dbAdmin.createKeyspace('my_other_keyspace2', {
     *   blocking: false,
     * });
     *
     * // Will not include 'my_other_keyspace2' until the operation completes
     * console.log(await dbAdmin.listKeyspaces());
     * ```
     *
     * @remarks
     * Note that if you choose not to block, the created keyspace will not be able to be used until the
     * operation completes, which is up to the caller to determine.
     *
     * @param keyspace - The name of the new keyspace.
     * @param options - The options for the blocking behavior of the operation.
     *
     * @returns A promise that resolves when the operation completes.
     */
    createKeyspace(keyspace: string, options?: CreateKeyspaceOptions): Promise<void>;
    /**
     * Creates a new, additional, keyspace for this database.
     *
     * This is now a deprecated alias for the strictly equivalent {@link AstraDbAdmin.createKeyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link AstraDbAdmin.createKeyspace} instead.
     */
    createNamespace(keyspace: string, options?: CreateNamespaceOptions): Promise<void>;
    /**
     * Drops a keyspace from this database.
     *
     * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
     * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
     *
     * @example
     * ```typescript
     * await dbAdmin.dropKeyspace('my_other_keyspace1');
     *
     * // ['default_keyspace', 'my_other_keyspace2']
     * console.log(await dbAdmin.listKeyspaces());
     *
     * await dbAdmin.dropKeyspace('my_other_keyspace2', {
     *   blocking: false,
     * });
     *
     * // Will still include 'my_other_keyspace2' until the operation completes
     * // ['default_keyspace', 'my_other_keyspace2']
     * console.log(await dbAdmin.listKeyspaces());
     * ```
     *
     * @remarks
     * Note that if you choose not to block, the keyspace will still be able to be used until the operation
     * completes, which is up to the caller to determine.
     *
     * @param keyspace - The name of the keyspace to drop.
     * @param options - The options for the blocking behavior of the operation.
     *
     * @returns A promise that resolves when the operation completes.
     */
    dropKeyspace(keyspace: string, options?: AdminBlockingOptions): Promise<void>;
    /**
     Drops a keyspace from this database.
     *
     * This is now a deprecated alias for the strictly equivalent {@link AstraDbAdmin.dropKeyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link AstraDbAdmin.dropKeyspace} instead.
     */
    dropNamespace(keyspace: string, options?: AdminBlockingOptions): Promise<void>;
    /**
     * Drops the database.
     *
     * **NB. this is a long-running operation. See {@link AdminBlockingOptions} about such blocking operations.** The
     * default polling interval is 10 seconds. Expect it to take roughly 6-7 min to complete.
     *
     * The database info will still be accessible by ID, or by using the {@link AstraAdmin.listDatabases} method with the filter
     * set to `'ALL'` or `'TERMINATED'`. However, all of its data will very much be lost.
     *
     * @example
     * ```typescript
     * const db = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
     * await db.admin().drop();
     * ```
     *
     * @param options - The options for the blocking behavior of the operation.
     *
     * @returns A promise that resolves when the operation completes.
     *
     * @remarks Use with caution. Use a surge protector. Don't say I didn't warn you.
     */
    drop(options?: AdminBlockingOptions): Promise<void>;
    private get _httpClient();
}

/**
 * An embedding headers provider which translates AWS access keys into the appropriate authentication headers for
 * AWS-based embedding providers (bedrock).
 *
 * Sets the headers `x-embedding-access-id` and `x-embedding-secret-id`.
 *
 * @example
 * ```typescript
 * const provider = new AWSEmbeddingHeadersProvider('access-key-id', 'secret-access-key');
 * const collection = await db.collection('my_coll', { embeddingApiKey: provider });
 * ```
 *
 * @see EmbeddingHeadersProvider
 *
 * @public
 */
export declare class AWSEmbeddingHeadersProvider extends EmbeddingHeadersProvider {
    #private;
    /**
     * Constructs an instead of the {@link TokenProvider}.
     *
     * @param accessKeyId - The access key ID part of the AWS access keys
     * @param secretAccessKey - The secret access key part of the AWS access keys
     */
    constructor(accessKeyId: string, secretAccessKey: string);
    /**
     * Returns the appropriate embedding auth headers.
     *
     * @returns the appropriate embedding auth headers.
     */
    getHeaders(): Record<string, string>;
}

/**
 * Represents an error that occurred during a `bulkWrite` operation (which is, generally, paginated).
 *
 * Contains the number of documents that were successfully inserted, updated, deleted, etc., as well as the cumulative
 * errors that occurred during the operation.
 *
 * If the operation was ordered, the results will be in the same order as the operations that were attempted to be
 * performed.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 * @field partialResult - The partial result of the `BulkWrite` operation that was performed
 *
 * @public
 */
export declare class BulkWriteError extends CumulativeDataAPIError {
    /**
     * The name of the error. This is always 'BulkWriteError'.
     */
    name: string;
    /**
     * The partial result of the `BulkWrite` operation that was performed. This is *always* defined, and is the result
     * of all successful operations.
     */
    readonly partialResult: BulkWriteResult<SomeDoc>;
}

/**
 * Options for bulkWrite.
 *
 * The parameters depend on the `ordered` option. If `ordered` is `true`, the `parallel` option is not allowed.
 *
 * @see Collection.bulkWrite
 *
 * @public
 */
export declare type BulkWriteOptions = BulkWriteOrderedOptions | BulkWriteUnorderedOptions;

/**
 * Options for insertMany when `ordered` is `true`.
 *
 * @field ordered - If `true`, the operations are executed in the order provided.
 *
 * @see Collection.bulkWrite
 *
 * @public
 */
export declare interface BulkWriteOrderedOptions extends WithTimeout {
    /**
     * If `true`, the operations are executed in the order provided. If an error occurs, the operation stops and the
     * remaining operations are not executed.
     */
    ordered: true;
}

/**
 * Represents the result of a bulk write operation.
 *
 * @public
 */
export declare class BulkWriteResult<Schema extends SomeDoc> {
    /**
     * The number of documents deleted.
     */
    readonly deletedCount: number;
    /**
     * The number of documents inserted.
     */
    readonly insertedCount: number;
    /**
     * The number of documents matched by an update operation.
     */
    readonly matchedCount: number;
    /**
     * The number of documents modified.
     */
    readonly modifiedCount: number;
    /**
     * The number of documents upserted.
     */
    readonly upsertedCount: number;
    /**
     * Upserted document generated ids. Sparse array, indexed by the position of the upserted operation in the bulk
     * write request.
     */
    readonly upsertedIds: Record<number, IdOf<Schema>>;
    private readonly _raw;
    /* Excluded from this release type: __constructor */
    /**
     * Returns the raw, internal result.
     *
     * @returns The raw, internal result.
     */
    getRawResponse(): Record<string, any>[];
    /**
     * Returns the upserted id at the given index.
     *
     * @param index - The index of the upserted id to retrieve.
     *
     * @returns The upserted id at the given index, or `undefined` if there is no upserted id at that index.
     */
    getUpsertedIdAt(index: number): IdOf<Schema> | undefined;
}

/**
 * Options for insertMany when `ordered` is `false`.
 *
 * @field ordered - If `false` or unset, the documents are inserted in an arbitrary, parallelized order.
 * @field parallel - The number of concurrent requests to use.
 *
 * @see Collection.bulkWrite
 *
 * @public
 */
export declare interface BulkWriteUnorderedOptions extends WithTimeout {
    /**
     * If `false`, the operations are inserted in an arbitrary order. If an error occurs, the operation stops but the
     * remaining operations are still executed. This allows the operations to be parallelized for better performance.
     */
    ordered?: false;
    /**
     * The number of concurrent requests to use
     */
    concurrency?: number;
}

/**
 * The caller information to send with requests, of the form `[name, version?]`, or an array of such.
 *
 * **Intended generally for integrations or frameworks that wrap the client.**
 *
 * Used to identify the client making requests to the server.
 *
 * It will be sent in the headers of the request as such:
 * ```
 * User-Agent: ...<name>/<version> astra-db-ts/<version>
 * ```
 *
 * If no caller information is provided, the client will simply be identified as `astra-db-ts/<version>`.
 *
 * **NB. If providing an array of callers, they should be ordered from most important to least important.**
 *
 * @public
 */
export declare type Caller = [name: string, version?: string];

/**
 * Represents the interface to a collection in the database.
 *
 * **Shouldn't be directly instantiated, but rather created via {@link Db.createCollection},
 * or connected to using {@link Db.collection}**.
 *
 * Typed as `Collection<Schema>` where `Schema` is the type of the documents in the collection.
 * Operations on the collection will be strongly typed if a specific schema is provided, otherwise
 * remained largely weakly typed if no type is provided, which may be preferred for dynamic data
 * access & operations.
 *
 * @example
 * ```typescript
 * interface PersonSchema {
 *   name: string,
 *   age?: number,
 * }
 *
 * const collection = await db.createCollection<PersonSchema>('my_collection');
 * await collection.insertOne({ _id: '1', name: 'John Doe' });
 * await collection.drop();
 * ```
 *
 * @see SomeDoc
 * @see VectorDoc
 *
 * @public
 */
export declare class Collection<Schema extends SomeDoc = SomeDoc> {
    #private;
    /**
     * The name of the collection.
     */
    readonly collectionName: string;
    /**
     * The keyspace that the collection resides in.
     */
    readonly keyspace: string;
    /**
     * The keyspace that the collection resides in.
     *
     * This is now a deprecated alias for the strictly equivalent {@link Collection.keyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link Collection.keyspace} instead.
     */
    readonly namespace: string;
    /* Excluded from this release type: __constructor */
    /**
     * Inserts a single document into the collection atomically.
     *
     * If the document does not contain an `_id` field, the server will generate an id for the document. The type of the
     * id may be specified in {@link CollectionOptions.defaultId} at creation, otherwise it'll just be a UUID string. This
     * generation does not mutate the document.
     *
     * If an `_id` is provided which corresponds to a document that already exists in the collection, an error is raised,
     * and the insertion fails.
     *
     * See {@link InsertOneOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * // Insert a document with a specific ID
     * await collection.insertOne({ _id: '1', name: 'John Doe' });
     * await collection.insertOne({ _id: new ObjectID(), name: 'Jane Doe' });
     * await collection.insertOne({ _id: UUID.v7(), name: 'Dane Joe' });
     *
     * // Insert a document with an autogenerated ID
     * await collection.insertOne({ name: 'Jane Doe' });
     *
     * // Insert a vector-enabled document
     * await collection.insertOne({ name: 'Jane Doe', $vector: [.12, .52, .32] });
     * await collection.insertOne({ name: 'Jane Doe', $vectorize: "Hey there!" });
     *
     * // Use the inserted ID (generated or not)
     * const resp = await collection.insertOne({ name: 'Lemmy' });
     * console.log(resp.insertedId);
     * ```
     *
     * @param document - The document to insert.
     * @param options - The options for this operation.
     *
     * @returns The ID of the inserted document.
     */
    insertOne(document: MaybeId<Schema>, options?: InsertOneOptions): Promise<InsertOneResult<Schema>>;
    /**
     * Inserts many documents into the collection.
     *
     * **NB. This function paginates the insertion of documents in chunks to avoid running into insertion limits. This
     * means multiple requests may be made to the server, and the operation may not be atomic.**
     *
     * If any document does not contain an `_id` field, the server will generate an id for the document. The type of the
     * id may be specified in {@link CollectionOptions.defaultId} at creation, otherwise it'll just be a UUID string. This
     * generation will not mutate the documents.
     *
     * If any `_id` is provided which corresponds to a document that already exists in the collection, an error is raised,
     * and the insertion (partially) fails.
     *
     * You may set the `ordered` option to `true` to stop the operation after the first error; otherwise all documents
     * may be parallelized and processed in arbitrary order, improving, perhaps vastly, performance.
     *
     * You can set the `concurrency` option to control how many network requests are made in parallel on unordered
     * insertions. Defaults to `8`.
     *
     * If a 2XX insertion error occurs, the operation will throw an {@link InsertManyError} containing the partial result.
     *
     * See {@link InsertManyOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * try {
     *   await collection.insertMany([
     *     { _id: '1', name: 'John Doe' },
     *     { name: 'Jane Doe' },
     *   ]);
     *
     *   await collection.insertMany([
     *     { _id: '1', name: 'John Doe', $vector: [.12, .52, .32] },
     *     { name: 'Jane Doe', $vectorize: "The Ace of Spades" },
     *   ], {
     *     ordered: true,
     *   });
     *
     *   const batch = Array.from({ length: 500 }, (_, i) => ({
     *     name: 'Thing #' + i,
     *   }));
     *   await collection.insertMany(batch, { concurrency: 10 });
     * } catch (e) {
     *   if (e instanceof InsertManyError) {
     *     console.log(e.insertedIds);
     *   }
     * }
     * ```
     *
     * @remarks
     * This operation is not atomic. Depending on the amount of inserted documents, and if it's ordered or not, it can
     * keep running (in a blocking way) for a macroscopic amount of time. In that case, new documents that are inserted
     * from another concurrent process/application may be inserted during the execution of this method call, and if there
     * are duplicate keys, it's not easy to predict which application will win the race.
     *
     * --
     *
     * *If a thrown exception is not due to an insertion error, e.g. a `5xx` error or network error, the operation will throw the
     * underlying error.*
     *
     * *In case of an unordered request, if the error was a simple insertion error, a `InsertManyError` will be thrown
     * after every document has been attempted to be inserted. If it was a `5xx` or similar, the error will be thrown
     * immediately.*
     *
     * @param documents - The documents to insert.
     * @param options - The options for this operation.
     *
     * @returns The IDs of the inserted documents (and the count)
     *
     * @throws InsertManyError - If the operation fails.
     */
    insertMany(documents: MaybeId<Schema>[], options?: InsertManyOptions): Promise<InsertManyResult<Schema>>;
    /**
     * Atomically updates a single document in the collection.
     *
     * If `upsert` is set to true, it will insert the document if no match is found.
     *
     * You can also specify a sort option to determine which document to update if multiple documents match the filter.
     *
     * See {@link UpdateOneOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * // Update by ID
     * await collection.insertOne({ _id: '1', name: 'John Doe' });
     *
     * await collection.updateOne(
     *   { _id: '1' },
     *   { $set: { name: 'Jane Doe' }
     * });
     *
     * // Update by vector search
     * await collection.insertOne({ name: 'John Doe', $vector: [.12, .52, .32] });
     *
     * await collection.updateOne(
     *   { name: 'John Doe' },
     *   { $set: { name: 'Jane Doe', $vectorize: "Oooooh, she's a little runaway" } },
     *   { sort: { $vector: [.09, .58, .21] } }
     * );
     * ```
     *
     * @param filter - A filter to select the document to update.
     * @param update - The update to apply to the selected document.
     * @param options - The options for this operation.
     *
     * @returns A summary of what changed.
     *
     * @see StrictFilter
     * @see StrictUpdateFilter
     * @see StrictSort
     */
    updateOne(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: UpdateOneOptions): Promise<UpdateOneResult<Schema>>;
    /**
     * Updates many documents in the collection.
     *
     * **NB. This function paginates the updating of documents in chunks to avoid running into insertion limits. This
     * means multiple requests may be made to the server, and the operation may not be atomic.**
     *
     * If `upsert` is set to true, it will insert a document if no match is found.
     *
     * You can also specify a sort option to determine which documents to update if multiple documents match the filter.
     *
     * See {@link UpdateManyOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * await collection.insertMany([
     *   { _id: '1', name: 'John Doe', car: 'Renault Twizy' },
     *   { _id: UUID.v4(), name: 'Jane Doe' },
     *   { name: 'Dane Joe' },
     * ]);
     *
     * // Will give 'Jane' and 'Dane' a car 'unknown'
     * await collection.updateMany({
     *   car: { $exists: false },
     * }, {
     *   $set: { car: 'unknown' },
     * });
     *
     * // Will upsert a document with name 'Anette' and car 'Volvo v90'
     * await collection.updateMany({
     *   name: 'Anette',
     * }, {
     *   $set: { car: 'Volvo v90' },
     * }, {
     *   upsert: true,
     * });
     * ```
     *
     * @remarks
     * This operation is not atomic. Depending on the amount of matching documents, it can keep running (in a blocking
     * way) for a macroscopic amount of time. In that case, new documents that are inserted from another concurrent process/
     * application at the same time may be updated during the execution of this method call. In other words, it cannot
     * easily be predicted whether a given newly-inserted document will be picked up by the updateMany command or not.
     *
     * @param filter - A filter to select the documents to update.
     * @param update - The update to apply to the selected documents.
     * @param options - The options for this operation.
     *
     * @returns A summary of what changed.
     *
     * @see StrictFilter
     * @see StrictUpdateFilter
     */
    updateMany(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: UpdateManyOptions): Promise<UpdateManyResult<SomeDoc>>;
    /**
     * Replaces a single document in the collection.
     *
     * If `upsert` is set to true, it will insert the replacement regardless of if no match is found.
     *
     * See {@link ReplaceOneOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * await collection.insertOne({
     *   _id: '1',
     *   name: 'John Doe',
     *   $vector: [.12, .52, .32],
     * });
     *
     * // Replace by ID
     * await collection.replaceOne({ _id: '1' }, { name: 'Jane Doe' });
     *
     * // Replace by name
     * await collection.replaceOne({
     *   name: 'John Doe',
     * }, {
     *   name: 'Jane Doe',
     *   $vector: [.08, .57, .23],
     * });
     *
     * // Replace by vector
     * await collection.replaceOne({}, {
     *   name: 'Jane Doe'
     * }, {
     *   sort: { $vector: [.09, .58, .22] },
     * });
     *
     * // Upsert if no match
     * await collection.replaceOne({
     *   name: 'Lynyrd Skynyrd',
     * }, {
     *   name: 'Lenerd Skinerd',
     * }, {
     *   upsert: true,
     * });
     * ```
     *
     * @param filter - A filter to select the document to replace.
     * @param replacement - The replacement document, which contains no `_id` field.
     * @param options - The options for this operation.
     *
     * @returns A summary of what changed.
     *
     * @see StrictFilter
     * @see StrictSort
     */
    replaceOne(filter: Filter<Schema>, replacement: NoId<Schema>, options?: ReplaceOneOptions): Promise<ReplaceOneResult<Schema>>;
    /**
     * Atomically deletes a single document from the collection.
     *
     * You can specify a `sort` option to determine which document to delete if multiple documents match the filter.
     *
     * See {@link DeleteOneOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * // Delete by _id
     * await collection.insertOne({ _id: '1', name: 'John Doe' });
     * await collection.deleteOne({ _id: '1' });
     *
     * // Delete by name
     * await collection.insertOne({ name: 'Jane Doe', age: 25 });
     * await collection.insertOne({ name: 'Jane Doe', age: 33 });
     * await collection.deleteOne({ name: 'Jane Doe' }, { sort: { age: -1 } });
     *
     * // Delete by vector search
     * await collection.insertOne({ name: 'Jane Doe', $vector: [.12, .52, .32] });
     * await collection.deleteOne({}, { sort: { $vector: [.09, .58, .42] }});
     * ```
     *
     * @param filter - A filter to select the document to delete.
     * @param options - The options for this operation.
     *
     * @returns How many documents were deleted.
     *
     * @see StrictFilter
     * @see StrictSort
     */
    deleteOne(filter?: Filter<Schema>, options?: DeleteOneOptions): Promise<DeleteOneResult>;
    /**
     * Deletes many documents from the collection.
     *
     * **NB. This function paginates the deletion of documents in chunks to avoid running into insertion limits. This
     * means multiple requests may be made to the server, and the operation may not be atomic.**
     *
     * **If an empty filter is passed, all documents in the collection will atomically be deleted in a single API call. Proceed with caution.**
     *
     * @example
     * ```typescript
     * await collection.insertMany([
     *   { _id: '1', name: 'John Doe' },
     *   { name: 'John Doe' },
     * ]);
     *
     * await collection.deleteMany({ name: 'John Doe' });
     * ```
     *
     * @remarks
     * This operation is not atomic. Depending on the amount of matching documents, it can keep running (in a blocking
     * way) for a macroscopic amount of time. In that case, new documents that are inserted from another concurrent process/
     * application at the same time may be deleted during the execution of this method call. In other words, it cannot
     * easily be predicted whether a given newly-inserted document will be picked up by the deleteMany command or not.
     *
     * @param filter - A filter to select the documents to delete.
     * @param options - The options for this operation.
     *
     * @returns How many documents were deleted.
     *
     * @throws Error - If an empty filter is passed.
     *
     * @see StrictFilter
     */
    deleteMany(filter: Filter<Schema>, options?: WithTimeout): Promise<DeleteManyResult>;
    /**
     * Deletes all documents from the collection.
     *
     * Unlike {@link Collection.deleteMany}, this method is atomic and will delete all documents in the collection in one go,
     * without making multiple network requests to the server.
     *
     * @remarks Use with caution. Wear a helmet. Don't say I didn't warn you.
     *
     * @param options - The options for this operation.
     *
     * @deprecated - Prefer the traditional `deleteMany({})` instead
     *
     * @returns A promise that resolves when the operation is complete.
     */
    deleteAll(options?: WithTimeout): Promise<void>;
    /**
     * Find documents on the collection, optionally matching the provided filter.
     *
     * Also accepts `sort`, `limit`, `skip`, `includeSimilarity`, and `projection` options.
     *
     * The method returns a {@link FindCursor} that can then be iterated over.
     *
     * **NB. If a *non-vector-sort* `sort` option is provided, the iteration of all documents may not be atomic**—it will
     * iterate over cursors in an approximate way, exhibiting occasional skipped or duplicate documents, with real-time
     * collection insertions/mutations being displayed.
     *
     * See {@link FindOptions} and {@link FindCursor} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * await collection.insertMany([
     *   { name: 'John Doe', $vector: [.12, .52, .32] },
     *   { name: 'Jane Doe', $vector: [.32, .52, .12] },
     *   { name: 'Dane Joe', $vector: [.52, .32, .12] },
     * ]);
     *
     * // Find by name
     * const cursor1 = collection.find({ name: 'John Doe' });
     *
     * // Returns ['John Doe']
     * console.log(await cursor1.toArray());
     *
     * // Match all docs, sorting by name
     * const cursor2 = collection.find({}, {
     *   sort: { name: 1 },
     * });
     *
     * // Returns 'Dane Joe', 'Jane Doe', 'John Doe'
     * for await (const doc of cursor2) {
     *   console.log(doc);
     * }
     *
     * // Find by vector
     * const cursor3 = collection.find({}, {
     *   sort: { $vector: [.12, .52, .32] },
     * });
     *
     * // Returns 'John Doe'
     * console.log(await cursor3.next());
     * ```
     *
     * @remarks
     * Some combinations of arguments impose an implicit upper bound on the number of documents that are returned by the
     * Data API. Namely:
     *
     * (a) Vector ANN searches cannot return more than a number of documents
     * that at the time of writing is set to 1000 items.
     *
     * (b) When using a sort criterion of the ascending/descending type,
     * the Data API will return a smaller number of documents, set to 20
     * at the time of writing, and stop there. The returned documents are
     * the top results across the whole collection according to the requested
     * criterion.
     *
     * --
     *
     * When not specifying sorting criteria at all (by vector or otherwise),
     * the cursor can scroll through an arbitrary number of documents as
     * the Data API and the client periodically exchange new chunks of documents.
     * It should be noted that the behavior of the cursor in the case documents
     * have been added/removed after the `find` was started depends on database
     * internals, and it is not guaranteed, nor excluded, that such "real-time"
     * changes in the data would be picked up by the cursor.
     *
     * @param filter - A filter to select the documents to find. If not provided, all documents will be returned.
     * @param options - The options for this operation.
     *
     * @returns A FindCursor which can be iterated over.
     *
     * @see StrictFilter
     * @see StrictSort
     * @see StrictProjection
     */
    find(filter: Filter<Schema>, options?: FindOptions): FindCursor<FoundDoc<Schema>, FoundDoc<Schema>>;
    /**
     * Finds a single document in the collection, if it exists.
     *
     * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
     *
     * You can also specify a `projection` option to determine which fields to include in the returned document.
     *
     * If performing a vector search, you can set the `includeSimilarity` option to `true` to include the similarity score
     * in the returned document as `$similarity: number`.
     *
     * See {@link FindOneOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * const doc1 = await collection.findOne({
     *   name: 'John Doe',
     * });
     *
     * // Will be undefined
     * console.log(doc1?.$similarity);
     *
     * const doc2 = await collection.findOne({}, {
     *   sort: {
     *     $vector: [.12, .52, .32],
     *   },
     *   includeSimilarity: true,
     * });
     *
     * // Will be a number
     * console.log(doc2?.$similarity);
     * ```
     *
     * @remarks
     * If you really need `skip` or `includeSortVector`, prefer using the {@link Collection.find} method instead with `limit: 1`.
     *
     * @param filter - A filter to select the document to find.
     * @param options - The options for this operation.
     *
     * @returns The found document, or `null` if no document was found.
     *
     * @see StrictFilter
     * @see StrictSort
     * @see StrictProjection
     */
    findOne(filter: Filter<Schema>, options?: FindOneOptions): Promise<FoundDoc<Schema> | null>;
    /**
     * Return a list of the unique values of `key` across the documents in the collection that match the provided filter.
     *
     * **NB. This is a *client-side* operation**—this effectively browses all matching documents (albeit with a
     * projection) using the logic of the {@link Collection.find} method, and collects the unique value for the
     * given `key` manually. As such, there may be performance, latency and ultimately billing implications if the
     * amount of matching documents is large.
     *
     * The key may use dot-notation to access nested fields, such as `'field'`, `'field.subfield'`, `'field.3'`,
     * `'field.3.subfield'`, etc. If lists are encountered and no numeric index is specified, all items in the list are
     * pulled.
     *
     * **Note that on complex extractions, the return type may be not as expected.** In that case, it's on the user to
     * cast the return type to the correct one.
     *
     * Distinct works with arbitrary objects as well, by creating a deterministic hash of the object and comparing it
     * with the hashes of the objects already seen. This, unsurprisingly, may not be great for performance if you have
     * a lot of records that match, so it's recommended to use distinct on simple values whenever performance or number
     * of records is a concern.
     *
     * For details on the behaviour of "distinct" in conjunction with real-time changes in the collection contents, see
     * the remarks on the `find` command.
     *
     * @example
     * ```typescript
     * await collection.insertMany([
     *   { letter: { value: 'a' }, car: [1] },
     *   { letter: { value: 'b' }, car: [2, 3] },
     *   { letter: { value: 'a' }, car: [2], bus: 'no' },
     * ]);
     *
     * // ['a', 'b']
     * const distinct = await collection.distinct('letter.value');
     *
     * await collection.insertOne({
     *   x: [{ y: 'Y', 0: 'ZERO' }],
     * });
     *
     * // ['Y']
     * await collection.distinct('x.y');
     *
     * // [{ y: 'Y', 0: 'ZERO' }]
     * await collection.distinct('x.0');
     *
     * // ['Y']
     * await collection.distinct('x.0.y');
     *
     * // ['ZERO']
     * await collection.distinct('x.0.0');
     * ```
     *
     * @param key - The dot-notation key to pick which values to retrieve unique
     * @param filter - A filter to select the documents to find. If not provided, all documents will be matched.
     *
     * @returns A list of all the unique values selected by the given `key`
     *
     * @see StrictFilter
     */
    distinct<Key extends string>(key: Key, filter?: Filter<Schema>): Promise<Flatten<(SomeDoc & ToDotNotation<FoundDoc<Schema>>)[Key]>[]>;
    /**
     * Counts the number of documents in the collection, optionally with a filter.
     *
     * Takes in a `limit` option which dictates the maximum number of documents that may be present before a
     * {@link TooManyDocumentsToCountError} is thrown. If the limit is higher than the highest limit accepted by the
     * Data API, a {@link TooManyDocumentsToCountError} will be thrown anyway (i.e. `1000`).
     *
     * @example
     * ```typescript
     * await collection.insertMany([
     *   { _id: '1', name: 'John Doe' },
     *   { name: 'Jane Doe' },
     * ]);
     *
     * const count = await collection.countDocuments({ name: 'John Doe' }, 1000);
     * console.log(count); // 1
     *
     * // Will throw a TooManyDocumentsToCountError as it counts 1, but the limit is 0
     * const count = await collection.countDocuments({ name: 'John Doe' }, 0);
     * ```
     *
     * @remarks
     * Count operations are expensive: for this reason, the best practice is to provide a reasonable `upperBound`
     * according to the caller expectations. Moreover, indiscriminate usage of count operations for sizeable amounts
     * of documents (i.e. in the thousands and more) is discouraged in favor of alternative application-specific
     * solutions. Keep in mind that the Data API has a hard upper limit on the amount of documents it will count,
     * and that an exception will be thrown by this method if this limit is encountered.
     *
     * @param filter - A filter to select the documents to count. If not provided, all documents will be counted.
     * @param upperBound - The maximum number of documents to count.
     * @param options - The options for this operation.
     *
     * @returns The number of counted documents, if below the provided limit
     *
     * @throws TooManyDocumentsToCountError - If the number of documents counted exceeds the provided limit.
     *
     * @see StrictFilter
     */
    countDocuments(filter: Filter<Schema>, upperBound: number, options?: WithTimeout): Promise<number>;
    /**
     * Gets an estimate of the count of documents in a collection.
     *
     * This operation is faster than {@link Collection.countDocuments} but may not be as accurate, and doesn't
     * accept a filter. Unlike the former, **It can handle more than 1000 documents.**
     *
     * @remarks
     * This gives a very rough estimate of the number of documents in the collection. It is not guaranteed to be
     * accurate, and should not be used as a source of truth for the number of documents in the collection.
     *
     * @param options - The options for this operation.
     *
     * @returns The estimated number of documents in the collection
     */
    estimatedDocumentCount(options?: WithTimeout): Promise<number>;
    /**
     * Atomically finds a single document in the collection and replaces it.
     *
     * If `upsert` is set to true, it will insert the replacement regardless of if no match is found.
     *
     * Set `returnDocument` to `'after'` to return the document as it is after the replacement, or `'before'` to return the
     * document as it was before the replacement.
     *
     * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
     *
     * You can also set `projection` to determine which fields to include in the returned document.
     *
     * If you just want the document, either omit `includeResultMetadata`, or set it to `false`.
     *
     * See {@link FindOneAndReplaceOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * await collection.insertOne({ _id: '1', band: 'ZZ Top' });
     *
     * const result = await collection.findOneAndReplace(
     *   { _id: '1' },
     *   { name: 'John Doe' },
     *   { returnDocument: 'after', includeResultMetadata: true },
     * );
     *
     * // Prints { _id: '1', name: 'John Doe' }
     * console.log(result.value);
     *
     * // Prints 1
     * console.log(result.ok);
     * ```
     *
     * @param filter - A filter to select the document to find.
     * @param replacement - The replacement document, which contains no `_id` field.
     * @param options - The options for this operation.
     *
     * @returns The result of the operation
     *
     * @see StrictFilter
     */
    findOneAndReplace(filter: Filter<Schema>, replacement: NoId<Schema>, options: FindOneAndReplaceOptions & {
        includeResultMetadata: true;
    }): Promise<ModifyResult<Schema>>;
    /**
     * Atomically finds a single document in the collection and replaces it.
     *
     * If `upsert` is set to true, it will insert the replacement regardless of if no match is found.
     *
     * Set `returnDocument` to `'after'` to return the document as it is after the replacement, or `'before'` to return the
     * document as it was before the replacement.
     *
     * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
     *
     * You can also set `projection` to determine which fields to include in the returned document.
     *
     * If you want the ok status along with the document, set `includeResultMetadata` to `true`.
     *
     * See {@link FindOneAndReplaceOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * await collection.insertOne({ _id: '1', band: 'ZZ Top' });
     *
     * const doc = await collection.findOneAndReplace(
     *   { _id: '1' },
     *   { name: 'John Doe' },
     *   { returnDocument: 'after', includeResultMetadata: true },
     * );
     *
     * // Prints { _id: '1', name: 'John Doe' }
     * console.log(doc);
     * ```
     *
     * @param filter - A filter to select the document to find.
     * @param replacement - The replacement document, which contains no `_id` field.
     * @param options - The options for this operation.
     *
     * @returns The document before/after replacement, depending on the type of `returnDocument`
     *
     * @see StrictFilter
     */
    findOneAndReplace(filter: Filter<Schema>, replacement: NoId<Schema>, options?: FindOneAndReplaceOptions & {
        includeResultMetadata?: false;
    }): Promise<WithId<Schema> | null>;
    /**
     * Atomically finds a single document in the collection and deletes it.
     *
     * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
     *
     * You can also set `projection` to determine which fields to include in the returned document.
     *
     * If you just want the document, either omit `includeResultMetadata`, or set it to `false`.
     *
     * See {@link FindOneAndDeleteOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * await collection.insertOne({ _id: '1', name: 'John Doe' });
     *
     * const result = await collection.findOneAndDelete(
     *   { _id: '1' },
     *   { includeResultMetadata: true, }
     * );
     *
     * // Prints { _id: '1', name: 'John Doe' }
     * console.log(result.value);
     *
     * // Prints 1
     * console.log(result.ok);
     * ```
     *
     * @param filter - A filter to select the document to find.
     * @param options - The options for this operation.
     *
     * @returns The result of the operation
     *
     * @see StrictFilter
     */
    findOneAndDelete(filter: Filter<Schema>, options: FindOneAndDeleteOptions & {
        includeResultMetadata: true;
    }): Promise<ModifyResult<Schema>>;
    /**
     * Atomically finds a single document in the collection and deletes it.
     *
     * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
     *
     * You can also set `projection` to determine which fields to include in the returned document.
     *
     * If you want the ok status along with the document, set `includeResultMetadata` to `true`.
     *
     * See {@link FindOneAndDeleteOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * await collection.insertOne({ _id: '1', name: 'John Doe' });
     * const doc = await collection.findOneAndDelete({ _id: '1' });
     *
     * // Prints { _id: '1', name: 'John Doe' }
     * console.log(doc);
     * ```
     *
     * @param filter - A filter to select the document to find.
     * @param options - The options for this operation.
     *
     * @returns The deleted document, or `null` if no document was found.
     *
     * @see StrictFilter
     */
    findOneAndDelete(filter: Filter<Schema>, options?: FindOneAndDeleteOptions & {
        includeResultMetadata?: false;
    }): Promise<WithId<Schema> | null>;
    /**
     * Atomically finds a single document in the collection and updates it.
     *
     * Set `returnDocument` to `'after'` to return the document as it is after the update, or `'before'` to return the
     * document as it was before the update.
     *
     * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
     *
     * You can also set `upsert` to `true` to insert a new document if no document matches the filter.
     *
     * If you just want the document, either omit `includeResultMetadata`, or set it to `false`.
     *
     * See {@link FindOneAndUpdateOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * const result = await collection.findOneAndUpdate(
     *   { _id: '1' },
     *   { $set: { name: 'Jane Doe' } },
     *   { returnDocument: 'after', includeResultMetadata: true },
     * );
     *
     * // Prints { _id: '1', name: 'Jane Doe' }
     * console.log(result.value);
     *
     * // Prints 1
     * console.log(result.ok);
     * ```
     *
     * @param filter - A filter to select the document to find.
     * @param update - The update to apply to the selected document.
     * @param options - The options for this operation.
     *
     * @returns The result of the operation
     *
     * @see StrictFilter
     * @see StrictUpdateFilter
     */
    findOneAndUpdate(filter: Filter<Schema>, update: UpdateFilter<Schema>, options: FindOneAndUpdateOptions & {
        includeResultMetadata: true;
    }): Promise<ModifyResult<Schema>>;
    /**
     * Atomically finds a single document in the collection and updates it.
     *
     * Set `returnDocument` to `'after'` to return the document as it is after the update, or `'before'` to return the
     * document as it was before the update.
     *
     * You can specify a `sort` option to determine which document to find if multiple documents match the filter.
     *
     * You can also set `upsert` to `true` to insert a new document if no document matches the filter.
     *
     * If you want the ok status along with the document, set `includeResultMetadata` to `true`.
     *
     * See {@link FindOneAndUpdateOptions} for complete information about the options available for this operation.
     *
     * @example
     * ```typescript
     * const doc = await collection.findOneAndUpdate(
     *   { _id: '1' },
     *   { $set: { name: 'Jane Doe' } },
     *   { returnDocument: 'after'},
     * );
     *
     * // Prints { _id: '1', name: 'Jane Doe' }
     * console.log(doc);
     * ```
     *
     * @param filter - A filter to select the document to find.
     * @param update - The update to apply to the selected document.
     * @param options - The options for this operation.
     *
     * @returns The document before/after the update, depending on the type of `returnDocument`
     *
     * @see StrictFilter
     * @see StrictUpdateFilter
     */
    findOneAndUpdate(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: FindOneAndUpdateOptions & {
        includeResultMetadata?: false;
    }): Promise<WithId<Schema> | null>;
    /**
     * Execute arbitrary operations sequentially/concurrently on the collection, such as insertions, updates, replaces,
     * & deletions, **non-atomically**
     *
     * **Note: prefer not to use this method; its implementation is subject to change on short notice.**
     *
     * Each operation is treated as a separate, unrelated request to the server; it is not performed in a transaction.
     *
     * You can set the `ordered` option to `true` to stop the operations after the first error, otherwise all operations
     * may be parallelized and processed in arbitrary order, improving, perhaps vastly, performance.
     *
     * *Note that the bulkWrite being ordered has nothing to do with if the operations themselves are ordered or not.*
     *
     * If an operational error occurs, the operation will throw a {@link BulkWriteError} containing the partial result.
     *
     * *If the exception is not due to a soft `2XX` error, e.g. a `5xx` error or network error, the operation will throw
     * the underlying error.*
     *
     * *In case of an unordered request, if the error was a simple operational error, a `BulkWriteError` will be thrown
     * after every operation has been attempted. If it was a `5xx` or similar, the error will be thrown immediately.*
     *
     * You can set the `parallel` option to control how many network requests are made in parallel on unordered
     * insertions. Defaults to `8`.
     *
     * @example
     * ```typescript
     * try {
     *   // Insert a document, then delete it
     *   await collection.bulkWrite([
     *     { insertOne: { document: { _id: '1', name: 'John Doe' } } },
     *     { deleteOne: { filter: { name: 'John Doe' } } },
     *   ], { ordered: true });
     *
     *   // Insert and delete operations, will cause a data race
     *   await collection.bulkWrite([
     *     { insertOne: { document: { _id: '1', name: 'John Doe' } } },
     *     { deleteOne: { filter: { name: 'John Doe' } } },
     *   ]);
     * } catch (e) {
     *   if (e instanceof BulkWriteError) {
     *     console.log(e.insertedCount);
     *     console.log(e.deletedCount);
     *   }
     * }
     * ```
     *
     * @param operations - The operations to perform.
     * @param options - The options for this operation.
     *
     * @returns The aggregated result of the operations.
     *
     * @throws BulkWriteError - If the operation fails
     *
     * @deprecated - Prefer to just call the functions manually; this will be removed in an upcoming major release.
     */
    bulkWrite(operations: AnyBulkWriteOperation<Schema>[], options?: BulkWriteOptions): Promise<BulkWriteResult<Schema>>;
    /**
     * Get the collection options, i.e. its configuration as read from the database.
     *
     * The method issues a request to the Data API each time it is invoked, without caching mechanisms;
     * this ensures up-to-date information for usages such as real-time collection validation by the application.
     *
     * @example
     * ```typescript
     * const options = await collection.info();
     * console.log(options.vector);
     * ```
     *
     * @param options - The options for this operation.
     *
     * @returns The options that the collection was created with (i.e. the `vector` and `indexing` operations).
     */
    options(options?: WithTimeout): Promise<CollectionOptions<SomeDoc>>;
    /**
     * Drops the collection from the database, including all the documents it contains.
     *
     * Once the collection is dropped, this object is still technically "usable", but any further operations on it
     * will fail at the Data API level; thus, it's the user's responsibility to make sure that the collection object
     * is no longer used.
     *
     * @example
     * ```typescript
     * const collection = await db.createCollection('my_collection');
     * await collection.drop();
     * ```
     *
     * @param options - The options for this operation.
     *
     * @returns `true` if the collection was dropped okay.
     *
     * @remarks Use with caution. Wear your safety goggles. Don't say I didn't warn you.
     */
    drop(options?: WithTimeout): Promise<boolean>;
    private get _httpClient();
}

/**
 * An exception thrown when an operation that expects a collection not to exist is attempted on a collection that
 * already exists.
 *
 * @field keyspace - The keyspace where the collection already exists
 * @field collectionName - The name of the collection that already exists
 *
 * @public
 */
export declare class CollectionAlreadyExistsError extends DataAPIError {
    /**
     * The keyspace where the collection already exists
     */
    readonly keyspace: string;
    /**
     * The keyspace where the collection already exists
     *
     * This is now a deprecated alias for the strictly equivalent {@link CollectionAlreadyExistsError.keyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link CollectionAlreadyExistsError.keyspace} instead.
     */
    readonly namespace: string;
    /**
     * The name of the collection that already exists
     */
    readonly collectionName: string;
    /* Excluded from this release type: __constructor */
}

/**
 * An exception thrown when certain operations are attempted on a collection that does not exist.
 *
 * @field keyspace - The keyspace that the collection was not found in
 * @field collectionName - The name of the collection that was not found
 *
 * @public
 */
export declare class CollectionNotFoundError extends DataAPIError {
    /**
     * The keyspace where the collection is not found.
     */
    readonly keyspace: string;
    /**
     * The keyspace where the collection is not found.
     *
     * This is now a deprecated alias for the strictly equivalent {@link CollectionNotFoundError.keyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link CollectionNotFoundError.keyspace} instead.
     */
    readonly namespace: string;
    /**
     * The name of the collection that is not found.
     */
    readonly collectionName: string;
    /* Excluded from this release type: __constructor */
}

/**
 * Represents the options for the createCollection command.
 *
 * @field vector - Options related to vector search.
 * @field indexing - Options related to indexing.
 * @field defaultId - Options related to the default ID.
 *
 * @public
 */
export declare interface CollectionOptions<Schema extends SomeDoc> {
    /**
     * Options related to vector search.
     */
    vector?: VectorOptions;
    /**
     * Options related to indexing.
     */
    indexing?: IndexingOptions<Schema>;
    /**
     * Options related to the default ID.
     */
    defaultId?: DefaultIdOptions;
}

/**
 * Options for spawning a new collection.
 *
 * @public
 */
export declare interface CollectionSpawnOptions extends WithKeyspace {
    /**
     * The API key for the embedding service to use, or the {@link EmbeddingHeadersProvider} if using
     * a provider that requires it (e.g. AWS bedrock).
     */
    embeddingApiKey?: string | EmbeddingHeadersProvider | null;
    /**
     * The default `maxTimeMS` for all operations on the collection. Will override the maxTimeMS set in the DataAPIClient
     * options; it can be overridden on a per-operation basis.
     *
     * This does *not* mean the request will be cancelled after this time, but rather that the client will wait
     * for this time before considering the request to have timed out.
     *
     * The request may or may not still be running on the server after this time.
     */
    defaultMaxTimeMS?: number | null;
}

/**
 * Common base class for all command events.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "bulkWrite", "insertMany", or "deleteAll",
 * which have to be translated into appropriate Data API commands.**
 *
 * @public
 */
export declare abstract class CommandEvent {
    /**
     * The command object. Equal to the response body of the HTTP request.
     *
     * Note that this is the actual raw command object; it's not necessarily 1:1 with methods called on the collection/db.
     *
     * For example, a `deleteAll` method on a collection will be translated into a `deleteMany` command, and a `bulkWrite`
     * method will be translated into a series of `insertOne`, `updateOne`, etc. commands.
     *
     * @example
     * ```typescript
     * {
     *   insertOne: { document: { name: 'John' } }
     * }
     * ```
     */
    readonly command: Record<string, any>;
    /**
     * The keyspace the command is being run in.
     */
    readonly keyspace: string;
    /**
     * The keyspace the command is being run in.
     *
     * This is now a deprecated alias for the strictly equivalent {@link CommandEvent.keyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link CommandEvent.keyspace} instead.
     */
    readonly namespace: string;
    /**
     * The collection the command is being run on, if applicable.
     */
    readonly collection?: string;
    /**
     * The command name.
     *
     * This is the key of the command object. For example, if the command object is
     * `{ insertOne: { document: { name: 'John' } } }`, the command name is `insertOne`.
     *
     * Meaning, abstracted commands like `bulkWrite`, or `deleteAll` will be shown as their actual command equivalents.
     */
    readonly commandName: string;
    /**
     * The URL the command is being sent to.
     */
    readonly url: string;
    /* Excluded from this release type: __constructor */
}

/**
 * Emitted when a command has errored.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "bulkWrite", "insertMany", or "deleteAll",
 * which have to be translated into appropriate Data API commands.**
 *
 * See {@link CommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export declare class CommandFailedEvent extends CommandEvent {
    /**
     * The duration of the command, in milliseconds.
     */
    readonly duration: number;
    /**
     * The error that caused the command to fail.
     *
     * Typically, some {@link DataAPIError}, commonly a {@link DataAPIResponseError} or one of its subclasses.
     */
    readonly error: Error;
    /* Excluded from this release type: __constructor */
}

/**
 * Emitted when a command is started, before the initial HTTP request is made.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "bulkWrite", "insertMany", or "deleteAll",
 * which have to be translated into appropriate Data API commands.**
 *
 * See {@link CommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export declare class CommandStartedEvent extends CommandEvent {
    /**
     * The timeout for the command, in milliseconds.
     */
    readonly timeout: number;
    /* Excluded from this release type: __constructor */
}

/**
 * Emitted when a command has succeeded.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "bulkWrite", "insertMany", or "deleteAll",
 * which have to be translated into appropriate Data API commands.**
 *
 * See {@link CommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export declare class CommandSucceededEvent extends CommandEvent {
    /**
     * The duration of the command, in milliseconds. Starts counting from the moment of the initial HTTP request.
     */
    readonly duration: number;
    /**
     * The response object from the Data API.
     */
    readonly resp?: RawDataAPIResponse;
    /**
     * Any warnings returned from the Data API that may point out deprecated/incorrect practices,
     * or any other issues that aren't strictly an error.
     */
    readonly warnings: string[];
    /* Excluded from this release type: __constructor */
}

declare type ContainsArr<Schema> = any[] extends Schema[keyof Schema] ? true : false;

declare type ContainsDate<Schema> = IsDate<Schema[keyof Schema]>;

declare type ContainsNum<Schema> = IsNum<Schema[keyof Schema]>;

/**
 * Information about the running cost of the database.
 *
 * @public
 */
export declare interface CostInfo {
    /**
     * Regular cost per day in cents
     */
    costPerDayCents: number;
    /**
     * Cost per day for multi-region in cents
     */
    costPerDayMRCents: number;
    /**
     * Cost per day in cents while the database is parked
     */
    costPerDayParkedCents: number;
    /**
     * Cost per hour in cents
     */
    costPerHourCents: number;
    /**
     * Cost per hour for multi-region in cents
     */
    costPerHourMRCents: number;
    /**
     * Cost per hour in cents while the database is parked
     */
    costPerHourParkedCents: number;
    /**
     * Cost per minute in cents
     */
    costPerMinCents: number;
    /**
     * Cost per minute for multi-region in cents
     */
    costPerMinMRCents: number;
    /**
     * Cost per minute in cents while the database is parked
     */
    costPerMinParkedCents: number;
    /**
     * Cost per month in cents
     */
    costPerMonthCents: number;
    /**
     * Cost per month for multi-region in cents
     */
    costPerMonthMRCents: number;
    /**
     * Cost per month in cents while the database is parked
     */
    costPerMonthParkedCents: number;
    /**
     * Cost per GB of network transfer in cents
     */
    costPerNetworkGbCents: number;
    /**
     * Cost per GB read in cents
     */
    costPerReadGbCents: number;
    /**
     * Cost per GB written in cents
     */
    costPerWrittenGbCents: number;
}

/**
 * Options for creating a new collection.
 *
 * @field vector - The vector configuration for the collection.
 * @field indexing - The indexing configuration for the collection.
 * @field defaultId - The default ID for the collection.
 * @field keyspace - Overrides the keyspace for the collection.
 * @field maxTimeMS - The maximum time to allow the operation to run.
 * @field checkExists - Whether to check if the collection exists before creating it.
 *
 * @see Db.createCollection
 *
 * @public
 */
export declare interface CreateCollectionOptions<Schema extends SomeDoc> extends WithTimeout, CollectionOptions<Schema>, CollectionSpawnOptions {
    /**
     * If `true` or unset, runs an additional existence check before creating the collection, failing if the collection
     * with the same name already exists, raising a {@link CollectionAlreadyExistsError}.
     *
     * Otherwise, if `false`, the creation is always attempted, and the command will succeed even if the collection
     * with the given name already exists, as long as the options are the exact same (if options mismatch, it'll
     * throw a {@link DataAPIResponseError}).
     *
     * @defaultValue true
     */
    checkExists?: boolean;
}

/**
 * Represents the options for creating a database (i.e. blocking options + database spawn options).
 *
 * @public
 */
export declare type CreateDatabaseOptions = AdminBlockingOptions & {
    /**
     * Any options to override the default options set when creating the root {@link DataAPIClient}.
     */
    dbOptions?: DbSpawnOptions;
};

/**
 * Represents the common options for creating a keyspace through the `astra-db-ts` client.
 *
 * See {@link AdminBlockingOptions} for more options about blocking behavior.
 *
 * If `updateDbKeyspace` is set to true, the underlying `Db` instance used to create the `DbAdmin` will have its
 * current working keyspace set to the newly created keyspace immediately (even if the keyspace isn't technically
 * yet created).
 *
 * @example
 * ```typescript
 * // If using non-astra, this may be a common idiom:
 * const client = new DataAPIClient({ environment: 'dse' });
 * const db = client.db('<endpoint>', { token: '<token>' });
 *
 * // Will internally call `db.useKeyspace('new_keyspace')`
 * await db.admin().createKeyspace('new_keyspace', {
 *   updateDbKeyspace: true,
 * });
 *
 * // Creates collection in keyspace `new_keyspace` by default now
 * const coll = db.createCollection('my_coll');
 * ```
 *
 * @see DbAdmin.createKeyspace
 *
 * @public
 */
export declare type CreateKeyspaceOptions = AdminBlockingOptions & {
    updateDbKeyspace?: boolean;
};

/**
 * Represents the common options for creating a keyspace through the `astra-db-ts` client.
 *
 * This is now a deprecated alias for the strictly equivalent {@link CreateKeyspaceOptions}, and will be removed
 * in an upcoming major version.
 *
 * @deprecated - Prefer {@link CreateKeyspaceOptions} instead.
 *
 * @public
 */
export declare type CreateNamespaceOptions = AdminBlockingOptions & {
    updateDbNamespace?: boolean;
};

declare type CropTrailingDot<Str extends string> = Str extends `${infer T}.` ? T : Str;

/**
 * An abstract class representing an exception that occurred due to a *cumulative* operation on the Data API. This is
 * the base class for all Data API errors that represent a paginated operation, such as `insertMany`, `deleteMany`,
 * `updateMany`, and `bulkWrite`, and will never be thrown directly.
 *
 * Useful for `instanceof` checks.
 *
 * This is *only* for Data API related errors, such as a non-existent collection, or a duplicate key error. It
 * is *not*, however, for errors such as an HTTP network error, or a malformed request. The exception being timeouts,
 * which are represented by the {@link DataAPITimeoutError} class.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 * @field partialResult - The partial result of the operation that was performed
 *
 * @public
 */
export declare abstract class CumulativeDataAPIError extends DataAPIResponseError {
    /**
     * The partial result of the operation that was performed. This is *always* defined, and is
     * the result of the operation up to the point of the first error. For example, if you're inserting 100 documents
     * ordered and the 50th document fails, the `partialResult` will contain the first 49 documents that were
     * successfully inserted.
     */
    readonly partialResult: unknown;
}

/**
 * Response object from an API call
 *
 * @deprecated - Use {@link FetcherResponseInfo} instead (synonymous type)
 *
 * @public
 */
export declare type CuratedAPIResponse = FetcherResponseInfo;

/**
 * Types the $currentDate operation. Not inherently strict or weak.
 *
 * @public
 */
export declare type CurrentDate<Schema> = {
    [K in keyof Schema as Schema[K] extends Date | {
        $date: number;
    } ? K : never]?: boolean;
};

/**
 * Caused by trying to perform an operation on an already-initialized {@link FindCursor} that requires it to be
 * uninitialized.
 *
 * If you run into this error, and you really do need to change an option on the cursor, you can rewind the cursor
 * using {@link FindCursor.rewind}, or clone it using {@link FindCursor.clone}.
 *
 * @example
 * ```typescript
 * await collection.find({}).toArray();
 *
 * try {
 *   await cursor.limit(10);
 * } catch (e) {
 *   if (e instanceof CursorIsStartedError) {
 *     console.log(e.message); // "Cursor is already initialized..."
 *   }
 * }
 * ```
 *
 * @public
 */
export declare class CursorIsStartedError extends DataAPIError {
    /* Excluded from this release type: __constructor */
}

/**
 * Allows you to use a custom http client for making HTTP requests, rather than the default or fetch API.
 *
 * Just requires the implementation of a simple adapter interface.
 *
 * See the `astra-db-ts` README for more information on different clients.
 *
 * https://github.com/datastax/astra-db-ts
 *
 * @public
 */
export declare interface CustomHttpClientOptions {
    /**
     * Use a custom http client for making HTTP requests.
     */
    client: 'custom';
    /**
     * The custom "fetcher" to use.
     */
    fetcher: Fetcher;
    /**
     * The default maximum time in milliseconds to wait for a response from the server.
     *
     * This does *not* mean the request will be cancelled after this time, but rather that the client will wait
     * for this time before considering the request to have timed out.
     *
     * The request may or may not still be running on the server after this time.
     */
    maxTimeMS?: number;
}

/**
 * The main entrypoint into working with the Data API. It sits at the top of the
 * [conceptual hierarchy](https://github.com/datastax/astra-db-ts/tree/signature-cleanup?tab=readme-ov-file#abstraction-diagram)
 * of the SDK.
 *
 * The client may take in a default token, which can be overridden by a stronger/weaker token when spawning a new
 * {@link Db} or {@link AstraAdmin} instance.
 *
 * It also takes in a set of default options (see {@link DataAPIClientOptions}) that may also generally be overridden as necessary.
 *
 * **Depending on the Data API backend used, you may need to set the environment option to "dse", "hcd", etc.** See
 * {@link DataAPIEnvironment} for all possible backends. It defaults to "astra".
 *
 * @example
 * ```typescript
 * // Client with default token
 * const client1 = new DataAPIClient('AstraCS:...');
 *
 * // Client with no default token; must provide token in .db() or .admin()
 * const client2 = new DataAPIClient();
 *
 * // Client connecting to a local DSE instance
 * const dseToken = new UsernamePasswordTokenProvider('username', 'password');
 * const client3 = new DataAPIClient(dseToken, { environment: 'dse' });
 *
 * const db1 = client1.db('https://<db_id>-<region>.apps.astra.datastax.com');
 * const db2 = client1.db('<db_id>', '<region>');
 *
 * const coll = await db1.collection('my-collection');
 *
 * const admin1 = client1.admin();
 * const admin2 = client1.admin({ adminToken: '<stronger_token>' });
 *
 * console.log(await coll.insertOne({ name: 'RATATATA' }));
 * console.log(await admin1.listDatabases());
 * ```
 *
 * @public
 *
 * @see DataAPIEnvironment
 */
export declare class DataAPIClient extends DataAPIClientEventEmitterBase {
    #private;
    /**
     * Constructs a new instance of the {@link DataAPIClient} without a default token. The token will instead need to
     * be specified when calling `.db()` or `.admin()`.
     *
     * Prefer this method when using a db-scoped token instead of a more universal token.
     *
     * @example
     * ```typescript
     * const client = new DataAPIClient();
     *
     * // OK
     * const db1 = client.db('<db_id>', '<region>', { token: 'AstraCS:...' });
     *
     * // Will throw error as no token is ever provided
     * const db2 = client.db('<db_id>', '<region>');
     * ```
     *
     * @param options - The default options to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
     */
    constructor(options?: DataAPIClientOptions | nullish);
    /**
     * Constructs a new instance of the {@link DataAPIClient} with a default token. This token will be used everywhere
     * if no overriding token is provided in `.db()` or `.admin()`.
     *
     * Prefer this method when using a universal/admin-scoped token.
     *
     * @example
     * ```typescript
     * const client = new DataAPIClient('<default_token>');
     *
     * // OK
     * const db1 = client.db('<db_id>', '<region>', { token: '<weaker_token>' });
     *
     * // OK; will use <default_token>
     * const db2 = client.db('<db_id>', '<region>');
     * ```
     *
     * @param token - The default token to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
     * @param options - The default options to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
     */
    constructor(token: string | TokenProvider | nullish, options?: DataAPIClientOptions | nullish);
    /**
     * Spawns a new {@link Db} instance using a direct endpoint and given options.
     *
     * **NB. This method does not validate the existence of the database—it simply creates a reference.**
     *
     * This endpoint should include the protocol and the hostname, but not the path. It's typically in the form of
     * `https://<db_id>-<region>.apps.astra.datastax.com`, but it can be used with DSE or any other Data-API-compatible
     * endpoint.
     *
     * The given options will override any default options set when creating the {@link DataAPIClient} through
     * a deep merge (i.e. unset properties in the options object will just default to the default options).
     *
     * @example
     * ```typescript
     * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
     *
     * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
     *   keyspace: 'my-keyspace',
     *   useHttp2: false,
     * });
     *
     * const db3 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
     *   token: 'AstraCS:...'
     * });
     * ```
     *
     * @remarks
     * Note that this does not perform any IO or validation on if the endpoint is valid or not. It's up to the user to
     * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
     * instead.
     *
     * @param endpoint - The direct endpoint to use.
     * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
     *
     * @returns A new {@link Db} instance.
     */
    db(endpoint: string, options?: DbSpawnOptions): Db;
    /**
     * Spawns a new {@link Db} instance using a direct endpoint and given options.
     *
     * **NB. This method does not validate the existence of the database—it simply creates a reference.**
     *
     * This overload is purely for user convenience, but it **only supports using Astra as the underlying database**. For
     * DSE or any other Data-API-compatible endpoint, use the other overload instead.
     *
     * The given options will override any default options set when creating the {@link DataAPIClient} through
     * a deep merge (i.e. unset properties in the options object will just default to the default options).
     *
     * @example
     * ```typescript
     * const db1 = client.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1');
     *
     * const db2 = client.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1', {
     *   keyspace: 'my-keyspace',
     *   useHttp2: false,
     * });
     *
     * const db3 = client.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1', {
     *   token: 'AstraCS:...'
     * });
     * ```
     *
     * @remarks
     * Note that this does not perform any IO or validation on if the endpoint is valid or not. It's up to the user to
     * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
     * instead.
     *
     * @param id - The database ID to use.
     * @param region - The region to use.
     * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
     *
     * @returns A new {@link Db} instance.
     */
    db(id: string, region: string, options?: DbSpawnOptions): Db;
    /**
     * Spawns a new {@link AstraAdmin} instance using the given options to work with the DevOps API (for admin
     * work such as creating/managing databases).
     *
     * **NB. This method is only available for Astra databases.**
     *
     * The given options will override any default options set when creating the {@link DataAPIClient} through
     * a deep merge (i.e. unset properties in the options object will just default to the default options).
     *
     * @example
     * ```typescript
     * const admin1 = client.admin();
     * const admin2 = client.admin({ adminToken: '<stronger_token>' });
     *
     * const dbs = await admin1.listDatabases();
     * console.log(dbs);
     * ```
     *
     * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
     *
     * @returns A new {@link AstraAdmin} instance.
     */
    admin(options?: AdminSpawnOptions): AstraAdmin;
    /**
     * Closes the client and disconnects all underlying connections. This should be called when the client is no longer
     * needed to free up resources.
     *
     * The client will be no longer usable after this method is called.
     *
     * @remarks
     * This method is idempotent and can be called multiple times without issue.
     *
     * --
     *
     * For most users, this method isn't necessary to call, as resources will be freed up when the
     * server is shut down or the process is killed. However, it's useful in long-running processes or when you want to
     * free up resources immediately.
     *
     * --
     *
     * Think of it as using malloc or using a file descriptor. Freeing them isn't always strictly necessary for
     * long-running usages, but it's there for when you need it.
     *
     * @returns A promise that resolves when the client has been closed.
     */
    close(): Promise<void>;
    /**
     * Allows for the `await using` syntax (if your typescript version \>= 5.2) to automatically close the client when
     * it's out of scope.
     *
     * Equivalent to wrapping the client usage in a `try`/`finally` block and calling `client.close()` in the `finally`
     * block.
     *
     * @example
     * ```typescript
     * async function main() {
     *   // Will unconditionally close the client when the function exits
     *   await using client = new DataAPIClient('*TOKEN*');
     *
     *   // Using the client as normal
     *   const db = client.db('*ENDPOINT*');
     *   console.log(await db.listCollections());
     *
     *   // Or pass it to another function to run your app
     *   app(client);
     * }
     * main();
     * ```
     *
     * *This will only be defined if the `Symbol.asyncDispose` symbol is actually defined.*
     */
    [Symbol.asyncDispose]: () => Promise<void>;
}

/**
 * The base class for the {@link DataAPIClient} event emitter to make it properly typed.
 *
 * Should never need to be used directly.
 *
 * @public
 */
export declare const DataAPIClientEventEmitterBase: new () => TypedEmitter<DataAPIClientEvents>;

/**
 * The events emitted by the {@link DataAPIClient}. These events are emitted at various stages of the
 * command's lifecycle. Intended for use for monitoring and logging purposes.
 *
 * Events include:
 * - `commandStarted` - Emitted when a command is started, before the initial HTTP request is made.
 * - `commandSucceeded` - Emitted when a command has succeeded.
 * - `commandFailed` - Emitted when a command has errored.
 * - `adminCommandStarted` - Emitted when an admin command is started, before the initial HTTP request is made.
 * - `adminCommandPolling` - Emitted when a command is polling in a long-running operation (i.e. create database).
 * - `adminCommandSucceeded` - Emitted when an admin command has succeeded, after any necessary polling.
 * - `adminCommandFailed` - Emitted when an admin command has errored.
 *
 * @public
 */
export declare type DataAPIClientEvents = DataAPICommandEvents & AdminCommandEvents;

/**
 * The default options for the {@link DataAPIClient}. The Data API & DevOps specific options may be overridden
 * when spawning a new instance of their respective classes.
 *
 * @public
 */
export declare interface DataAPIClientOptions {
    /**
     * Sets the Data API "backend" that is being used (e.g. 'dse', 'hcd', 'cassandra', or 'other'). Defaults to 'astra'.
     *
     * Generally, the majority of operations stay the same between backends. However, authentication may differ, and
     * availability of admin operations does as well.
     *
     * - With Astra databases, you'll use an `'AstraCS:...'` token; for other backends, you'll generally want to use the
     *   {@link UsernamePasswordTokenProvider}, or, rarely, even create your own.
     *
     * - {@link AstraAdmin} is only available on Astra databases. {@link AstraDbAdmin} is also only available on Astra
     *   databases, but the {@link DataAPIDbAdmin} alternative is used for all other backends, albeit the expense of a
     *   couple extra features.
     *
     * - Some functions/properties may also not be available on non-Astra backends, such as {@link Db.id} or {@link Db.info}.
     *
     * @remarks
     * No error will be thrown if this is set incorrectly, but bugs may appear in your code, with some operations just
     * throwing errors and refusing to work properly.
     *
     * @defaultValue "astra"
     */
    environment?: DataAPIEnvironment;
    /**
     * The client-wide options related to http operations.
     *
     * There are four different behaviours for setting the client:
     * - Not setting the `httpOptions` at all
     * -- This will attempt to use `fetch-h2` if available, and fall back to `fetch` if not available
     * - `client: 'default'` or `client: undefined` (or unset)
     * -- This will attempt to use `fetch-h2` if available, and throw an error if not available
     * - `client: 'fetch'`
     * -- This will always use the native `fetch` API
     * - `client: 'custom'`
     * -- This will allow you to pass a custom `Fetcher` implementation to the client
     *
     * `fetch-h2` is a fetch implementation that supports HTTP/2, and is the recommended client for the best performance.
     *
     * However, it's generally only available by default on node runtimes; in other environments, you may need to use the
     * native `fetch` API instead, or pass in the fetch-h2 module manually.
     *
     * See the `astra-db-ts` README for more information on different clients.
     *
     * https://github.com/datastax/astra-db-ts
     */
    httpOptions?: DataAPIHttpOptions;
    /**
     * The default options when spawning a {@link Db} instance.
     */
    dbOptions?: DbSpawnOptions;
    /**
     * The default options when spawning an {@link AstraAdmin} instance.
     */
    adminOptions?: AdminSpawnOptions;
    /**
     * The caller information to send with requests, of the form `[name, version?]`, or an array of such.
     *
     * **Intended generally for integrations or frameworks that wrap the client.**
     *
     * The caller information is used to identify the client making requests to the server.
     *
     * It will be sent in the headers of the request as such:
     * ```
     * User-Agent: ...<name>/<version> astra-db-ts/<version>
     * ```
     *
     * If no caller information is provided, the client will simply be identified as `astra-db-ts/<version>`.
     *
     * **NB. If providing an array of callers, they should be ordered from most important to least important.**
     * @example
     * ```typescript
     * // 'my-app/1.0.0 astra-db-ts/1.0.0'
     * const client1 = new DataAPIClient('AstraCS:...', {
     *   caller: ['my-app', '1.0.0'],
     * });
     *
     * // 'my-app/1.0.0 my-other-app astra-db-ts/1.0.0'
     * const client2 = new DataAPIClient('AstraCS:...', {
     *   caller: [['my-app', '1.0.0'], ['my-other-app']],
     * });
     * ```
     */
    caller?: Caller | Caller[];
    /**
     * Whether to prefer HTTP/2 for requests to the Data API; if set to `false`, HTTP/1.1 will be used instead.
     *
     * **Prefer to use the {@link DataAPIClientOptions.httpOptions} property instead.**
     *
     * The two are functionally equivalent; this is provided for backwards compatibility.
     *
     * @deprecated - Use the {@link DataAPIClientOptions.httpOptions} property instead.
     *
     * @see DefaultHttpClientOptions
     */
    preferHttp2?: boolean;
}

/**
 * The events emitted by the {@link DataAPIClient}. These events are emitted at various stages of the
 * command's lifecycle. Intended for use for monitoring and logging purposes.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "bulkWrite", "insertMany", or "deleteAll",
 * which have to be translated into appropriate Data API commands.**
 *
 * @public
 */
export declare type DataAPICommandEvents = {
    /**
     * Emitted when a command is started, before the initial HTTP request is made.
     */
    commandStarted: (event: CommandStartedEvent) => void;
    /**
     * Emitted when a command has succeeded.
     */
    commandSucceeded: (event: CommandSucceededEvent) => void;
    /**
     * Emitted when a command has errored.
     */
    commandFailed: (event: CommandFailedEvent) => void;
};

/**
 * An administrative class for managing non-Astra databases, including creating, listing, and deleting keyspaces.
 *
 * **Shouldn't be instantiated directly; use {@link Db.admin} to obtain an instance of this class.**
 *
 * **Note that the `environment` parameter MUST match the one used in the `DataAPIClient` options.**
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('*TOKEN*');
 *
 * // Create an admin instance through a Db
 * const db = client.db('*ENDPOINT*');
 * const dbAdmin1 = db.admin({ environment: 'dse' );
 * const dbAdmin2 = db.admin({ environment: 'dse', adminToken: 'stronger-token' });
 *
 * await admin1.createKeyspace({
 *   replication: {
 *     class: 'NetworkTopologyStrategy',
 *     datacenter1: 3,
 *     datacenter2: 2,
 *   },
 * });
 *
 * const keyspaces = await admin1.listKeyspaces();
 * console.log(keyspaces);
 * ```
 *
 * @see Db.admin
 * @see DataAPIDbAdmin.dbAdmin
 *
 * @public
 */
export declare class DataAPIDbAdmin extends DbAdmin {
    #private;
    /* Excluded from this release type: __constructor */
    /**
     * Gets the underlying `Db` object. The options for the db were set when the `DataAPIDbAdmin` instance, or whatever
     * spawned it, was created.
     *
     * @example
     * ```typescript
     * const dbAdmin = client.admin().dbAdmin('<endpoint>', {
     *   keyspace: 'my-keyspace',
     *   useHttp2: false,
     * });
     *
     * const db = dbAdmin.db();
     * console.log(db.keyspace);
     * ```
     *
     * @returns The underlying `Db` object.
     */
    db(): Db;
    /**
     * Returns detailed information about the availability and usage of the vectorize embedding providers available on the
     * current database (may vary based on cloud provider & region).
     *
     * @example
     * ```typescript
     * const { embeddingProviders } = await dbAdmin.findEmbeddingProviders();
     *
     * // ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']
     * console.log(embeddingProviders['openai'].models.map(m => m.name));
     * ```
     *
     * @param options - The options for the timeout of the operation.
     *
     * @returns The available embedding providers.
     */
    findEmbeddingProviders(options?: WithTimeout): Promise<FindEmbeddingProvidersResult>;
    /**
     * Lists the keyspaces in the database.
     *
     * The first element in the returned array is the default keyspace of the database, and the rest are additional
     * keyspaces in no particular order.
     *
     * @example
     * ```typescript
     * const keyspaces = await dbAdmin.listKeyspaces();
     *
     * // ['default_keyspace', 'my_other_keyspace']
     * console.log(keyspaces);
     * ```
     *
     * @returns A promise that resolves to list of all the keyspaces in the database.
     */
    listKeyspaces(options?: WithTimeout): Promise<string[]>;
    /**
     * Lists the keyspaces in the database.
     *
     * This is now a deprecated alias for the strictly equivalent {@link DataAPIDbAdmin.listKeyspaces}, and will be removed
     * in an upcoming major version.
     *
     * @deprecated - Prefer {@link DataAPIDbAdmin.listKeyspaces} instead.
     */
    listNamespaces(options?: WithTimeout): Promise<string[]>;
    /**
     * Creates a new, additional, keyspace for this database.
     *
     * **NB. The operation will always wait for the operation to complete, regardless of the {@link AdminBlockingOptions}. Expect it to take roughly 8-10 seconds.**
     *
     * @example
     * ```typescript
     * await dbAdmin.createKeyspace('my_keyspace');
     *
     * await dbAdmin.createKeyspace('my_keyspace', {
     *   replication: {
     *     class: 'SimpleStrategy',
     *     replicatonFactor: 3,
     *   },
     * });
     *
     * await dbAdmin.createKeyspace('my_keyspace', {
     *   replication: {
     *     class: 'NetworkTopologyStrategy',
     *     datacenter1: 3,
     *     datacenter2: 2,
     *   },
     * });
     * ```
     *
     * @param keyspace - The name of the new keyspace.
     * @param options - The options for the timeout & replication behavior of the operation.
     *
     * @returns A promise that resolves when the operation completes.
     */
    createKeyspace(keyspace: string, options?: LocalCreateKeyspaceOptions): Promise<void>;
    /**
     * Creates a new, additional, keyspace for this database.
     *
     * This is now a deprecated alias for the strictly equivalent {@link DataAPIDbAdmin.createKeyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link DataAPIDbAdmin.createKeyspace} instead.
     */
    createNamespace(keyspace: string, options?: LocalCreateNamespaceOptions): Promise<void>;
    /**
     * Drops a keyspace from this database.
     *
     * **NB. The operation will always wait for the operation to complete, regardless of the {@link AdminBlockingOptions}. Expect it to take roughly 8-10 seconds.**
     *
     * @example
     * ```typescript
     * // ['default_keyspace', 'my_other_keyspace']
     * console.log(await dbAdmin.listKeyspaces());
     *
     * await dbAdmin.dropKeyspace('my_other_keyspace');
     *
     * // ['default_keyspace', 'my_other_keyspace']
     * console.log(await dbAdmin.listKeyspaces());
     * ```
     *
     * @param keyspace - The name of the keyspace to drop.
     * @param options - The options for the timeout of the operation.
     *
     * @returns A promise that resolves when the operation completes.
     */
    dropKeyspace(keyspace: string, options?: AdminBlockingOptions): Promise<void>;
    /**
     Drops a keyspace from this database.
     *
     * This is now a deprecated alias for the strictly equivalent {@link DataAPIDbAdmin.dropKeyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link DataAPIDbAdmin.dropKeyspace} instead.
     */
    dropNamespace(keyspace: string, options?: AdminBlockingOptions): Promise<void>;
    private get _httpClient();
}

/**
 * An object representing a *complete* error response from the Data API, including the original command that was sent,
 * and the raw API response from the server.
 *
 * This is *not* used for "hard" (4XX, 5XX) errors, which are rarer and would be thrown directly by the underlying
 * code.
 *
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field command - The raw command send to the API
 * @field rawResponse - The raw response from the API
 *
 * @public
 */
export declare interface DataAPIDetailedErrorDescriptor {
    /**
     * A list of error descriptors representing the individual errors returned by the API.
     *
     * This will likely be a singleton list in many cases, such as for `insertOne` or `deleteOne` commands, but may be
     * longer for bulk operations like `insertMany` which may have multiple insertion errors.
     */
    readonly errorDescriptors: DataAPIErrorDescriptor[];
    /**
     * The original command that was sent to the API, as a plain object. This is the *raw* command, not necessarily in
     * the exact format the client may use, even with `bulkWrite`.
     *
     * @example
     * ```typescript
     * {
     *   insertOne: {
     *     document: { _id: 'docml10', name: 'Document 10' },
     *   }
     * }
     * ```
     */
    readonly command: Record<string, any>;
    /**
     * The raw response from the API
     *
     * @example
     * ```typescript
     * {
     *   status: {
     *     insertedIds: [ 'id1', 'id2', 'id3']
     *   },
     *   data: undefined,
     *   errors: [
     *     {
     *       message: "Failed to insert document with _id 'id3': Document already exists with the given _id",
     *       errorCode: 'DOCUMENT_ALREADY_EXISTS'
     *     }
     *   ]
     * }
     * ```
     */
    readonly rawResponse: RawDataAPIResponse;
}

/**
 * All the available Data API backends the Typescript client recognizes.
 *
 * If using a non-Astra database as the backend, the `environment` option should be set in the `DataAPIClient` options,
 * as well as in the `db.admin()` options.
 *
 * @public
 */
export declare type DataAPIEnvironment = typeof DataAPIEnvironments[number];

/**
 * All the available Data API backends the Typescript client recognizes.
 *
 * If using a non-Astra database as the backend, the `environment` option should be set in the `DataAPIClient` options,
 * as well as in the `db.admin()` options.
 *
 * @public
 */
export declare const DataAPIEnvironments: readonly ["astra", "dse", "hcd", "cassandra", "other"];

/**
 * An abstract class representing *some* exception that occurred related to the Data API. This is the base class for all
 * Data API errors, and will never be thrown directly.
 *
 * Useful for `instanceof` checks.
 *
 * This is *only* for Data API related errors, such as a non-existent collection, or a duplicate key error. It
 * is *not*, however, for errors such as an HTTP network error, or a malformed request. The exception being timeouts,
 * which are represented by the {@link DataAPITimeoutError} class.
 *
 * @public
 */
export declare abstract class DataAPIError extends Error {
}

/**
 * An object representing a single "soft" (2XX) error returned from the Data API, typically with an error code and a
 * human-readable message. An API request may return with an HTTP 200 success error code, but contain a nonzero
 * amount of these, such as for duplicate inserts, or invalid IDs.
 *
 * This is *not* used for "hard" (4XX, 5XX) errors, which are rarer and would be thrown directly by the underlying
 * code.
 *
 * @example
 * ```typescript
 * {
 *   errorCode: 'DOCUMENT_ALREADY_EXISTS',
 *   message: "Failed to insert document with _id 'id3': Document already exists with the given _id",
 *   attributes: {},
 * }
 * ```
 *
 * @field errorCode - A string code representing the exact error
 * @field message - A human-readable message describing the error
 * @field attributes - A map of additional attributes returned by the API. Often empty
 *
 * @public
 */
export declare interface DataAPIErrorDescriptor {
    /**
     * A string code representing the exact error
     */
    readonly errorCode?: string;
    /**
     * A human-readable message describing the error
     */
    readonly message?: string;
    /**
     * A map of additional attributes that may be useful for debugging or logging returned by the API. Not guaranteed to
     * be non-empty. Probably more often empty than not.
     */
    readonly attributes?: Record<string, any>;
}

/* Excluded from this release type: DataAPIHttpClient */

declare interface DataAPIHttpClientOpts extends HTTPClientOptions {
    keyspace: KeyspaceRef;
    emissionStrategy: EmissionStrategy;
    embeddingHeaders: EmbeddingHeadersProvider;
    tokenProvider: TokenProvider;
}

/**
 * An error thrown on non-2XX status codes from the Data API, such as 4XX or 5XX errors.
 *
 * @public
 */
export declare class DataAPIHttpError extends DataAPIError {
    /**
     * The error descriptors returned by the API to describe what went wrong.
     */
    readonly status: number;
    /**
     * The raw string body of the HTTP response, if it exists
     */
    readonly body?: string;
    /**
     * The "raw", errored response from the API.
     */
    readonly raw: FetcherResponseInfo;
    /* Excluded from this release type: __constructor */
}

/**
 * The options available for the {@link DataAPIClient} related to making HTTP requests.
 *
 * There are four different behaviours for setting the client:
 * - Not setting the `httpOptions` at all
 * -- This will attempt to use `fetch-h2` if available, and fall back to `fetch` if not available
 * - `client: 'default'` or `client: undefined` (or unset)
 * -- This will attempt to use `fetch-h2` if available, and throw an error if not available
 * - `client: 'fetch'`
 * -- This will always use the native `fetch` API
 * - `client: 'custom'`
 * -- This will allow you to pass a custom `Fetcher` implementation to the client
 *
 * `fetch-h2` is a fetch implementation that supports HTTP/2, and is the recommended client for the best performance.
 *
 * However, it's generally only available by default on node runtimes; on other runtimes, you may need to use the
 * native `fetch` API instead, or pass in the fetch-h2 module manually.
 *
 * See the `astra-db-ts` README for more information on different clients.
 *
 * https://github.com/datastax/astra-db-ts
 *
 * @public
 */
export declare type DataAPIHttpOptions = DefaultHttpClientOptions | FetchHttpClientOptions | CustomHttpClientOptions;

/* Excluded from this release type: DataAPIRequestInfo */

/**
 * An error representing the *complete* errors for an operation. This is a cohesive error that represents all the
 * errors that occurred during a single operation, and should not be thought of as *always* 1:1 with the number of
 * API requests—rather it's 1:1 with the number of *logical* operations performed by the user (i.e. the methods
 * on the {@link Collection} class).
 *
 * This is *not* used for "hard" (4XX, 5XX) errors, which are rarer and would be thrown directly by the underlying
 * code.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 *
 * @public
 */
export declare class DataAPIResponseError extends DataAPIError {
    /**
     * A human-readable message describing the *first* error.
     *
     * This is *always* equal to `errorDescriptors[0]?.message` if it exists, otherwise it's given a generic
     * default message.
     */
    readonly message: string;
    /**
     * A list of error descriptors representing the individual errors returned by the API.
     *
     * This is *always* equal to `detailedErrorDescriptors.flatMap(d => d.errorDescriptors)`, for the user's
     * convenience.
     */
    readonly errorDescriptors: DataAPIErrorDescriptor[];
    /**
     * A list of errors 1:1 with the number of errorful API requests made to the server. Each element contains the
     * original command, the raw response, and the error descriptors for that request.
     *
     * For operations that only make one request, this will be a singleton list (i.e. `insertOne`).
     */
    readonly detailedErrorDescriptors: DataAPIDetailedErrorDescriptor[];
    /* Excluded from this release type: __constructor */
}

/**
 * An error thrown when a Data API operation timed out.
 *
 * Depending on the method, this may be a request timeout occurring during a specific HTTP request, or can happen over
 * the course of a method involving several requests in a row, such as a paginated `insertMany`.
 *
 * @public
 */
export declare class DataAPITimeoutError extends DataAPIError {
    /**
     * The timeout that was set for the operation, in milliseconds.
     */
    readonly timeout: number;
    /* Excluded from this release type: __constructor */
}

/**
 * List of actions that can be performed on a database.
 *
 * @public
 */
export declare type DatabaseAction = 'park' | 'unpark' | 'resize' | 'resetPassword' | 'addKeyspace' | 'addDatacenters' | 'terminateDatacenter' | 'getCreds' | 'terminate' | 'removeKeyspace' | 'removeMigrationProxy' | 'launchMigrationProxy';

/**
 * Represents the available cloud providers that Astra offers.
 *
 * @public
 */
export declare type DatabaseCloudProvider = 'AWS' | 'GCP' | 'AZURE';

/**
 * Represents all possible cloud providers that you can filter by.
 *
 * @public
 */
export declare type DatabaseCloudProviderFilter = DatabaseCloudProvider | 'ALL';

/**
 * Represents the options for creating a database.
 *
 * @field name - Name of the database--user friendly identifier
 * @field cloudProvider - Cloud provider where the database lives
 * @field region - Cloud region where the database is located
 *
 * @public
 */
export declare interface DatabaseConfig {
    /**
     * Name of the database (user-friendly identifier)
     */
    name: string;
    /**
     * Cloud provider where the database lives
     */
    cloudProvider?: DatabaseCloudProvider;
    /**
     * The cloud region where the database is located.
     */
    region: string;
    /**
     * The default keyspace to use for the database.
     */
    keyspace?: string;
    /**
     * The default keyspace to use for the database.
     *
     * This is now a deprecated alias for the strictly equivalent {@link DatabaseConfig.keyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link DatabaseConfig.keyspace} instead.
     */
    namespace?: string;
}

/**
 * The user-provided information describing a database
 *
 * @public
 */
export declare interface DatabaseInfo {
    /**
     * Name of the database--user friendly identifier
     */
    name: string;
    /**
     * Keyspace name in database. If not passed, keyspace is created with name "default_keyspace"
     */
    keyspace?: string;
    /**
     * Cloud provider where the database lives
     */
    cloudProvider?: DatabaseCloudProvider;
    /**
     * Tier defines the compute power (vertical scaling) for the database, developer gcp is the free tier.
     */
    tier: DatabaseTier;
    /**
     * The amount of space available (horizontal scaling) for the database. For free tier the max CU's is 1, and 100
     * for CXX/DXX the max is 12 on startup.
     */
    capacityUnits: number;
    /**
     * The cloud region where the database is located.
     */
    region: string;
    /**
     * The user to connect to the database.
     */
    user?: string;
    /**
     * The password to connect to the database.
     */
    password?: string;
    /**
     * Additional keyspace names in database.
     */
    additionalKeyspaces?: string[];
    /**
     * All keyspace names in database.
     */
    keyspaces?: string[];
    /**
     * Type of the serverless database, currently only supported value is “vector”. "vector" creates a cassandra
     * database with vector support. Field not being inputted creates default serverless database.
     */
    dbType?: 'vector';
    /**
     * The datacenters for the database
     */
    datacenters?: DatacenterInfo[];
}

/**
 * Represents all possible statuses of a database.
 *
 * @public
 */
export declare type DatabaseStatus = 'ACTIVE' | 'ERROR' | 'DECOMMISSIONING' | 'DEGRADED' | 'HIBERNATED' | 'HIBERNATING' | 'INITIALIZING' | 'MAINTENANCE' | 'PARKED' | 'PARKING' | 'PENDING' | 'PREPARED' | 'PREPARING' | 'RESIZING' | 'RESUMING' | 'TERMINATED' | 'TERMINATING' | 'UNKNOWN' | 'UNPARKING' | 'SYNCHRONIZING';

/**
 * Represents all possible statuses of a database that you can filter by.
 *
 * @public
 */
export declare type DatabaseStatusFilter = DatabaseStatus | 'ALL' | 'NONTERMINATED';

/**
 * Contains the information about how much storage space a cluster has available.
 *
 * @public
 */
export declare interface DatabaseStorageInfo {
    /**
     * Node count for the cluster.
     */
    nodeCount: number;
    /**
     * Number of nodes storing a piece of data
     */
    replicationFactor: number;
    /**
     * Total storage of the cluster in GB
     */
    totalStorage: number;
    /**
     * Used storage of the cluster in GB
     */
    usedStorage?: number;
}

/**
 * Defines all possible compute powers (vertical scaling) for a database.
 *
 * @public
 */
export declare type DatabaseTier = 'developer' | 'A5' | 'A10' | 'A20' | 'A40' | 'C10' | 'C20' | 'C40' | 'D10' | 'D20' | 'D40' | 'serverless';

/**
 * Information about a datacenter.
 *
 * @public
 */
export declare interface DatacenterInfo {
    /**
     * The number of capacity units for the datacenter.
     */
    capacityUnits: number;
    /**
     * The cloud provider where the datacenter is located.
     */
    cloudProvider: DatabaseCloudProvider;
    /**
     * The date the datacenter was created in ISO RFC3339 format.
     */
    dateCreated: string;
    /**
     * The id of the datacenter.
     */
    id: string;
    /**
     * Whether the datacenter is the primary datacenter.
     */
    isPrimary: boolean;
    /**
     * The name of the datacenter.
     */
    name: string;
    /**
     * The region where the datacenter is located.
     */
    region: string;
    /**
     * The region classification of the datacenter.
     */
    regionClassification: string;
    /**
     * The region zone of the datacenter.
     */
    regionZone: string;
    /**
     * The internal URL for the secure bundle.
     */
    secureBundleUrl: string;
    /**
     * The status of the datacenter (might be an empty string)
     */
    status: string;
    /**
     * The tier of the datacenter.
     */
    tier: DatabaseTier;
}

/**
 * Represents filter operations exclusive to Dates (or dynamically typed) fields
 *
 * @public
 */
export declare interface DateFilterOps {
    /**
     * Less than (exclusive) some date.
     *
     * `{ $date: number }` can be replaced with `new Date(number)`.
     */
    $lt?: Date;
    /**
     * Less than or equal to some date.
     *
     * `{ $date: number }` can be replaced with `new Date(number)`.
     */
    $lte?: Date;
    /**
     * Greater than (exclusive) some date.
     *
     * `{ $date: number }` can be replaced with `new Date(number)`.
     */
    $gt?: Date;
    /**
     * Greater than or equal to some date.
     *
     * `{ $date: number }` can be replaced with `new Date(number)`.
     */
    $gte?: Date;
}

/**
 * Weaker version of StrictDateUpdate which allows for more flexibility in typing date update operations.
 *
 * @public
 */
export declare type DateUpdate<Schema> = {
    [K in keyof Schema as ContainsDate<Schema[K]> extends true ? K : never]?: Date | {
        $date: number;
    };
};

/**
 * Represents an interface to some Astra database instance. This is the entrypoint for database-level DML, such as
 * creating/deleting collections, connecting to collections, and executing arbitrary commands.
 *
 * **Shouldn't be instantiated directly; use {@link DataAPIClient.db} to obtain an instance of this class.**
 *
 * Note that creating an instance of a `Db` doesn't trigger actual database creation; the database must have already
 * existed beforehand. If you need to create a new database, use the {@link AstraAdmin} class.
 *
 * Db spawning methods let you pass in the default keyspace for the database, which is used for all subsequent db
 * operations in that object, but each method lets you override the keyspace if necessary in its options.
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('AstraCS:...');
 *
 * // Connect to a database using a direct endpoint
 * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
 *
 * // Overrides default options from the DataAPIClient
 * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
 *   keyspace: 'my_keyspace',
 *   useHttp2: false,
 * });
 *
 * // Lets you connect using a database ID and region
 * const db3 = client.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1');
 * ```
 *
 * @see DataAPIClient.db
 * @see AstraAdmin.db
 *
 * @public
 */
export declare class Db {
    #private;
    private readonly _keyspace;
    private readonly _id?;
    /* Excluded from this release type: __constructor */
    /**
     * The default keyspace to use for all operations in this database, unless overridden in a method call.
     *
     * @example
     * ```typescript
     * // Uses 'default_keyspace' as the default keyspace for all future db spawns
     * const client1 = new DataAPIClient('*TOKEN*');
     *
     * // Overrides the default keyspace for all future db spawns
     * const client2 = new DataAPIClient('*TOKEN*', {
     *   dbOptions: { keyspace: 'my_keyspace' },
     * });
     *
     * // Created with 'default_keyspace' as the default keyspace
     * const db1 = client1.db('*ENDPOINT*');
     *
     * // Created with 'my_keyspace' as the default keyspace
     * const db2 = client1.db('*ENDPOINT*', {
     *   keyspace: 'my_keyspace'
     * });
     *
     * // Uses 'default_keyspace'
     * const coll1 = db1.collection('users');
     *
     * // Uses 'my_keyspace'
     * const coll2 = db1.collection('users', {
     *   keyspace: 'my_keyspace'
     * });
     * ```
     */
    get keyspace(): string;
    /**
     * The default keyspace to use for all operations in this database, unless overridden in a method call.
     *
     * This is now a deprecated alias for the strictly equivalent {@link Db.keyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link Db.keyspace} instead.
     */
    get namespace(): string;
    /**
     * The ID of the database, if it's an Astra database. If it's not an Astra database, this will throw an error.
     *
     * @throws Error - if the database is not an Astra database.
     */
    get id(): string;
    /**
     * Sets the default working keyspace of the `Db` instance. Does not retroactively update any previous collections
     * spawned from this `Db` to use the new keyspace.
     *
     * @example
     * ```typescript
     * // Spawns a `Db` with default working keyspace `my_keyspace`
     * const db = client.db('<endpoint>', { keyspace: 'my_keyspace' });
     *
     * // Gets a collection from keyspace `my_keyspace`
     * const coll1 = db.collection('my_coll');
     *
     * // `db` now uses `my_other_keyspace` as the default keyspace for all operations
     * db.useKeyspace('my_other_keyspace');
     *
     * // Gets a collection from keyspace `my_other_keyspace`
     * // `coll1` still uses keyspace `my_keyspace`
     * const coll2 = db.collection('my_other_coll');
     *
     * // Gets `my_coll` from keyspace `my_keyspace` again
     * // (The default keyspace is still `my_other_keyspace`)
     * const coll3 = db.collection('my_coll', { keyspace: 'my_keyspace' });
     * ```
     *
     * @example
     * ```typescript
     * // If using non-astra, this may be a common idiom:
     * const client = new DataAPIClient({ environment: 'dse' });
     * const db = client.db('<endpoint>', { token: '<token>' });
     *
     * // Will internally call `db.useKeyspace('new_keyspace')`
     * await db.admin().createKeyspace('new_keyspace', {
     *   updateDbKeyspace: true,
     * });
     *
     * // Creates collection in keyspace `new_keyspace` by default now
     * const coll = db.createCollection('my_coll');
     * ```
     *
     * @param keyspace - The keyspace to use
     */
    useKeyspace(keyspace: string): void;
    /**
     * Sets the default working keyspace of the `Db` instance. Does not retroactively update any previous collections
     * spawned from this `Db` to use the new keyspace.
     *
     * This is now a deprecated alias for the strictly equivalent {@link Db.useKeyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link Db.useKeyspace} instead.
     */
    useNamespace(keyspace: string): void;
    /**
     * Spawns a new {@link AstraDbAdmin} instance for this database, used for performing administrative operations
     * on the database, such as managing keyspaces, or getting database information.
     *
     * The given options will override any default options set when creating the {@link DataAPIClient} through
     * a deep merge (i.e. unset properties in the options object will just default to the default options).
     *
     * **If using a non-Astra backend, the `environment` option MUST be set as it is on the `DataAPIClient`**
     *
     * @example
     * ```typescript
     * const admin1 = db.admin();
     * const admin2 = db.admin({ adminToken: '<stronger-token>' });
     *
     * const keyspaces = await admin1.listKeyspaces();
     * console.log(keyspaces);
     * ```
     *
     * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
     *
     * @returns A new {@link AstraDbAdmin} instance for this database instance.
     *
     * @throws Error - if the database is not an Astra database.
     */
    admin(options?: AdminSpawnOptions & {
        environment?: 'astra';
    }): AstraDbAdmin;
    /**
     * Spawns a new {@link DataAPIDbAdmin} instance for this database, used for performing administrative operations
     * on the database, such as managing keyspaces, or getting database information.
     *
     * The given options will override any default options set when creating the {@link DataAPIClient} through
     * a deep merge (i.e. unset properties in the options object will just default to the default options).
     *
     * **If using a non-Astra backend, the `environment` option MUST be set as it is on the `DataAPIClient`**
     *
     * @example
     * ```typescript
     * const client = new DataAPIClient({ environment: 'dse' });
     * const db = client.db('*ENDPOINT*', { token });
     *
     * // OK
     * const admin1 = db.admin({ environment: 'dse' });
     *
     * // Will throw "mismatching environments" error
     * const admin2 = db.admin();
     *
     * const keyspaces = await admin1.listKeyspaces();
     * console.log(keyspaces);
     * ```
     *
     * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
     *
     * @returns A new {@link AstraDbAdmin} instance for this database instance.
     *
     * @throws Error - if the database is not an Astra database.
     */
    admin(options: AdminSpawnOptions & {
        environment: Exclude<DataAPIEnvironment, 'astra'>;
    }): DataAPIDbAdmin;
    /**
     * Fetches information about the database, such as the database name, region, and other metadata.
     *
     * **NB. Only available for Astra databases.**
     *
     * For the full, complete, information, see {@link AstraDbAdmin.info}.
     *
     * The method issues a request to the DevOps API each time it is invoked, without caching mechanisms;
     * this ensures up-to-date information for usages such as real-time collection validation by the application.
     *
     * @example
     * ```typescript
     * const info = await db.info();
     * console.log(info.name);
     * ```
     *
     * @returns A promise that resolves to the database information.
     *
     * @throws Error - if the database is not an Astra database.
     */
    info(options?: WithTimeout): Promise<DatabaseInfo>;
    /**
     * Establishes a reference to a collection in the database. This method does not perform any I/O.
     *
     * **NB. This method does not validate the existence of the collection—it simply creates a reference.**
     *
     * **Unlike the MongoDB driver, this method does not create a collection if it doesn't exist.**
     *
     * Use {@link Db.createCollection} to create a new collection instead.
     *
     * Typed as `Collection<SomeDoc>` by default, but you can specify a schema type to get a typed collection. If left
     * as `SomeDoc`, the collection will be untyped.
     *
     * You can also specify a keyspace in the options parameter, which will override the default keyspace for this database.
     *
     * @example
     * ```typescript
     * interface User {
     *   name: string,
     *   age?: number,
     * }
     *
     * const users1 = db.collection<User>("users");
     * users1.insertOne({ name: "John" });
     *
     * // Untyped collection from different keyspace
     * const users2 = db.collection("users", {
     *   keyspace: "my_keyspace",
     * });
     * users2.insertOne({ nam3: "John" });
     * ```
     *
     * @param name - The name of the collection.
     * @param options - Options for the connection.
     *
     * @returns A new, unvalidated, reference to the collection.
     *
     * @see SomeDoc
     * @see VectorDoc
     */
    collection<Schema extends SomeDoc = SomeDoc>(name: string, options?: CollectionSpawnOptions): Collection<Schema>;
    /**
     * Establishes references to all the collections in the working/given keyspace.
     *
     * You can specify a keyspace in the options parameter, which will override the default keyspace for this `Db` instance.
     *
     * @example
     * ```typescript
     * // Uses db's default keyspace
     * const collections1 = await db.collections();
     * console.log(collections1); // [Collection<SomeDoc>, Collection<SomeDoc>]
     *
     * // Overrides db's default keyspace
     * const collections2 = await db.collections({ keyspace: 'my_keyspace' });
     * console.log(collections2); // [Collection<SomeDoc>]
     * ```
     *
     * @param options - Options for this operation.
     *
     * @returns A promise that resolves to an array of references to the working Db's collections.
     *
     * @deprecated - Essentially equivalent to `(await db.listCollections()).map(c => new Collection(c.name))`; will be
     * removed in an upcoming major release.
     */
    collections(options?: WithKeyspace & WithTimeout): Promise<Collection[]>;
    /**
     * Creates a new collection in the database, and establishes a reference to it.
     *
     * **NB. You are limited in the amount of collections you can create, so be wary when using this command.**
     *
     * This is a blocking command which performs actual I/O unlike {@link Db.collection}, which simply creates an
     * unvalidated reference to a collection.
     *
     * If `checkExists: false`, creation is idempotent, so if the collection already exists with the same options,
     * this method will not throw an error. If the options mismatch, it will throw a {@link DataAPIResponseError}.
     *
     * Typed as `Collection<SomeDoc>` by default, but you can specify a schema type to get a typed collection. If left
     * as `SomeDoc`, the collection will be untyped.
     *
     * *If vector options are not specified, the collection will not support vector search.*
     *
     * You can also specify a keyspace in the options parameter, which will override the default keyspace for this database.
     *
     * See {@link CreateCollectionOptions} for *much* more information on the options available.
     *
     * @example
     * ```typescript
     * interface User {
     *   name: string,
     *   age?: number,
     * }
     *
     * const users = await db.createCollection<User>("users");
     * users.insertOne({ name: "John" });
     *
     * // Untyped collection with custom options in a different keyspace
     * const users2 = await db.createCollection("users", {
     *   keyspace: "my_keyspace",
     *   defaultId: {
     *     type: "objectId",
     *   },
     *   checkExists: false,
     * });
     * ```
     *
     * @param collectionName - The name of the collection to create.
     * @param options - Options for the collection.
     *
     * @returns A promised reference to the newly created collection.
     *
     * @throws CollectionAlreadyExistsError - if the collection already exists and `checkExists` is `true` or unset.
     *
     * @see SomeDoc
     * @see VectorDoc
     */
    createCollection<Schema extends SomeDoc = SomeDoc>(collectionName: string, options?: CreateCollectionOptions<Schema>): Promise<Collection<Schema>>;
    /**
     * Drops a collection from the database, including all the contained documents.
     *
     * You can also specify a keyspace in the options parameter, which will override the default keyspace for this database.
     *
     * @example
     * ```typescript
     * // Uses db's default keyspace
     * const success1 = await db.dropCollection("users");
     * console.log(success1); // true
     *
     * // Overrides db's default keyspace
     * const success2 = await db.dropCollection("users", {
     *   keyspace: "my_keyspace"
     * });
     * console.log(success2); // true
     * ```
     *
     * @param name - The name of the collection to drop.
     * @param options - Options for this operation.
     *
     * @returns A promise that resolves to `true` if the collection was dropped successfully.
     *
     * @remarks Use with caution. Have steel-toe boots on. Don't say I didn't warn you.
     */
    dropCollection(name: string, options?: DropCollectionOptions): Promise<boolean>;
    /**
     * Lists the collection names in the database.
     *
     * If you want to include the collection options in the response, set `nameOnly` to `false`, using the other overload.
     *
     * You can also specify a keyspace in the options parameter, which will override the default keyspace for this database.
     *
     * @example
     * ```typescript
     * // [{ name: "users" }, { name: "posts" }]
     * console.log(await db.listCollections({ nameOnly: true }));
     * ```
     *
     * @param options - Options for this operation.
     *
     * @returns A promise that resolves to an array of collection names.
     *
     * @see CollectionOptions
     */
    listCollections(options: ListCollectionsOptions & {
        nameOnly: true;
    }): Promise<string[]>;
    /**
     * Lists the collections in the database.
     *
     * If you want to use only the collection names, set `nameOnly` to `true` (or omit it completely), using the other overload.
     *
     * You can also specify a keyspace in the options parameter, which will override the default keyspace for this database.
     *
     * @example
     * ```typescript
     * // [{ name: "users" }, { name: "posts", options: { ... } }]
     * console.log(await db.listCollections());
     * ```
     *
     * @param options - Options for this operation.
     *
     * @returns A promise that resolves to an array of collection info.
     *
     * @see CollectionOptions
     */
    listCollections(options?: ListCollectionsOptions & {
        nameOnly?: false;
    }): Promise<FullCollectionInfo[]>;
    /**
     * Send a POST request to the Data API for this database with an arbitrary, caller-provided payload.
     *
     * You can specify a collection to target in the options parameter, thereby allowing you to perform
     * arbitrary collection-level operations as well.
     *
     * You're also able to specify a keyspace in the options parameter, which will override the default keyspace
     * for this database.
     *
     * If no collection is specified, the command will be executed at the database level.
     *
     * @example
     * ```typescript
     * const colls = await db.command({ findCollections: {} });
     * console.log(colls); // { status: { collections: [] } }
     *
     * const users = await db.command({ findOne: {} }, { collection: 'users' });
     * console.log(users); // { data: { document: null } }
     * ```
     *
     * @param command - The command to send to the Data API.
     * @param options - Options for this operation.
     *
     * @returns A promise that resolves to the raw response from the Data API.
     */
    command(command: Record<string, any>, options?: RunCommandOptions): Promise<RawDataAPIResponse>;
    private get _httpClient();
}

/**
 * Represents some DatabaseAdmin class used for managing some specific database.
 *
 * This abstract version lists the core functionalities that any database admin class may have, but
 * subclasses may have additional methods or properties (e.g. {@link AstraDbAdmin}).
 *
 * Use {@link Db.admin} or {@link AstraAdmin.dbAdmin} to obtain an instance of this class.
 *
 * @public
 */
export declare abstract class DbAdmin {
    /**
     * Gets the underlying `Db` object. The options for the db were set when the DbAdmin instance, or whatever spawned
     * it, was created.
     *
     * @example
     * ```typescript
     * const dbAdmin = client.admin().dbAdmin('<endpoint>', {
     *   keyspace: 'my-keyspace',
     *   useHttp2: false,
     * });
     *
     * const db = dbAdmin.db();
     * console.log(db.id);
     * ```
     *
     * @returns The underlying `Db` object.
     */
    abstract db(): Db;
    /**
     * Returns detailed information about the availability and usage of the vectorize embedding providers available on the
     * current database (may vary based on cloud provider & region).
     *
     * @example
     * ```typescript
     * const { embeddingProviders } = await dbAdmin.findEmbeddingProviders();
     *
     * // ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']
     * console.log(embeddingProviders['openai'].models.map(m => m.name));
     * ```
     *
     * @param options - The options for the timeout of the operation.
     *
     * @returns The available embedding providers.
     */
    abstract findEmbeddingProviders(options?: WithTimeout): Promise<FindEmbeddingProvidersResult>;
    /**
     * Retrieves a list of all the keyspaces in the database.
     *
     * Semantic order is not guaranteed, but implementations are free to assign one. {@link AstraDbAdmin}, for example,
     * always has the first keyspace in the array be the default one.
     *
     * @example
     * ```typescript
     * const keyspaces = await dbAdmin.listKeyspaces();
     *
     * // ['default_keyspace', 'my_other_keyspace']
     * console.log(keyspaces);
     * ```
     *
     * @returns A promise that resolves to list of all the keyspaces in the database.
     */
    abstract listKeyspaces(): Promise<string[]>;
    /**
     * Retrieves a list of all the keyspaces in the database.
     *
     * Creates a new, additional, keyspace for this database.
     *
     * This is now a deprecated alias for the strictly equivalent {@link DbAdmin.listKeyspaces}, and will be removed
     * in an upcoming major version.
     *
     * @deprecated - Prefer {@link DbAdmin.listKeyspaces} instead.
     */
    abstract listNamespaces(): Promise<string[]>;
    /**
     * Creates a new, additional, keyspace for this database.
     *
     * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
     * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
     *
     * @example
     * ```typescript
     * await dbAdmin.createKeyspace('my_other_keyspace1');
     *
     * // ['default_keyspace', 'my_other_keyspace1']
     * console.log(await dbAdmin.listKeyspaces());
     *
     * await dbAdmin.createKeyspace('my_other_keyspace2', {
     *   blocking: false,
     * });
     *
     * // Will not include 'my_other_keyspace2' until the operation completes
     * console.log(await dbAdmin.listKeyspaces());
     * ```
     *
     * @remarks
     * Note that if you choose not to block, the created keyspace will not be able to be used until the
     * operation completes, which is up to the caller to determine.
     *
     * @param keyspace - The name of the new keyspace.
     * @param options - The options for the blocking behavior of the operation.
     *
     * @returns A promise that resolves when the operation completes.
     */
    abstract createKeyspace(keyspace: string, options?: CreateKeyspaceOptions): Promise<void>;
    /**
     * Creates a new, additional, keyspace for this database.
     *
     * This is now a deprecated alias for the strictly equivalent {@link DbAdmin.createKeyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link DbAdmin.createKeyspace} instead.
     */
    abstract createNamespace(keyspace: string, options?: CreateNamespaceOptions): Promise<void>;
    /**
     * Drops a keyspace from this database.
     *
     * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
     * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
     *
     * @example
     * ```typescript
     * await dbAdmin.dropKeyspace('my_other_keyspace1');
     *
     * // ['default_keyspace', 'my_other_keyspace2']
     * console.log(await dbAdmin.listKeyspaces());
     *
     * await dbAdmin.dropKeyspace('my_other_keyspace2', {
     *   blocking: false,
     * });
     *
     * // Will still include 'my_other_keyspace2' until the operation completes
     * // ['default_keyspace', 'my_other_keyspace2']
     * console.log(await dbAdmin.listKeyspaces());
     * ```
     *
     * @remarks
     * Note that if you choose not to block, the keyspace will still be able to be used until the operation
     * completes, which is up to the caller to determine.
     *
     * @param keyspace - The name of the keyspace to drop.
     * @param options - The options for the blocking behavior of the operation.
     *
     * @returns A promise that resolves when the operation completes.
     */
    abstract dropKeyspace(keyspace: string, options?: AdminBlockingOptions): Promise<void>;
    /**
     * Drops a keyspace from this database.
     *
     * This is now a deprecated alias for the strictly equivalent {@link DbAdmin.dropKeyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link DbAdmin.dropKeyspace} instead.
     */
    abstract dropNamespace(keyspace: string, options?: AdminBlockingOptions): Promise<void>;
}

/**
 * Basic metrics information about a database.
 *
 * @public
 */
export declare interface DbMetricsInfo {
    /**
     * The number of errors that have occurred in the database.
     */
    errorsTotalCount: number;
    /**
     * The number of live data bytes in the database.
     */
    liveDataSizeBytes: number;
    /**
     * The number of read requests that have occurred in the database.
     */
    readRequestsTotalCount: number;
    /**
     * The number of write requests that have occurred in the database.
     */
    writeRequestsTotalCount: number;
}

/**
 * The options available spawning a new {@link Db} instance.
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
 *
 * @public
 */
export declare interface DbSpawnOptions {
    /**
     * The keyspace to use for the database.
     *
     * There are a few rules for what the default keyspace will be:
     * 1. If a keyspace was provided when creating the {@link DataAPIClient}, it will default to that value.
     * 2. If using an `astra` database, it'll default to "default_keyspace".
     * 3. Otherwise, no default will be set, and it'll be on the user to provide one when necessary.
     *
     * The client itself will not throw an error if an invalid keyspace (or even no keyspace at all) is provided—it'll
     * let the Data API propagate the error itself.
     *
     * Every db method will use this keyspace as the default keyspace, but they all allow you to override it
     * in their options.
     *
     * @example
     * ```typescript
     * const client = new DataAPIClient('AstraCS:...');
     *
     * // Using 'default_keyspace' as the keyspace
     * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
     *
     * // Using 'my_keyspace' as the keyspace
     * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
     *   keyspace: 'my_keyspace',
     * });
     *
     * // Finds 'my_collection' in 'default_keyspace'
     * const coll1 = db1.collection('my_collection');
     *
     * // Finds 'my_collection' in 'my_keyspace'
     * const coll2 = db1.collection('my_collection');
     *
     * // Finds 'my_collection' in 'other_keyspace'
     * const coll3 = db1.collection('my_collection', { keyspace: 'other_keyspace' });
     * ```
     *
     * @defaultValue 'default_keyspace'
     */
    keyspace?: string;
    /**
     * The keyspace to use for the database.
     *
     * This is now a deprecated alias for the strictly equivalent {@link DbSpawnOptions.keyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link DbSpawnOptions.keyspace} instead.
     */
    namespace?: string;
    /**
     * Whether to monitor commands for {@link Db}-level & {@link Collection}-level events through an event emitter.
     *
     * Defaults to `false` if never provided. However, if it was provided when creating the {@link DataAPIClient}, it will
     * default to that value instead.
     *
     * @example
     * ```typescript
     * const client = new DataAPIClient('*TOKEN*', {
     *   dbOptions: {
     *     monitorCommands: true,
     *   },
     * });
     *
     * client.on('commandStarted', (event) => {
     *   console.log(`Running command ${event.commandName}`);
     * });
     *
     * client.on('commandSucceeded', (event) => {
     *   console.log(`Command ${event.commandName} succeeded in ${event.duration}ms`);
     * });
     *
     * client.on('commandFailed', (event) => {
     *   console.error(`Command ${event.commandName} failed w/ error ${event.error}`);
     * });
     *
     * const db = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
     * const coll = db.collection('my_collection');
     *
     * // Logs:
     * // - Running command insertOne
     * // - Command insertOne succeeded in <time>ms
     * await coll.insertOne({ name: 'Lordi' });
     * ```
     *
     * @defaultValue false
     *
     * @see DataAPICommandEvents
     */
    monitorCommands?: boolean;
    /**
     * The access token for the Data API, typically of the format `'AstraCS:...'`.
     *
     * If never provided, this will default to the token provided when creating the {@link DataAPIClient}.
     *
     * @example
     * ```typescript
     * const client = new DataAPIClient('strong-token');
     *
     * // Using 'strong-token' as the token
     * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
     *
     * // Using 'weaker-token' instead of 'strong-token'
     * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
     *   token: 'weaker-token',
     * });
     * ```
     */
    token?: string | TokenProvider | null;
    /**
     * The path to the Data API, which is going to be `api/json/v1` for all Astra instances. However, it may vary
     * if you're using a different Data API-compatible endpoint.
     *
     * Defaults to `'api/json/v1'` if never provided. However, if it was provided when creating the {@link DataAPIClient},
     * it will default to that value instead.
     *
     * @defaultValue 'api/json/v1'
     */
    dataApiPath?: string;
}

/**
 * The default keyspace used when no keyspace is explicitly provided on DB creation.
 *
 * @public
 */
export declare const DEFAULT_KEYSPACE = "default_keyspace";

/**
 * The options available for the {@link DataAPIClient} related to making HTTP requests using the default http client.
 *
 * If loading the default client fails, and httpOptions is set, it'll throw an {@link FailedToLoadDefaultClientError}.
 *
 * If loading the default client fails, and httpOptions is not set, it'll silently fall back to the native fetch API.
 *
 * If you're minifying your code, you'll need to provide the fetch-h2 module manually (see
 * {@link DefaultHttpClientOptions.fetchH2}).
 *
 * See the `astra-db-ts` README for more information on different clients.
 *
 * https://github.com/datastax/astra-db-ts
 *
 * @public
 */
export declare interface DefaultHttpClientOptions {
    /**
     * Use the default http client for making HTTP requests (currently fetch-h2).
     *
     * Leave undefined to use the default client (you don't need to specify `'default'`).
     */
    client?: 'default';
    /**
     * Whether to prefer HTTP/2 for requests to the Data API; if set to `false`, HTTP/1.1 will be used instead.
     *
     * **Note that this is only available when using the Data API; the DevOps API does not support HTTP/2**
     *
     * Both versions are generally interchangeable, but HTTP2 is generally recommended for better performance.
     *
     * Defaults to `true` if never provided.
     *
     * @defaultValue true
     */
    preferHttp2?: boolean;
    /**
     * The default maximum time in milliseconds to wait for a response from the server.
     *
     * This does *not* mean the request will be cancelled after this time, but rather that the client will wait
     * for this time before considering the request to have timed out.
     *
     * The request may or may not still be running on the server after this time.
     */
    maxTimeMS?: number;
    /**
     * Options specific to HTTP/1.1 requests.
     */
    http1?: Http1Options;
    /**
     * The fetch-h2 module to use for making HTTP requests.
     *
     * Leave undefined to use the default module.
     */
    fetchH2?: unknown;
}

/**
 * Represents the options for the default ID.
 *
 * **If `type` is not specified, the default ID will be a string UUID.**
 *
 * @field type - The type of the default ID.
 *
 * @public
 */
export declare interface DefaultIdOptions {
    /**
     * The type of the default ID that the API should generate if no ID is provided in the inserted document.
     *
     * **If not specified, the default ID will be a string UUID.**
     *
     * | Type       | Description    | Example                                            |
     * |------------|----------------|----------------------------------------------------|
     * | `uuid`     | A UUID v4.     | `new UUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')` |
     * | `uuidv6`   | A UUID v6.     | `new UUID('6f752f1a-6b6d-4f3e-8e1e-2e167e3b5f3d')` |
     * | `uuidv7`   | A UUID v7.     | `new UUID('018e75ff-a07b-7b08-bb91-aa566c5abaa6')` |
     * | `objectId` | An ObjectID.   | `new ObjectId('507f1f77bcf86cd799439011')`         |
     * | default    | A string UUID. | `'f47ac10b-58cc-4372-a567-0e02b2c3d479'`           |
     *
     * @example
     * ```typescript
     * const collection = await db.createCollection('my-collection');
     *
     * // { name: 'Jessica', _id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }
     * await collection.insertOne({ name: 'Jessica' });
     *```
     *
     * @example
     * ```typescript
     * const collection = await db.createCollection('my-collection', {
     *   defaultId: { type: 'uuidv6' },
     * });
     *
     * // { name: 'Allman', _id: UUID('6f752f1a-6b6d-6f3e-8e1e-2e167e3b5f3d') }
     * await collection.insertOne({ name: 'Allman' });
     * ```
     *
     * @example
     * ```typescript
     * const collection = await db.createCollection('my-collection', {
     *   defaultId: { type: 'objectId' },
     * });
     *
     * // { name: 'Brothers', _id: ObjectId('507f1f77bcf86cd799439011') }
     * await collection.insertOne({ name: 'Brothers' });
     * ```
     *
     * @remarks Make sure you're keeping this all in mind if you're specifically typing your _id field.
     */
    type: 'uuid' | 'uuidv6' | 'uuidv7' | 'objectId';
}

/**
 * Represents an error that occurred during a `deleteMany` operation (which is, generally, paginated).
 *
 * Contains the number of documents that were successfully deleted, as well as the cumulative errors that occurred
 * during the operation.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 * @field partialResult - The partial result of the `DeleteMany` operation that was performed
 *
 * @public
 */
export declare class DeleteManyError extends CumulativeDataAPIError {
    /**
     * The name of the error. This is always 'DeleteManyError'.
     */
    name: string;
    /**
     * The partial result of the `DeleteMany` operation that was performed. This is *always* defined, and is the result
     * of the operation up to the point of the first error.
     */
    readonly partialResult: DeleteManyResult;
}

/**
 * Represents a deleteMany operation that can be used in a bulk write operation.
 *
 * @public
 */
export declare interface DeleteManyModel<TSchema extends SomeDoc> {
    /**
     * The filter to choose the documents to delete.
     */
    filter: Filter<TSchema>;
}

/**
 * Represents the result of a delete command.
 *
 * @field deletedCount - The number of deleted documents. Can be any non-negative integer.
 *
 * @see Collection.deleteMany
 *
 * @public
 */
export declare interface DeleteManyResult {
    /**
     * The number of deleted documents.
     */
    deletedCount: number;
}

/**
 * Represents a deleteOne operation that can be used in a bulk write operation.
 *
 * @field filter - The filter to choose the document to delete.
 *
 * @public
 */
export declare interface DeleteOneModel<TSchema extends SomeDoc> {
    /**
     * The filter to choose the document to delete.
     */
    filter: Filter<TSchema>;
}

/**
 * Represents the options for the deleteOne command.
 *
 * @field sort - The sort order to pick which document to delete if the filter selects multiple documents.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.deleteOne
 *
 * @public
 */
export declare interface DeleteOneOptions extends WithTimeout {
    /**
     * The order in which to apply the update if the filter selects multiple documents.
     *
     * If multiple documents match the filter, only one will be updated.
     *
     * Defaults to `null`, where the order is not guaranteed.
     * @defaultValue null
     */
    sort?: Sort;
    /**
     * An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection
     * to find the closest matching document.
     *
     * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field in the
     * sort field itself. The two are interchangeable, but mutually exclusive.
     *
     * If the sort field is already set, an error will be thrown. If you really need to use both, you can set the $vector
     * field in the sort object directly.
     *
     * @deprecated - Prefer to use `sort: { $vector: [...] }` instead
     */
    vector?: number[];
    /**
     * Akin to {@link DeleteOneOptions.vector}, but for `$vectorize`.
     *
     * @deprecated - Prefer to use `sort: { $vectorize: '...' }` instead
     */
    vectorize?: string;
}

/**
 * Represents the result of a delete command.
 *
 * @field deletedCount - The number of deleted documents. Can be either 0 or 1.
 *
 * @see Collection.deleteOne
 *
 * @public
 */
export declare interface DeleteOneResult {
    /**
     * The number of deleted documents.
     */
    deletedCount: 0 | 1;
}

/**
 * An abstract class representing *some* exception that occurred related to the DevOps API. This is the base class for all
 * DevOps API errors, and will never be thrown directly.
 *
 * Useful for `instanceof` checks.
 *
 * @public
 */
export declare abstract class DevOpsAPIError extends Error {
}

/**
 * A representation of what went wrong when interacting with the DevOps API.
 *
 * @field id - The API-specific error code.
 * @field message - A user-friendly error message, if one exists (it most often does).
 *
 * @public
 */
export declare interface DevOpsAPIErrorDescriptor {
    /**
     * The API-specific error code.
     */
    id: number;
    /**
     * A user-friendly error message, if one exists (it most often does).
     */
    message?: string;
}

/* Excluded from this release type: DevOpsAPIRequestInfo */

/**
 * An error representing a response from the DevOps API that was not successful (non-2XX status code).
 *
 * @field errors - The error descriptors returned by the API to describe what went wrong.
 * @field rootError - The raw axios error that was thrown.
 * @field status - The HTTP status code of the response, if available.
 *
 * @public
 */
export declare class DevOpsAPIResponseError extends DevOpsAPIError {
    /**
     * The error descriptors returned by the API to describe what went wrong.
     */
    readonly errors: DevOpsAPIErrorDescriptor[];
    /**
     * The HTTP status code of the response, if available.
     */
    readonly status: number;
    /**
     * The "raw", errored response from the API.
     */
    readonly raw: FetcherResponseInfo;
    /* Excluded from this release type: __constructor */
}

/**
 * An error thrown when an admin operation timed out.
 *
 * Depending on the method, this may be a request timeout occurring during a specific HTTP request, or can happen over
 * the course of a method involving several requests in a row, such as a blocking `createDatabase`.
 *
 * @field url - The URL that the request was made to.
 * @field timeout - The timeout that was set for the operation, in milliseconds.
 *
 * @public
 */
export declare class DevOpsAPITimeoutError extends DevOpsAPIError {
    /**
     * The URL that the request was made to.
     */
    readonly url: string;
    /**
     The timeout that was set for the operation, in milliseconds.
     */
    readonly timeout: number;
    /* Excluded from this release type: __constructor */
}

/**
 * Error thrown when the DevOps API returns is in an unexpected state (i.e. `'PARKED'` when `'ACTIVE'` or `'PENDING'`
 * was expected).
 *
 * @field dbInfo - The complete database info, which includes the status of the database.
 * @field status - The HTTP status code of the response, if available.
 *
 * @public
 */
export declare class DevOpsUnexpectedStateError extends DevOpsAPIError {
    /**
     * The expected states that were not met.
     */
    readonly expected: string[];
    /**
     * The complete database info, which includes the status of the database.
     */
    readonly dbInfo?: FullDatabaseInfo;
    /* Excluded from this release type: __constructor */
}

/**
 * Options for dropping a collection.
 *
 * @field keyspace - Overrides the keyspace for the collection.
 * @field maxTimeMS - The maximum time to allow the operation to run.
 *
 * @see Db.dropCollection
 *
 * @public
 */
export declare interface DropCollectionOptions extends WithTimeout, WithKeyspace {
}

/**
 * The most basic embedding header provider, used for the vast majority of providers.
 *
 * Generally, anywhere this can be used in the public `astra-db-ts` interfaces, you may also pass in a plain
 * string or null/undefined, which is transformed into an {@link EmbeddingAPIKeyHeaderProvider} under the hood.
 *
 * @example
 * ```typescript
 * const provider = new EmbeddingAPIKeyHeaderProvider('api-key');
 * const collection = await db.collection('my_coll', { embeddingApiKey: provider });
 *
 * // or just
 *
 * const collection = await db.collection('my_coll', { embeddingApiKey: 'api-key' });
 * ```
 *
 * @see EmbeddingHeadersProvider
 *
 * @public
 */
export declare class EmbeddingAPIKeyHeaderProvider extends EmbeddingHeadersProvider {
    #private;
    /**
     * Constructs an instead of the {@link EmbeddingAPIKeyHeaderProvider}.
     *
     * @param apiKey - The api-key/token to regurgitate in `getTokenAsString`
     */
    constructor(apiKey: string | nullish);
    /**
     * Returns the proper header for the default embedding header authentication, or an empty record if `apiKey` was undefined.
     *
     * @returns the proper header for the default embedding header authentication.
     */
    getHeaders(): Record<string, string>;
}

/**
 * The base class for an "embedding headers provider", a general concept for anything that provides headers used for
 * vectorize operations on a per-call basis, whether the headers be static, dynamically fetched at runtime, or
 * periodically refreshed/cycled.
 *
 * The {@link EmbeddingHeadersProvider.getHeaders} function is called for every request to the Data API, regardless
 * of if vectorize is being utilized or not. Note that this is called for every individual request on multipart
 * operations, such as insertMany or find.
 *
 * `astra-db-ts` provides all the main embedding headers providers you may ever need to use, but you're able to extend
 * this class to create your own if you find it necessary.
 *
 * Generally, where you can pass in a `EmbeddingHeadersProvider`, you may also pass in a plain string which is
 * translated into an {@link EmbeddingAPIKeyHeaderProvider} under the hood.
 *
 * @example
 * ```typescript
 * // Using explicit `EmbeddingHeadersProvider`
 * const provider = new AWSEmbeddingHeadersProvider('access-key-id', 'secret-access-key');
 * const coll1 = await db.collection('my_coll1', { embeddingApiKey: provider });
 *
 * // Implicitly converted to `EmbeddingAPIKeyHeaderProvider`
 * const coll2 = await db.collection('my_coll2', { embeddingApiKey: 'sk-...' });
 * ```
 *
 * @see EmbeddingAPIKeyHeaderProvider
 * @see AWSEmbeddingHeadersProvider
 *
 * @public
 */
export declare abstract class EmbeddingHeadersProvider {
    /**
     * The function which provides the headers.
     *
     * It may do any I/O as it wishes to obtain/refresh the token, as it's called for every request to the Data API.
     *
     * If no promise is returned, it will not be awaited (no minor performance impact).
     */
    abstract getHeaders(): Promise<Record<string, string>> | Record<string, string>;
    /* Excluded from this release type: parseHeaders */
}

/**
 * Information about a specific auth method, such as `HEADER`, `SHARED_SECRET`, or `NONE` for a specific provider. See
 * {@link EmbeddingProviderInfo.supportedAuthentication} for more information.
 *
 * See {@link EmbeddingHeadersProvider} for more info about the `HEADER` auth through the client.
 *
 * @example
 * ```typescript
 * // openai.supportedAuthentication.HEADER:
 * {
 *   enabled: true,
 *   tokens: [{
 *     accepted: 'x-embedding-api-key',
 *     forwarded: 'Authorization',
 *   }],
 * }
 * ```
 *
 * @field enabled - Whether this method of auth is supported for the provider.
 * @field tokens - Additional info on how exactly this method of auth is supposed to be used.
 *
 * @see EmbeddingProviderInfo
 *
 * @public
 */
export declare interface EmbeddingProviderAuthInfo {
    /**
     * Whether this method of auth is supported for the provider.
     */
    enabled: boolean;
    /**
     * Additional info on how exactly this method of auth is supposed to be used.
     *
     * See {@link EmbeddingHeadersProvider} for more info about the `HEADER` auth through the client.
     *
     * Will be an empty array if `enabled` is `false`.
     */
    tokens: EmbeddingProviderTokenInfo[];
}

/**
 * Info about a specific embedding provider
 *
 * @field displayName - The prettified name of the provider (as shown in the portal)
 * @field url - The embeddings endpoint used for the provider
 * @field supportedAuthentication - Enabled methods of auth for the provider
 * @field parameters - Any additional parameters the provider may take in
 * @field models - The specific models that the provider supports
 *
 * @see FindEmbeddingProvidersResult
 *
 * @public
 */
export declare interface EmbeddingProviderInfo {
    /**
     * The prettified name of the provider (as shown in the Astra portal).
     *
     * @example
     * ```typescript
     * // openai.displayName:
     * 'OpenAI'
     * ```
     */
    displayName: string;
    /**
     * The embeddings endpoint used for the provider.
     *
     * May use a Python f-string-style string interpolation pattern for certain providers which take in additional
     * parameters (such as `huggingfaceDedicated` or `azureOpenAI`).
     *
     * @example
     * ```typescript
     * // openai.url:
     * 'https://api.openai.com/v1/'
     *
     * // huggingfaceDedicated.url:
     * 'https://{endpointName}.{regionName}.{cloudName}.endpoints.huggingface.cloud/embeddings'
     * ```
     */
    url: string;
    /**
     * Supported methods of authentication for the provider.
     *
     * Possible methods include `HEADER`, `SHARED_SECRET`, and `NONE`.
     *
     * - `HEADER`: Authentication using direct API keys passed through headers on every Data API call.
     * See {@link EmbeddingHeadersProvider} for more info.
     * ```typescript
     * const collection = await db.createCollection('my_coll', {
     *   service: {
     *     provider: 'openai',
     *     modelName: 'text-embedding-3-small',
     *     authentication: {
     *       // Name of the key in Astra portal's OpenAI integration (KMS).
     *       providerKey: '*KEY_NAME*',
     *     },
     *   },
     * });
     * ```
     *
     * - `SHARED_SECRET`: Authentication tied to a collection at collection creation time using the Astra KMS.
     * ```typescript
     * const collection = await db.collection('my_coll', {
     *   // Not tied to the collection; can be different every time.
     *   embeddingApiKey: 'sk-...',
     * });
     * ```
     *
     * - `NONE`: For when a client doesn't need authentication to use (e.g. nvidia).
     * ```typescript
     * const collection = await db.createCollection('my_coll', {
     *   service: {
     *     provider: 'nvidia',
     *     modelName: 'NV-Embed-QA',
     *   },
     * });
     * ```
     *
     * @example
     * ```typescript
     * // openai.supportedAuthentication.HEADER:
     * {
     *   enabled: true,
     *   tokens: [{
     *     accepted: 'x-embedding-api-key',
     *     forwarded: 'Authorization',
     *   }],
     * }
     * ```
     */
    supportedAuthentication: Record<string, EmbeddingProviderAuthInfo>;
    /**
     * Any additional, arbitrary parameters the provider may take in. May or may not be required.
     *
     * Passed into the `parameters` block in {@link VectorizeServiceOptions} (except for `vectorDimension`).
     *
     * @example
     * ```typescript
     * // openai.parameters[1]
     * {
     *   name: 'projectId',
     *   type: 'STRING',
     *   required: false,
     *   defaultValue: '',
     *   validation: {},
     *   help: 'Optional, OpenAI Project ID. If provided passed as `OpenAI-Project` header.',
     * }
     * ```
     */
    parameters: EmbeddingProviderProviderParameterInfo[];
    /**
     * The specific models that the provider supports.
     *
     * May include an `endpoint-defined-model` for some providers, such as `huggingfaceDedicated`, where the model
     * may be truly arbitrary.
     *
     * @example
     * ```typescript
     * // nvidia.models[0]
     * {
     *   name: 'NV-Embed-QA',
     *   vectorDimension: 1024,
     *   parameters: [],
     * }
     *
     * // huggingfaceDedicated.models[0]
     * {
     *   name: 'endpoint-defined-model',
     *   vectorDimension: null,
     *   parameters: [{
     *     name: 'vectorDimension',
     *     type: 'number',
     *     required: true,
     *     defaultValue: '',
     *     validation: {
     *       numericRange: [2, 3072],
     *     },
     *     help: 'Vector dimension to use in the database, should be the same as ...',
     *   }],
     * }
     * ```
     */
    models: EmbeddingProviderModelInfo[];
}

/**
 * The specific models that the provider supports.
 *
 * May include an `endpoint-defined-model` for some providers, such as `huggingfaceDedicated`, where the model
 * may be truly arbitrary.
 *
 * @example
 * ```typescript
 * // nvidia.models[0]
 * {
 *   name: 'NV-Embed-QA',
 *   vectorDimension: 1024,
 *   parameters: [],
 * }
 * ```
 *
 * @field name - The name of the model to use
 * @field vectorDimension - The preset, exact vector dimension to be used (if applicable)
 * @field parameters - Any additional parameters the model may take in
 *
 * @see EmbeddingProviderInfo
 *
 * @public
 */
export declare interface EmbeddingProviderModelInfo {
    /**
     * The name of the model to use.
     *
     * May be `endpoint-defined-model` for some providers, such as `huggingfaceDedicated`, where the model
     * may be truly arbitrary.
     *
     * @example
     * ```typescript
     * // openai.models[0].name
     * 'text-embedding-3-small'
     *
     * // huggingfaceDedicated.models[0].name
     * 'endpoint-defined-model'
     * ```
     */
    name: string;
    /**
     * The preset, exact vector dimension to be used (if applicable).
     *
     * If not present, a `vectorDimension` parameter will be present in the `model.parameters` block.
     *
     * @example
     * ```typescript
     * // openai.models[3].vectorDimension (text-embedding-ada-002)
     * 1536
     *
     * // huggingfaceDedicated.models[0].vectorDimension (endpoint-defined-model)
     * null
     * ```
     */
    vectorDimension: number | null;
    /**
     * Any additional, arbitrary parameters the modem may take in. May or may not be required.
     *
     * Passed into the `parameters` block in {@link VectorizeServiceOptions} (except for `vectorDimension`).
     *
     * @example
     * ```typescript
     * // openai.models[0].parameters[0] (text-embedding-3-small)
     * {
     *   name: 'vectorDimension',
     *   type: 'number',
     *   required: true,
     *   defaultValue: '1536',
     *   validation: { numericRange: [2, 1536] },
     *   help: 'Vector dimension to use in the database and when calling OpenAI.',
     * }
     * ```
     */
    parameters: EmbeddingProviderModelParameterInfo[];
}

/**
 * Info about any additional, arbitrary parameter the model may take in. May or may not be required.
 *
 * Passed into the `parameters` block in {@link VectorizeServiceOptions} (except for `vectorDimension`, which should be
 * set in the upper-level `dimension: number` field).
 *
 * @example
 * ```typescript
 * // openai.parameters[1]
 * {
 *   name: 'vectorDimension',
 *   type: 'number',
 *   required: true,
 *   defaultValue: '1536',
 *   validation: { numericRange: [2, 1536] },
 *   help: 'Vector dimension to use in the database and when calling OpenAI.',
 * }
 * ```
 *
 * @field name - The name of the parameter to be passed in.
 * @field type - The datatype of the parameter.
 * @field required - Whether the parameter is required to be passed in.
 * @field defaultValue - The default value of the provider, or an empty string if there is none.
 * @field validation - Validations that may be done on the inputted value.
 * @field help - Any additional help text/information about the parameter.
 *
 * @see EmbeddingProviderInfo
 * @see EmbeddingProviderModelInfo
 *
 * @public
 */
export declare interface EmbeddingProviderModelParameterInfo {
    /**
     * The name of the parameter to be passed in.
     *
     * The one exception is the `vectorDimension` parameter, which should be passed into the `dimension` field of the
     * `vector` block in {@link VectorOptions}.
     *
     * @example
     * ```typescript
     * // huggingface.parameters[0].name
     * endpointName
     * ```
     */
    name: string;
    /**
     * The datatype of the parameter.
     *
     * Commonly `number` or `STRING`.
     *
     * @example
     * ```typescript
     * // huggingface.parameters[0].type
     * STRING
     * ```
     */
    type: string;
    /**
     * Whether the parameter is required to be passed in.
     *
     * @example
     * ```typescript
     * // huggingface.parameters[0].required
     * true
     * ```
     */
    required: boolean;
    /**
     * The default value of the provider, or an empty string if there is none.
     *
     * Will always be in string form (even if the `type` is `'number'`).
     *
     * @example
     * ```typescript
     * // huggingface.parameters[0].defaultValue
     * ''
     * ```
     */
    defaultValue: string;
    /**
     * Validations that may be done on the inputted value.
     *
     * Commonly either an empty record, or `{ numericRange: [<min>, <max>] }`.
     *
     * @example
     * ```typescript
     * // huggingface.parameters[0].validation
     * {}
     * ```
     */
    validation: Record<string, unknown>[];
    /**
     * Any additional help text/information about the parameter.
     *
     * @example
     * ```typescript
     * // huggingface.parameters[0].help
     * 'The name of your Hugging Face dedicated endpoint, the first part of the Endpoint URL.'
     * ```
     */
    help: string;
}

/**
 * Info about any additional, arbitrary parameter the provider may take in. May or may not be required.
 *
 * Passed into the `parameters` block in {@link VectorizeServiceOptions} (except for `vectorDimension`, which should be
 * set in the upper-level `dimension: number` field).
 *
 * @example
 * ```typescript
 * // openai.parameters[1]
 * {
 *   name: 'projectId',
 *   type: 'STRING',
 *   required: false,
 *   defaultValue: '',
 *   validation: {},
 *   help: 'Optional, OpenAI Project ID. If provided passed as `OpenAI-Project` header.',
 *   displayName: 'Organization ID',
 *   hint: 'Add an (optional) organization ID',
 * }
 * ```
 *
 * @field name - The name of the parameter to be passed in.
 * @field type - The datatype of the parameter.
 * @field required - Whether the parameter is required to be passed in.
 * @field defaultValue - The default value of the provider, or an empty string if there is none.
 * @field validation - Validations that may be done on the inputted value.
 * @field help - Any additional help text/information about the parameter.
 * @field displayName - Display name for the parameter.
 * @field hint - Hint for parameter usage.
 *
 * @see EmbeddingProviderInfo
 * @see EmbeddingProviderModelInfo
 *
 * @public
 */
export declare interface EmbeddingProviderProviderParameterInfo extends EmbeddingProviderModelParameterInfo {
    /**
     * Display name for the parameter.
     *
     * @example
     * ```typescript
     * // openai.parameters[0].displayName
     * 'Organization ID'
     * ```
     */
    displayName: string;
    /**
     * Hint for parameter usage.
     *
     * @example
     * ```typescript
     * // openai.parameters[0].hint
     * 'Add an (optional) organization ID'
     * ```
     */
    hint: string;
}

/**
 * Info on how exactly a method of auth may be used.
 *
 * @example
 * ```typescript
 * // openai.supportedAuthentication.HEADER.tokens[0]:
 * {
 *   accepted: 'x-embedding-api-key',
 *   forwarded: 'Authorization',
 * }
 * ```
 *
 * @field accepted - The accepted token
 * @field forwarded - How the token is forwarded to the embedding provider
 *
 * @see EmbeddingProviderAuthInfo
 *
 * @public
 */
export declare interface EmbeddingProviderTokenInfo {
    /**
     * The accepted token.
     *
     * May most often be `providerKey` for `SHARED_SECRET`, or `x-embedding-api-key` for `HEADER`.
     *
     * See {@link EmbeddingHeadersProvider} for more info about the `HEADER` auth through the client.
     */
    accepted: string;
    /**
     * How the token is forwarded to the embedding provider.
     */
    forwarded: string;
}

declare type EmissionStrategy = (emitter: TypedEmitter<DataAPIClientEvents>) => {
    emitCommandStarted(info: DataAPIRequestInfo): void;
    emitCommandFailed(info: DataAPIRequestInfo, error: Error, started: number): void;
    emitCommandSucceeded(info: DataAPIRequestInfo, resp: RawDataAPIResponse, warnings: string[], started: number): void;
};

declare const EmissionStrategy: Record<'Normal' | 'Admin', EmissionStrategy>;

declare interface ExecuteCommandOptions extends WithNullableKeyspace {
    collection?: string;
}

declare type Expand<T> = T extends infer O ? {
    [K in keyof O]: O[K];
} : never;

/**
 * Error thrown when the default fetch-h2 client fails to load.
 *
 * @public
 */
export declare class FailedToLoadDefaultClientError extends Error {
    /**
     * Root error that caused the failure to load the default client.
     */
    readonly rootCause: Error;
    /* Excluded from this release type: __constructor */
}

/* Excluded from this release type: FetchCtx */

/**
 * A simple adapter interface that allows you to define a custom http client that `astra-db-ts` may use to make requests.
 *
 * See [FetchH2](https://github.com/datastax/astra-db-ts/blob/master/src/api/fetch/fetch-h2.ts) and
 * [FetchNative](https://github.com/datastax/astra-db-ts/blob/master/src/api/fetch/fetch-native.ts) for example
 * implementations.
 *
 * @public
 */
export declare interface Fetcher {
    /**
     * Makes the actual API request for the given request information. Please take all request information into account
     * when making the request, or you may run into errors or unexpected behavior from your implementation.
     *
     * @param info - The request information (url, body, method, headers, etc.)
     */
    fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo>;
    /**
     * Optional method which may destroy any resources, if necessary. Called on {@link DataAPIClient.close}.
     */
    close?(): Promise<void>;
}

/**
 * The information required to make a request with a {@link Fetcher}. Please take all request information into account
 * when making the request, or you may run into errors or unexpected behavior from your implementation.
 *
 * @public
 */
export declare interface FetcherRequestInfo {
    /**
     * The full URL to make the request to.
     */
    url: string;
    /**
     * The JSON.stringified body of the request, if it exists. Make sure you're settings the content-type
     * as `application/json` if applicable.
     */
    body: string | undefined;
    /**
     * The HTTP method to use for the request.
     */
    method: 'DELETE' | 'GET' | 'POST';
    /**
     * The base headers to include in the request (you may add or even override your own as necessary)
     */
    headers: Record<string, string>;
    /**
     * Whether to force HTTP/1.1 for the request. This is important as the DevOps API does not support HTTP/2, and thus
     * you may need to force HTTP/1.1 for certain requests if you're using a client that prefers HTTP/2.
     */
    forceHttp1: boolean | undefined;
    /**
     * Creates the timeout error for the request (you may need to first catch your own timeout error and then call this
     * method to create the new ubiquitous error).
     */
    mkTimeoutError: () => Error;
    /**
     * The timeout in milliseconds for the request.
     */
    timeout: number;
}

/**
 * Response object from an API call made by a {@link Fetcher}.
 *
 * @public
 */
export declare interface FetcherResponseInfo {
    /**
     * The string body of the response, if it exists.
     */
    body?: string;
    /**
     * The headers of the response.
     */
    headers: Record<string, string>;
    /**
     * The HTTP status code of the response.
     */
    status: number;
    /**
     * The HTTP version used for the request.
     */
    httpVersion: 1 | 2;
    /**
     * The URL that the request was made to.
     */
    url: string;
    /**
     * The status text for the response.
     */
    statusText: string;
    /**
     * Any additional attributes that may be included in the response (for use w/ custom {@link Fetcher} implementations).
     *
     * This is mainly for any potential logging or debugging information that may be useful for the user.
     */
    additionalAttributes?: Record<string, any>;
}

/**
 * Fetcher implementation which uses `fetch-h2` to perform HTTP/1.1 or HTTP/2 calls. Generally more performant than
 * the native fetch API, but less portable.
 *
 * @public
 */
export declare class FetchH2 implements Fetcher {
    private readonly _http1;
    private readonly _preferred;
    private readonly _timeoutErrorCls;
    constructor(options: DefaultHttpClientOptions | undefined, preferHttp2: boolean);
    /**
     * Performances the necessary HTTP request using the desired HTTP version.
     */
    fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo>;
    /**
     * Explicitly releases any underlying network resources held by the `fetch-h2` context.
     */
    close(): Promise<void>;
}

/**
 * The options available for the {@link DataAPIClient} related to making HTTP requests using the native fetch API.
 *
 * This will be the fallback client if the default client fails to load/if the default client is not available.
 *
 * See the `astra-db-ts` README for more information on different clients.
 *
 * https://github.com/datastax/astra-db-ts
 *
 * @public
 */
export declare interface FetchHttpClientOptions {
    /**
     * Use the native fetch API for making HTTP requests.
     */
    client: 'fetch';
    /**
     * The default maximum time in milliseconds to wait for a response from the server.
     *
     * This does *not* mean the request will be cancelled after this time, but rather that the client will wait
     * for this time before considering the request to have timed out.
     *
     * The request may or may not still be running on the server after this time.
     */
    maxTimeMS?: number;
}

/**
 * Fetcher implementation which uses the native fetch API to perform HTTP calls. Much more portable
 * than {@link FetchH2}, though may be less performant.
 *
 * @public
 */
export declare class FetchNative implements Fetcher {
    /**
     Performances the necessary HTTP request.
     */
    fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo>;
    /**
     * No-op since the native fetch API has no resources to clean up
     */
    close(): Promise<void>;
}

/**
 * Represents some filter operation for a given document schema.
 *
 * **If you want stricter type-checking and full auto-complete, see {@link StrictFilter}.**
 *
 * This is a more relaxed version of {@link StrictFilter} that doesn't type-check nested fields.
 *
 * @example
 * ```typescript
 * interface BasicSchema {
 *   arr: string[],
 *   num: number,
 * }
 *
 * db.collection<BasicSchema>('coll_name').findOne({
 *   $and: [
 *     { _id: { $in: ['abc', 'def'] } },
 *     { $not: { arr: { $size: 0 } } },
 *   ]
 * });
 * ```
 *
 * @see StrictFilter
 *
 * @public
 */
export declare type Filter<Schema extends SomeDoc> = {
    [K in keyof NoId<Schema>]?: FilterExpr<NoId<Schema>[K]>;
} & {
    _id?: FilterExpr<IdOf<Schema>>;
    $and?: Filter<Schema>[];
    $or?: Filter<Schema>[];
    $not?: Filter<Schema>;
} & {
    [key: string]: any;
};

/**
 * Represents an expression in a filter statement, such as an exact value, or a filter operator
 *
 * @public
 */
export declare type FilterExpr<Elem> = Elem | FilterOps<Elem>;

/**
 * Represents filter operators such as `$eq` and `$in` (but not statements like `$and`)
 *
 * @public
 */
export declare type FilterOps<Elem> = {
    $eq?: Elem;
    $ne?: Elem;
    $in?: Elem[];
    $nin?: Elem[];
    $exists?: boolean;
} & (IsNum<Elem> extends false ? {} : NumFilterOps) & (IsDate<Elem> extends false ? {} : (DateFilterOps | Date)) & (any[] extends Elem ? ArrayFilterOps<Elem> : {});

/**
 * Lazily iterates over the document results of a query.
 *
 * **Shouldn't be directly instantiated, but rather created via {@link Collection.find}**.
 *
 * Typed as `FindCursor<T, TRaw>` where `T` is the type of the mapped documents and `TRaw` is the type of the raw
 * documents before any mapping. If no mapping function is provided, `T` and `TRaw` will be the same type. Mapping
 * is done using the {@link FindCursor.map} method.
 *
 * @example
 * ```typescript
 * interface Person {
 *   firstName: string;
 *   lastName: string;
 *   age: number;
 * }
 *
 * const collection = db.collection<Person>('people');
 * let cursor = collection.find().filter({ firstName: 'John' });
 *
 * // Lazily iterate all documents matching the filter
 * for await (const doc of cursor) {
 *   console.log(doc);
 * }
 *
 * // Rewind the cursor to be able to iterate again
 * cursor.rewind();
 *
 * // Get all documents matching the filter as an array
 * const docs = await cursor.toArray();
 *
 * cursor.rewind();
 *
 * // Set options & map as needed
 * cursor: Cursor<string> = cursor
 *   .project<Omit<Person, 'age'>>({ firstName: 1, lastName: 1 })
 *   .map(doc => doc.firstName + ' ' + doc.lastName);
 *
 * // Get next document from cursor
 * const doc = await cursor.next();
 * ```
 *
 * @public
 */
export declare class FindCursor<T, TRaw extends SomeDoc = SomeDoc> {
    private readonly _keyspace;
    private readonly _httpClient;
    private readonly _options;
    private _filter;
    private _mapping?;
    private _buffer;
    private _nextPageState?;
    private _state;
    private _sortVector?;
    /* Excluded from this release type: __constructor */
    /**
     * The keyspace of the collection that's being iterated over.
     *
     * @returns The keyspace of the collection that's being iterated over.
     */
    get keyspace(): string;
    /**
     * The keyspace of the collection that's being iterated over.
     *
     * This is now a deprecated alias for the strictly equivalent {@link FindCursor.keyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link FindCursor.keyspace} instead.
     */
    get namespace(): string;
    /**
     * Whether the cursor is closed, whether it be manually, or because the cursor is exhausted.
     *
     * @returns Whether or not the cursor is closed.
     */
    get closed(): boolean;
    /**
     * Returns the number of documents in the buffer. If the cursor is unused, it'll return 0.
     *
     * @returns The number of documents in the buffer.
     */
    bufferedCount(): number;
    /**
     * Sets the filter for the cursor, overwriting any previous filter. Note that this filter is weakly typed. Prefer
     * to pass in a filter through the constructor instead, if strongly typed filters are desired.
     *
     * **NB. This method acts on the original documents, before any mapping.**
     *
     * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
     *
     * @param filter - A filter to select which documents to return.
     *
     * @returns The cursor.
     *
     * @see StrictFilter
     */
    filter(filter: Filter<TRaw>): this;
    /**
     * Sets the sort criteria for prioritizing documents. Note that this sort is weakly typed. Prefer to pass in a sort
     * through the constructor instead, if strongly typed sorts are desired.
     *
     * **NB. This method acts on the original documents, before any mapping.**
     *
     * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
     *
     * @param sort - The sort order to prioritize which documents are returned.
     *
     * @returns The cursor.
     *
     * @see StrictSort
     */
    sort(sort: Sort): this;
    /**
     * Sets the maximum number of documents to return.
     *
     * If `limit == 0`, there will be no limit on the number of documents returned.
     *
     * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
     *
     * @param limit - The limit for this cursor.
     *
     * @returns The cursor.
     */
    limit(limit: number): this;
    /**
     * Sets the number of documents to skip before returning.
     *
     * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
     *
     * @param skip - The skip for the cursor query.
     *
     * @returns The cursor.
     */
    skip(skip: number): this;
    /**
     * Sets the projection for the cursor, overwriting any previous projection.
     *
     * **NB. This method acts on the original documents, before any mapping.**
     *
     * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
     *
     * **To properly type this method, you should provide a type argument for `T` to specify the shape of the projected
     * documents, *with mapping applied*.**
     *
     * @example
     * ```typescript
     * const cursor = collection.find({ name: 'John' });
     *
     * // T is `any` because the type is not specified
     * const rawProjected = cursor.project({ _id: 0, name: 1 });
     *
     * // T is { name: string }
     * const projected = cursor.project<{ name: string }>({ _id: 0, name: 1 });
     *
     * // You can also chain instead of using intermediate variables
     * const fluentlyProjected = collection
     *   .find({ name: 'John' })
     *   .project<{ name: string }>({ _id: 0, name: 1 });
     *
     * // It's important to keep mapping in mind
     * const mapProjected = collection
     *   .find({ name: 'John' })
     *   .map(doc => doc.name);
     *   .project<string>({ _id: 0, name: 1 });
     * ```
     *
     * @param projection - Specifies which fields should be included/excluded in the returned documents.
     *
     * @returns The cursor.
     *
     * @see StrictProjection
     */
    project<R = any, RRaw extends SomeDoc = SomeDoc>(projection: Projection): FindCursor<R, RRaw>;
    /**
     * Sets whether similarity scores should be included in the cursor's results.
     *
     * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
     *
     * @param includeSimilarity - Whether similarity scores should be included.
     *
     * @returns The cursor.
     */
    includeSimilarity(includeSimilarity?: boolean): this;
    /**
     * Sets whether the sort vector should be fetched on the very first API call. Note that this is a requirement
     * to use {@link FindCursor.getSortVector}—it'll unconditionally return `null` if this is not set to `true`.
     *
     * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
     *
     * @param includeSortVector - Whether the sort vector should be fetched on the first API call
     *
     * @returns The cursor.
     */
    includeSortVector(includeSortVector?: boolean): this;
    /**
     * Map all documents using the provided mapping function. Previous mapping functions will be composed with the new
     * mapping function (new ∘ old).
     *
     * **NB. Unlike Mongo, it is okay to map a cursor to `null`.**
     *
     * *This method mutates the cursor, and the cursor MUST be uninitialized when calling this method.*
     *
     * @param mapping - The mapping function to apply to all documents.
     *
     * @returns The cursor.
     */
    map<R>(mapping: (doc: T) => R): FindCursor<R, TRaw>;
    /**
     * Returns a new, uninitialized cursor with the same filter and options set on this cursor. No state is shared between
     * the two cursors; only the configuration.
     *
     * Like mongo, mapping functions are *not* cloned.
     *
     * @example
     * ```typescript
     * const cursor = collection.find({ name: 'John' });
     * ```
     *
     * @returns A behavioral clone of this cursor.
     */
    clone(): FindCursor<TRaw, TRaw>;
    /**
     * Pulls up to `max` documents from the buffer, or all documents if `max` is not provided.
     *
     * **Note that this actually consumes the buffer; it doesn't just peek at it.**
     *
     * @param max - The maximum number of documents to read from the buffer. If not provided, all documents will be read.
     *
     * @returns The documents read from the buffer.
     */
    readBufferedDocuments(max?: number): TRaw[];
    /**
     * Rewinds the cursor to its uninitialized state, clearing the buffer and any state. Any configuration set on the
     * cursor will remain, but iteration will start from the beginning, sending new queries to the server, even if the
     * resultant data was already fetched by this cursor.
     */
    rewind(): void;
    /**
     * Fetches the next document from the cursor. Returns `null` if there are no more documents to fetch.
     *
     * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return `null`.
     *
     * @returns The next document, or `null` if there are no more documents.
     */
    next(): Promise<T | null>;
    /**
     * Tests if there is a next document in the cursor.
     *
     * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return `false`.
     *
     * @returns Whether or not there is a next document.
     */
    hasNext(): Promise<boolean>;
    /**
     * Retrieves the vector used to perform the vector search, if applicable.
     *
     * - If `includeSortVector` is not `true`, this will unconditionally return `null`. No find request will be made.
     *
     * - If `sort: { $vector }` was used, `getSortVector()` will simply regurgitate that same `$vector`.
     *
     * - If `sort: { $vectorize }` was used, `getSortVector()` will return the `$vector` that was created from the text.
     *
     * - If vector search is not used, `getSortVector()` will simply return `null`. A find request will still be made.
     *
     * If `includeSortVector` is `true`, and this function is called before any other cursor operation (such as
     * `.next()` or `.toArray()`), it'll make an API request to fetch the sort vector, filling the cursor's buffer
     * in the process.
     *
     * If the cursor has already been executed before this function has been called, no additional API request
     * will be made to fetch the sort vector, as it has already been cached.
     *
     * But to reiterate, if `includeSortVector` is `false`, and this function is called, no API request is made, and
     * the cursor's buffer is not populated; it simply returns `null`.
     *
     * @returns The sort vector, or `null` if none was used (or if `includeSortVector !== true`).
     */
    getSortVector(): Promise<number[] | null>;
    /**
     * An async iterator that lazily iterates over all documents in the cursor.
     *
     * **Note that there'll only be partial results if the cursor has been previously iterated over. You may use {@link FindCursor.rewind}
     * to reset the cursor.**
     *
     * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return immediately.
     *
     * It will close the cursor when iteration is complete, even if it was broken early.
     *
     * @example
     * ```typescript
     * for await (const doc of cursor) {
     *   console.log(doc);
     * }
     * ```
     */
    [Symbol.asyncIterator](): AsyncGenerator<T, void, void>;
    /**
     * Iterates over all documents in the cursor, calling the provided consumer for each document.
     *
     * If the consumer returns `false`, iteration will stop.
     *
     * Note that there'll only be partial results if the cursor has been previously iterated over. You may use {@link FindCursor.rewind}
     * to reset the cursor.
     *
     * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return immediately.
     *
     * It will close the cursor when iteration is complete, even if it was stopped early.
     *
     * @param consumer - The consumer to call for each document.
     *
     * @returns A promise that resolves when iteration is complete.
     *
     * @deprecated - Prefer the `for await (const doc of cursor) { ... }` syntax instead.
     */
    forEach(consumer: ((doc: T) => boolean) | ((doc: T) => void)): Promise<void>;
    /**
     * Returns an array of all matching documents in the cursor. The user should ensure that there is enough memory to
     * store all documents in the cursor.
     *
     * Note that there'll only be partial results if the cursor has been previously iterated over. You may use {@link FindCursor.rewind}
     * to reset the cursor.
     *
     * If the cursor is uninitialized, it will be initialized. If the cursor is closed, this method will return an empty array.
     *
     * @returns An array of all documents in the cursor.
     */
    toArray(): Promise<T[]>;
    /**
     * Closes the cursor. The cursor will be unusable after this method is called, or until {@link FindCursor.rewind} is called.
     */
    close(): void;
    private _assertUninitialized;
    private _next;
    private _getMore;
}

/**
 * The overarching result containing the `embeddingProviders` map.
 *
 * @field embeddingProviders - Map of embedding provider names to info about said provider.
 *
 * @see DbAdmin.findEmbeddingProviders
 *
 * @public
 */
export declare interface FindEmbeddingProvidersResult {
    /**
     * A map of embedding provider names (e.g. `openai`), to information about said provider (e.g. models/auth).
     *
     * @example
     * ```typescript
     * {
     *   openai: {
     *     displayName: 'OpenAI',
     *     ...,
     *   }
     * }
     * ```
     */
    embeddingProviders: Record<string, EmbeddingProviderInfo>;
}

/**
 * Represents the options for the `findOneAndDelete` command.
 *
 * @field sort - The sort order to pick which document to delete if the filter selects multiple documents.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 * @field includeResultMetadata - When true, returns alongside the document, an `ok` field with a value of 1 if the command executed successfully.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.findOneAndDelete
 *
 * @public
 */
export declare interface FindOneAndDeleteOptions extends WithTimeout {
    /**
     * The order in which to apply the update if the filter selects multiple documents.
     *
     * If multiple documents match the filter, only one will be updated.
     *
     * Defaults to `null`, where the order is not guaranteed.
     * @defaultValue null
     */
    sort?: Sort;
    /**
     * Specifies which fields should be included/excluded in the returned documents.
     *
     * If not specified, all fields are included.
     *
     * When specifying a projection, it's the user's responsibility to handle the return type carefully, as the
     * projection will, of course, affect the shape of the returned documents. It may be a good idea to cast
     * the returned documents into a type that reflects the projection to avoid runtime errors.
     *
     * @example
     * ```typescript
     * interface User {
     *   name: string;
     *   age: number;
     * }
     *
     * const collection = db.collection<User>('users');
     *
     * const doc = await collection.findOne({}, {
     *   projection: {
     *     _id: 0,
     *     name: 1,
     *   },
     *   vector: [.12, .52, .32],
     *   includeSimilarity: true,
     * }) as { name: string, $similarity: number };
     *
     * // Ok
     * console.log(doc.name);
     * console.log(doc.$similarity);
     *
     * // Causes type error
     * console.log(doc._id);
     * console.log(doc.age);
     * ```
     */
    projection?: Projection;
    /**
     * When true, returns alongside the document, an `ok` field with a value of 1 if the command executed successfully.
     *
     * Otherwise, returns the document result directly.
     *
     * Defaults to false.
     * @defaultValue false
     */
    includeResultMetadata?: boolean;
    /**
     * An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection
     * to find the closest matching document.
     *
     * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field in the
     * sort field itself. The two are interchangeable, but mutually exclusive.
     *
     * If the sort field is already set, an error will be thrown. If you really need to use both, you can set the $vector
     * field in the sort object directly.
     *
     * @deprecated - Prefer to use `sort: { $vector: [...] }` instead
     */
    vector?: number[];
    /**
     * Akin to {@link FindOneAndDeleteOptions.vector}, but for `$vectorize`.
     *
     * @deprecated - Prefer to use `sort: { $vectorize: '...' }` instead
     */
    vectorize?: string;
}

/**
 * Represents the options for the `findOneAndReplace` command.
 *
 * @field returnDocument - Specifies whether to return the original or updated document.
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field sort - The sort order to pick which document to replace if the filter selects multiple documents.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 * @field includeResultMetadata - When true, returns alongside the document, an `ok` field with a value of 1 if the command executed successfully.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.findOneAndReplace
 *
 * @public
 */
export declare interface FindOneAndReplaceOptions extends WithTimeout {
    /**
     * Specifies whether to return the document before or after the update.
     *
     * Set to `before` to return the document before the update to see the original state of the document.
     *
     * Set to `after` to return the document after the update to see the updated state of the document immediately.
     *
     * Defaults to `'before'`.
     *
     * @defaultValue 'before'
     */
    returnDocument?: 'before' | 'after';
    /**
     * If true, perform an insert if no documents match the filter.
     *
     * If false, do not insert if no documents match the filter.
     *
     * Defaults to false.
     *
     * @defaultValue false
     */
    upsert?: boolean;
    /**
     * The order in which to apply the update if the filter selects multiple documents.
     *
     * If multiple documents match the filter, only one will be updated.
     *
     * Defaults to `null`, where the order is not guaranteed.
     *
     * @defaultValue null
     */
    sort?: Sort;
    /**
     * Specifies which fields should be included/excluded in the returned documents.
     *
     * If not specified, all fields are included.
     *
     * When specifying a projection, it's the user's responsibility to handle the return type carefully, as the
     * projection will, of course, affect the shape of the returned documents. It may be a good idea to cast
     * the returned documents into a type that reflects the projection to avoid runtime errors.
     *
     * @example
     * ```typescript
     * interface User {
     *   name: string;
     *   age: number;
     * }
     *
     * const collection = db.collection<User>('users');
     *
     * const doc = await collection.findOne({}, {
     *   projection: {
     *     _id: 0,
     *     name: 1,
     *   },
     *   vector: [.12, .52, .32],
     *   includeSimilarity: true,
     * }) as { name: string, $similarity: number };
     *
     * // Ok
     * console.log(doc.name);
     * console.log(doc.$similarity);
     *
     * // Causes type error
     * console.log(doc._id);
     * console.log(doc.age);
     * ```
     */
    projection?: Projection;
    /**
     * When true, returns alongside the document, an `ok` field with a value of 1 if the command executed successfully.
     *
     * Otherwise, returns the document result directly.
     *
     * Defaults to false.
     *
     * @defaultValue false
     */
    includeResultMetadata?: boolean;
    /**
     * An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection
     * to find the closest matching document.
     *
     * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field in the
     * sort field itself. The two are interchangeable, but mutually exclusive.
     *
     * If the sort field is already set, an error will be thrown. If you really need to use both, you can set the $vector
     * field in the sort object directly.
     *
     * @deprecated - Prefer to use `sort: { $vector: [...] }` instead
     */
    vector?: number[];
    /**
     * Akin to {@link FindOneAndReplaceOptions.vector}, but for `$vectorize`.
     *
     * @deprecated - Prefer to use `sort: { $vectorize: '...' }` instead
     */
    vectorize?: string;
}

/**
 * Represents the options for the `findOneAndUpdate` command.
 *
 * @field returnDocument - Specifies whether to return the original or updated document.
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field sort - The sort order to pick which document to replace if the filter selects multiple documents.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 * @field includeResultMetadata - When true, returns alongside the document, an `ok` field with a value of 1 if the command executed successfully.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.findOneAndUpdate
 *
 * @public
 */
export declare interface FindOneAndUpdateOptions extends WithTimeout {
    /**
     * Specifies whether to return the document before or after the update.
     *
     * Set to `before` to return the document before the update to see the original state of the document.
     *
     * Set to `after` to return the document after the update to see the updated state of the document immediately.
     *
     * Defaults to `'before'`.
     *
     * @defaultValue 'before'
     */
    returnDocument?: 'before' | 'after';
    /**
     * If true, perform an insert if no documents match the filter.
     *
     * If false, do not insert if no documents match the filter.
     *
     * Defaults to false.
     * @defaultValue false
     */
    upsert?: boolean;
    /**
     * The order in which to apply the update if the filter selects multiple documents.
     *
     * If multiple documents match the filter, only one will be updated.
     *
     * Defaults to `null`, where the order is not guaranteed.
     * @defaultValue null
     */
    sort?: Sort;
    /**
     * Specifies which fields should be included/excluded in the returned documents.
     *
     * If not specified, all fields are included.
     *
     * When specifying a projection, it's the user's responsibility to handle the return type carefully, as the
     * projection will, of course, affect the shape of the returned documents. It may be a good idea to cast
     * the returned documents into a type that reflects the projection to avoid runtime errors.
     *
     * @example
     * ```typescript
     * interface User {
     *   name: string;
     *   age: number;
     * }
     *
     * const collection = db.collection<User>('users');
     *
     * const doc = await collection.findOne({}, {
     *   projection: {
     *     _id: 0,
     *     name: 1,
     *   },
     *   vector: [.12, .52, .32],
     *   includeSimilarity: true,
     * }) as { name: string, $similarity: number };
     *
     * // Ok
     * console.log(doc.name);
     * console.log(doc.$similarity);
     *
     * // Causes type error
     * console.log(doc._id);
     * console.log(doc.age);
     * ```
     */
    projection?: Projection;
    /**
     * When true, returns alongside the document, an `ok` field with a value of 1 if the command executed successfully.
     *
     * Otherwise, returns the document result directly.
     *
     * Defaults to false.
     * @defaultValue false
     */
    includeResultMetadata?: boolean;
    /**
     * An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection
     * to find the closest matching document.
     *
     * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field in the
     * sort field itself. The two are interchangeable, but mutually exclusive.
     *
     * If the sort field is already set, an error will be thrown. If you really need to use both, you can set the $vector
     * field in the sort object directly.
     *
     * @deprecated - Prefer to use `sort: { $vector: [...] }` instead
     */
    vector?: number[];
    /**
     * Akin to {@link FindOneAndUpdateOptions.vector}, but for `$vectorize`.
     *
     * @deprecated - Prefer to use `sort: { $vectorize: '...' }` instead
     */
    vectorize?: string;
}

/**
 * Represents the options for the `findOne` command.
 *
 * @field sort - The sort order to pick which document to return if the filter selects multiple documents.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 * @field includeSimilarity - If true, include the similarity score in the result via the `$similarity` field.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @public
 */
export declare interface FindOneOptions extends WithTimeout {
    /**
     * The order in which to apply the update if the filter selects multiple documents.
     *
     * If multiple documents match the filter, only one will be updated.
     *
     * Defaults to `null`, where the order is not guaranteed.
     * @defaultValue null
     */
    sort?: Sort;
    /**
     * Specifies which fields should be included/excluded in the returned documents.
     *
     * If not specified, all fields are included.
     *
     * When specifying a projection, it's the user's responsibility to handle the return type carefully, as the
     * projection will, of course, affect the shape of the returned documents. It may be a good idea to cast
     * the returned documents into a type that reflects the projection to avoid runtime errors.
     *
     * @example
     * ```typescript
     * interface User {
     *   name: string;
     *   age: number;
     * }
     *
     * const collection = db.collection<User>('users');
     *
     * const doc = await collection.findOne({}, {
     *   projection: {
     *     _id: 0,
     *     name: 1,
     *   },
     *   vector: [.12, .52, .32],
     *   includeSimilarity: true,
     * }) as { name: string, $similarity: number };
     *
     * // Ok
     * console.log(doc.name);
     * console.log(doc.$similarity);
     *
     * // Causes type error
     * console.log(doc._id);
     * console.log(doc.age);
     * ```
     */
    projection?: Projection;
    /**
     * If true, include the similarity score in the result via the `$similarity` field.
     *
     * If false, do not include the similarity score in the result.
     *
     * Defaults to false.
     * @defaultValue false
     *
     * @example
     * ```typescript
     * const doc = await collection.findOne({}, {
     *   sort: {
     *     $vector: [.12, .52, .32],
     *   },
     *   includeSimilarity: true,
     * });
     *
     * console.log(doc?.$similarity);
     * ```
     */
    includeSimilarity?: boolean;
    /**
     * An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection
     * to find the closest matching document.
     *
     * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field in the
     * sort field itself. The two are interchangeable, but mutually exclusive.
     *
     * If the sort field is already set, an error will be thrown. If you really need to use both, you can set the $vector
     * field in the sort object directly.
     *
     * @deprecated - Prefer to use `sort: { $vector: [...] }` instead
     */
    vector?: number[];
    /**
     * Akin to {@link FindOneOptions.vector}, but for `$vectorize`.
     *
     * @deprecated - Prefer to use `sort: { $vectorize: '...' }` instead
     */
    vectorize?: string;
}

/**
 * Options for the `find` method.
 *
 * @field sort - The sort order to pick which document to return if the filter selects multiple documents.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 * @field limit - Max number of documents to return in the lifetime of the cursor.
 * @field skip - Number of documents to skip if using a sort.
 * @field includeSimilarity - If true, include the similarity score in the result via the `$similarity` field.
 *
 * @see Collection.find
 *
 * @public
 */
export declare interface FindOptions {
    /**
     * The order in which to apply the update if the filter selects multiple documents.
     *
     * If multiple documents match the filter, only one will be updated.
     *
     * Defaults to `null`, where the order is not guaranteed.
     *
     * @defaultValue null
     */
    sort?: Sort;
    /**
     * Specifies which fields should be included/excluded in the returned documents.
     *
     * If not specified, all fields are included.
     *
     * When specifying a projection, it's the user's responsibility to handle the return type carefully, as the
     * projection will, of course, affect the shape of the returned documents. It may be a good idea to cast
     * the returned documents into a type that reflects the projection to avoid runtime errors.
     *
     * @example
     * ```typescript
     * interface User {
     *   name: string;
     *   age: number;
     * }
     *
     * const collection = db.collection<User>('users');
     *
     * const doc = await collection.findOne({}, {
     *   projection: {
     *     _id: 0,
     *     name: 1,
     *   },
     *   vector: [.12, .52, .32],
     *   includeSimilarity: true,
     * }) as { name: string, $similarity: number };
     *
     * // Ok
     * console.log(doc.name);
     * console.log(doc.$similarity);
     *
     * // Causes type error
     * console.log(doc._id);
     * console.log(doc.age);
     * ```
     */
    projection?: Projection;
    /**
     * Max number of documents to return. Applies over the whole result set, not per page. I.e. if the
     * result set has 1000 documents and `limit` is 100, only the first 100 documents will be returned,
     * but it'll still be fetched in pages of some N documents, regardless of if N \< or \> 100.
     */
    limit?: number;
    /**
     * Number of documents to skip. **Only works if a sort is provided.**
     */
    skip?: number;
    /**
     * If true, include the similarity score in the result via the `$similarity` field.
     *
     * If false, do not include the similarity score in the result.
     *
     * Defaults to false.
     *
     * @defaultValue false
     *
     * @example
     * ```typescript
     * const doc = await collection.findOne({}, {
     *   sort: {
     *     $vector: [.12, .52, .32],
     *   },
     *   includeSimilarity: true,
     * });
     *
     * console.log(doc?.$similarity);
     * ```
     */
    includeSimilarity?: boolean;
    /**
     * If true, fetch the sort vector on the very first API call.
     *
     * If false, it won't fetch the sort vector until {@link FindCursor.getSortVector} is called.
     *
     * Note that this is *not* a requirement to use {@link FindCursor.getSortVector}—it simply saves it an extra API call
     * to fetch the sort vector.
     *
     * Set this to true if you're sure you're going to need the sort vector in the very near future.
     *
     * @example
     * ```typescript
     * const doc = await collection.findOne({}, {
     *   sort: {
     *     $vector: [.12, .52, .32],
     *   },
     *   includeSortVector: true,
     * });
     *
     * // sortVector is fetched during this call
     * const next = await cursor.next();
     *
     * // so no I/O is done here as the cursor already has the sortVector cached
     * const sortVector = await cursor.getSortVector();
     * ```
     */
    includeSortVector?: boolean;
    /**
     * An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection
     * to find the closest matching document.
     *
     * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field in the
     * sort field itself. The two are interchangeable, but mutually exclusive.
     *
     * If the sort field is already set, an error will be thrown. If you really need to use both, you can set the $vector
     * field in the sort object directly.
     *
     * @deprecated - Prefer to use `sort: { $vector: [...] }` instead
     */
    vector?: number[];
    /**
     * Akin to {@link FindOptions.vector}, but for `$vectorize`.
     *
     * @deprecated - Prefer to use `sort: { $vectorize: '...' }` instead
     */
    vectorize?: string;
}

/**
 * Represents a flattened version of the given type. Only goes one level deep.
 *
 * @public
 */
export declare type Flatten<Type> = Type extends (infer Item)[] ? Item : Type;

/**
 * Shorthand type for `WithSim` & `WithId`
 *
 * @public
 */
export declare type FoundDoc<Doc> = WithId<Omit<Doc, '$similarity'> & {
    $similarity?: number;
}>;

/**
 * Information about a collection, used when `nameOnly` is false in {@link ListCollectionsOptions}.
 *
 * @field name - The name of the collection.
 * @field options - The creation options for the collection.
 *
 * @see ListCollectionsOptions
 * @see Db.listCollections
 *
 * @public
 */
export declare interface FullCollectionInfo {
    /**
     * The name of the collection.
     */
    name: string;
    /**
     * The creation options for the collection (i.e. the `vector`, `indexing`, and `defaultId` fields).
     */
    options: CollectionOptions<SomeDoc>;
}

/**
 * Represents the complete information about a database.
 *
 * @public
 */
export declare interface FullDatabaseInfo {
    /**
     * The id of the database
     */
    id: string;
    /**
     * The id of the organization that owns the database
     */
    orgId: string;
    /**
     * The id of the owner of the database
     */
    ownerId: string;
    /**
     * The user-provided information describing a database
     */
    info: DatabaseInfo;
    /**
     * Creation time, in ISO RFC3339 format
     */
    creationTime?: string;
    /**
     * The last time the database was used, in ISO RFC3339 format
     */
    lastUsageTime?: string;
    /**
     * The termination time, in ISO RFC3339 format, if the database was terminated
     */
    terminationTime?: string;
    /**
     * The current status of the database.
     */
    status: DatabaseStatus;
    /**
     * The observed status of the database.
     */
    observedStatus: DatabaseStatus;
    /**
     * Contains the information about how much storage space a cluster has available
     */
    storage?: DatabaseStorageInfo;
    /**
     * The available actions that can be performed on the database
     */
    availableActions?: DatabaseAction[];
    /**
     * The cost information for the database
     */
    cost?: CostInfo;
    /**
     * Message to the user about the cluster
     */
    message?: string;
    /**
     * Grafana URL for the database
     */
    grafanaUrl?: string;
    /**
     * CQLSH URL for the database
     */
    cqlshUrl?: string;
    /**
     * GraphQL URL for the database
     */
    graphqlUrl?: string;
    /**
     * REST URL for the database
     */
    dataEndpointUrl?: string;
    /**
     * Basic metrics information about the database
     */
    metrics?: DbMetricsInfo;
}

/**
 * Represents the set of fields that are guaranteed to be present in the result of an update operation.
 *
 * @field matchedCount - The number of documents that matched the filter.
 * @field modifiedCount - The number of documents that were actually modified.
 *
 * @public
 */
export declare interface GuaranteedUpdateOptions<N extends number> {
    /**
     * The number of documents that matched the filter.
     */
    matchedCount: N;
    /**
     * The number of documents that were actually modified.
     */
    modifiedCount: N;
}

/* Excluded from this release type: HeaderProvider */

/**
 * The options available for the {@link DataAPIClient} related to making HTTP/1.1 requests.
 *
 * @public
 */
export declare interface Http1Options {
    /**
     * Whether to keep the connection alive for future requests. This is generally recommended for better performance.
     *
     * Defaults to true.
     *
     * @defaultValue true
     */
    keepAlive?: boolean;
    /**
     * The delay (in milliseconds) before keep-alive probing.
     *
     * Defaults to 1000ms.
     *
     * @defaultValue 1000
     */
    keepAliveMS?: number;
    /**
     * Maximum number of sockets to allow per origin.
     *
     * Defaults to 256.
     *
     * @defaultValue 256
     */
    maxSockets?: number;
    /**
     * Maximum number of lingering sockets, waiting to be re-used for new requests.
     *
     * Defaults to Infinity.
     *
     * @defaultValue Infinity
     */
    maxFreeSockets?: number;
}

/* Excluded from this release type: HttpClient */

/* Excluded from this release type: HTTPClientOptions */

/* Excluded from this release type: HttpMethods */

/* Excluded from this release type: HttpMethodStrings */

/* Excluded from this release type: HTTPRequestInfo */

/**
 * Extracts the `_id` type from a given schema, or defaults to `SomeId` if uninferable
 *
 * @public
 */
export declare type IdOf<TSchema> = TSchema extends {
    _id: infer Id;
} ? Id : TSchema extends {
    _id?: infer Id;
} ? unknown extends Id ? SomeId : Id : SomeId;

/**
 * Represents the options for the indexing.
 *
 * **Only one of `allow` or `deny` can be specified.**
 *
 * See [indexing](https://docs.datastax.com/en/astra/astra-db-vector/api-reference/data-api-commands.html#advanced-feature-indexing-clause-on-createcollection) for more details.
 *
 * @example
 * ```typescript
 * const collection1 = await db.createCollection('my-collection', {
 *   indexing: {
 *     allow: ['name', 'age'],
 *   },
 * });
 *
 * const collection2 = await db.createCollection('my-collection', {
 *   indexing: {
 *     deny: ['*'],
 *   },
 * });
 * ```
 *
 * @field allow - The fields to index.
 * @field deny - The fields to not index.
 *
 * @public
 */
export declare type IndexingOptions<Schema extends SomeDoc> = {
    allow: (keyof ToDotNotation<Schema>)[] | ['*'];
    deny?: never;
} | {
    deny: (keyof ToDotNotation<Schema>)[] | ['*'];
    allow?: never;
};

/**
 * Represents an error that occurred during an `insertMany` operation (which is, generally, paginated).
 *
 * Contains the inserted IDs of the documents that were successfully inserted, as well as the cumulative errors
 * that occurred during the operation.
 *
 * If the operation was ordered, the `insertedIds` will be in the same order as the documents that were attempted to
 * be inserted.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 * @field partialResult - The partial result of the `InsertMany` operation that was performed
 *
 * @public
 */
export declare class InsertManyError extends CumulativeDataAPIError {
    /**
     * The name of the error. This is always 'InsertManyError'.
     */
    name: string;
    /**
     * The partial result of the `InsertMany` operation that was performed. This is *always* defined, and is the result
     * of all successful insertions.
     */
    readonly partialResult: InsertManyResult<SomeDoc>;
}

/**
 * Options for insertMany.
 *
 * The parameters depend on the `ordered` option. If `ordered` is `true`, the `parallel` option is not allowed.
 *
 * @field ordered - If `true`, the docs are inserted sequentially; else, they're arbitrary inserted in parallel.
 * @field concurrency - The maximum number of concurrent requests to make at once.
 * @field chunkSize - The number of documents to upload per request. Defaults to 20.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.insertMany
 *
 * @public
 */
export declare type InsertManyOptions = InsertManyUnorderedOptions | InsertManyOrderedOptions;

/**
 * Options for insertMany when `ordered` is `true`.
 *
 * @field ordered - If `true`, the documents are inserted sequentially in the order provided.
 * @field chunkSize - The number of documents to upload per request. Defaults to 20.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.insertMany
 *
 * @public
 */
export declare interface InsertManyOrderedOptions extends WithTimeout {
    /**
     * If `true`, the documents are inserted in the order provided. If an error occurs, the operation stops and the
     * remaining documents are not inserted.
     */
    ordered: true;
    /**
     * The number of documents to upload per request. Defaults to 20.
     *
     * If you have large documents, you may find it beneficial to reduce this number and increase concurrency to
     * improve throughput. Leave it unspecified (recommended) to use the system default.
     *
     * @defaultValue 20
     */
    chunkSize?: number;
    /**
     * A list of optional vectors to use for the documents, if using a vector-enabled collection.
     *
     * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field on the
     * documents themselves. The two are interchangeable, but mutually exclusive.
     *
     * The list may contain `null` or `undefined` values, which mark the corresponding document as not having a vector
     * (or the doc having its `$vector` field already set).
     *
     * **NB. Setting this field will cause a shallow copy of the documents to be made for non-null vectors.** If
     * performance is a concern, it is recommended to directly set the `$vector` field on the document itself.
     *
     * If any document already has a `$vector` field, and this is set, the `$vector` field will be overwritten. It is
     * up to the user to ensure that both fields are not set at once.
     *
     * @deprecated - Prefer to set the `$vector` fields in the docs directly
     */
    vectors?: (number[] | null | undefined)[];
    /**
     Akin to {@link InsertManyOrderedOptions.vectors}, but for `$vectorize`.
     *
     * @deprecated - Prefer to set the `$vectorize` fields in the docs directly
     */
    vectorize?: (string | null | undefined)[];
}

/**
 * Represents the result of an insertMany command.
 *
 * @field insertedIds - The IDs of the inserted documents.
 * @field insertedCount - The number of inserted documents.
 *
 * @see Collection.insertMany
 *
 * @public
 */
export declare interface InsertManyResult<Schema extends SomeDoc> {
    /**
     * The IDs of the inserted documents (including the autogenerated IDs).
     *
     * Note that it is up to the user that the IDs cover all possible types of IDs that the collection may have,
     * keeping in mind the type of the auto-generated IDs, as well as any the user may provide.
     */
    insertedIds: IdOf<Schema>[];
    /**
     * The number of inserted documents (equals `insertedIds.length`).
     */
    insertedCount: number;
}

/**
 * Options for insertMany when `ordered` is `false`.
 *
 * @field ordered - If `false` or unset, the documents are inserted in an arbitrary, parallelized order.
 * @field concurrency - The maximum number of concurrent requests to make at once.
 * @field chunkSize - The number of documents to upload per request. Defaults to 20.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.insertMany
 *
 * @public
 */
export declare interface InsertManyUnorderedOptions extends WithTimeout {
    /**
     * If `false`, the documents are inserted in an arbitrary order. If an error occurs, the operation does not stop
     * and the remaining documents are inserted. This allows the operation to be parallelized for better performance.
     */
    ordered?: false;
    /**
     * The maximum number of concurrent requests to make at once.
     */
    concurrency?: number;
    /**
     * The number of documents to upload per request. Defaults to 20.
     *
     * If you have large documents, you may find it beneficial to reduce this number and increase concurrency to
     * improve throughput. Leave it unspecified (recommended) to use the system default.
     *
     * @defaultValue 20
     */
    chunkSize?: number;
    /**
     * A list of optional vectors to use for the documents, if using a vector-enabled collection.
     *
     * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field on the
     * documents themselves. The two are interchangeable, but mutually exclusive.
     *
     * The list may contain `null` or `undefined` values, which mark the corresponding document as not having a vector
     * (or the doc having its `$vector` field already set).
     *
     * **NB. Setting this field will cause a shallow copy of the documents to be made for non-null vectors.** If
     * performance is a concern, it is recommended to directly set the `$vector` field on the document itself.
     *
     * If any document already has a `$vector` field, and this is set, the `$vector` field will be overwritten. It is
     * up to the user to ensure that both fields are not set at once.
     *
     * @deprecated - Prefer to set the `$vector` fields in the docs directly
     */
    vectors?: (number[] | null | undefined)[];
    /**
     * Akin to {@link InsertManyUnorderedOptions.vectors}, but for `$vectorize`.
     *
     * @deprecated - Prefer to set the `$vectorize` fields in the docs directly
     */
    vectorize?: (string | null | undefined)[];
}

/**
 * Represents an insertOne operation that can be used in a bulk write operation.
 *
 * @field document - The document to insert.
 *
 * @public
 */
export declare interface InsertOneModel<TSchema extends SomeDoc> {
    /**
     * The document to insert.
     */
    document: TSchema;
}

/**
 * Options for the insertOne command.
 *
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.insertOne
 *
 * @public
 */
export declare interface InsertOneOptions extends WithTimeout {
    /**
     * An optional vector to use for the document, if using a vector-enabled collection.
     *
     * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field on the
     * document itself. The two are interchangeable, but mutually exclusive.
     *
     * **NB. Setting this field will cause a shallow copy of the document to be made.** If performance is a concern, it
     * is recommended to directly set the `$vector` field on the document itself.
     *
     * If the document already has a `$vector` field, and this is set, the `$vector` field will be overwritten. It is
     * up to the user to ensure that both fields are not set at once.
     *
     * @deprecated - Prefer to set the `$vector` field in the doc directly
     */
    vector?: number[];
    /**
     Akin to {@link InsertOneOptions.vector}, but for `$vectorize`.
     *
     * @deprecated - Prefer to set the `$vectorize` field in the doc directly
     */
    vectorize?: string;
}

/**
 * Represents the result of an insertOne command.
 *
 * @field insertedId - The ID of the inserted document.
 *
 * @see Collection.insertOne
 *
 * @public
 */
export declare interface InsertOneResult<Schema> {
    /**
     * The ID of the inserted document (this will be an autogenerated ID if one was not provided).
     *
     * Note that it is up to the user that the ID covers all possible types of IDs that the collection may have,
     * keeping in mind the type of the auto-generated IDs, as well as any the user may provide.
     */
    insertedId: IdOf<Schema>;
}

/* Excluded from this release type: InternalRootClientOpts */

/**
 * Represents the result of an update operation.
 *
 * @example
 * ```typescript
 * const result = await collection.updateOne({
 *   _id: 'abc'
 * }, {
 *   $set: { name: 'John' }
 * }, {
 *   upsert: true
 * });
 *
 * if (result.upsertedCount) {
 *   console.log(`Document with ID ${result.upsertedId} was upserted`);
 * }
 * ```
 *
 * @field matchedCount - The number of documents that matched the filter.
 * @field modifiedCount - The number of documents that were actually modified.
 * @field upsertedCount - The number of documents that were upserted.
 * @field upsertedId - The identifier of the upserted document if `upsertedCount > 0`.
 *
 * @public
 */
export declare type InternalUpdateResult<Schema extends SomeDoc, N extends number> = (GuaranteedUpdateOptions<N> & UpsertedUpdateOptions<Schema>) | (GuaranteedUpdateOptions<N> & NoUpsertUpdateOptions);

/**
 * Checks if a type is any
 *
 * @public
 */
declare type IsAny<T> = true extends false & T ? true : false;

/**
 * Checks if a type can possibly be a date
 *
 * @example
 * ```typescript
 * IsDate<string | Date> === boolean
 * ```
 *
 * @public
 */
declare type IsDate<T> = IsAny<T> extends true ? true : T extends Date | {
    $date: number;
} ? true : false;

/**
 * Checks if a type can possibly be some number
 *
 * @example
 * ```typescript
 * IsNum<string | number> === true
 * ```
 *
 * @public
 */
declare type IsNum<T> = number extends T ? true : bigint extends T ? true : false;

/* Excluded from this release type: KeyspaceRef */

/**
 * Represents the replication options for a keyspace.
 *
 * Two replication strategies are available:
 *
 * - SimpleStrategy: Use only for a single datacenter and one rack. If you ever intend more than one datacenter, use the `NetworkTopologyStrategy`.
 *
 * - NetworkTopologyStrategy: Highly recommended for most deployments because it is much easier to expand to multiple datacenters when required by future expansion.
 *
 * If no replication options are provided, it will default to `'SimpleStrategy'` with a replication factor of `1`.
 *
 * @example
 * ```typescript
 * await dbAdmin.createKeyspace('my_keyspace');
 *
 * await dbAdmin.createKeyspace('my_keyspace', {
 *   replication: {
 *     class: 'SimpleStrategy',
 *     replicatonFactor: 3,
 *   },
 * });
 *
 * await dbAdmin.createKeyspace('my_keyspace', {
 *   replication: {
 *     class: 'NetworkTopologyStrategy',
 *     datacenter1: 3,
 *     datacenter1: 2,
 *   },
 * });
 * ```
 *
 * See the [datastax docs](https://docs.datastax.com/en/cassandra-oss/3.0/cassandra/architecture/archDataDistributeReplication.html) for more info.
 *
 * @public
 */
export declare type KeyspaceReplicationOptions = {
    class: 'SimpleStrategy';
    replicationFactor: number;
} | {
    class: 'NetworkTopologyStrategy';
    [datacenter: string]: number | 'NetworkTopologyStrategy';
};

/**
 * Options for listing collections.
 *
 * @field nameOnly - If true, only the name of the collection is returned. If false, the full collection info is returned. Defaults to true.
 * @field keyspace - Overrides the keyspace to list collections from. If not provided, the default keyspace is used.
 * @field maxTimeMS - The maximum amount of time to allow the operation to run.
 *
 * @see Db.listCollections
 *
 * @public
 */
export declare interface ListCollectionsOptions extends WithTimeout, WithKeyspace {
    /**
     * If true, only the name of the collection is returned.
     *
     * If false, the full collection info is returned.
     *
     * Defaults to true.
     *
     * @example
     * ```typescript
     * const names = await db.listCollections({ nameOnly: true });
     * console.log(names); // [{ name: 'my-coll' }]
     *
     * const info = await db.listCollections({ nameOnly: false });
     * console.log(info); // [{ name: 'my-coll', options: { ... } }]
     * ```
     *
     * @defaultValue true
     */
    nameOnly?: boolean;
}

/**
 * Represents the options for listing databases.
 *
 * @field include - Allows filtering so that databases in listed states are returned.
 * @field provider - Allows filtering so that databases from a given provider are returned.
 * @field limit - Specify the number of items for one page of data.
 * @field skip - Starting value for retrieving a specific page of results.
 *
 * @public
 */
export declare interface ListDatabasesOptions extends WithTimeout {
    /**
     * Allows filtering so that databases in listed states are returned.
     */
    include?: DatabaseStatusFilter;
    /**
     * Allows filtering so that databases from a given provider are returned.
     */
    provider?: DatabaseCloudProviderFilter;
    /**
     * Optional parameter for pagination purposes. Specify the number of items for one page of data.
     *
     * Should be between 1 and 100.
     *
     * Defaults to 25.
     *
     * @defaultValue 25
     */
    limit?: number;
    /**
     * Optional parameter for pagination purposes. Used as this value for starting retrieving a specific page of results.
     */
    skip?: number;
}

/**
 * Represents the options for creating a keyspace on a non-Astra database (i.e. blocking options + keyspace creation options).
 *
 * If no replication options are provided, it will default to `'SimpleStrategy'` with a replication factor of `1`.
 *
 * See {@link AdminBlockingOptions} for more options about blocking behavior.
 *
 * If `updateDbKeyspace` is set to true, the underlying `Db` instance used to create the `DbAdmin` will have its
 * current working keyspace set to the newly created keyspace immediately (even if the keyspace isn't technically
 * yet created).
 *
 * @example
 * ```typescript
 * // If using non-astra, this may be a common idiom:
 * const client = new DataAPIClient({ environment: 'dse' });
 * const db = client.db('<endpoint>', { token: '<token>' });
 *
 * // Will internally call `db.useKeyspace('new_keyspace')`
 * await db.admin().createKeyspace('new_keyspace', {
 *   updateDbKeyspace: true,
 * });
 *
 * // Creates collection in keyspace `new_keyspace` by default now
 * const coll = db.createCollection('my_coll');
 * ```
 *
 * @public
 */
export declare type LocalCreateKeyspaceOptions = CreateKeyspaceOptions & {
    replication?: KeyspaceReplicationOptions;
};

/**
 * Represents the options for creating a keyspace on a non-Astra database (i.e. blocking options + keyspace creation options).
 *
 * This is now a deprecated alias for the strictly equivalent {@link LocalCreateKeyspaceOptions}, and will be removed
 * in an upcoming major version.
 *
 * @deprecated - Prefer {@link LocalCreateKeyspaceOptions} instead.
 *
 * @public
 */
export declare type LocalCreateNamespaceOptions = CreateNamespaceOptions & {
    replication?: KeyspaceReplicationOptions;
};

/**
 * Allows the given type to include an `_id` or not, even if it's not declared in the type
 *
 * @public
 */
export declare type MaybeId<T> = NoId<T> & {
    _id?: IdOf<T>;
};

declare type Merge<Ts> = Expand<UnionToIntersection<Ts>>;

/* Excluded from this release type: MkTimeoutError */

/**
 * Represents the result of a `findOneAnd*` operation (e.g. `findOneAndUpdate`)
 *
 * @field value - The document that was found and modified.
 *
 * @public
 */
export declare interface ModifyResult<Schema extends SomeDoc> {
    /**
     * The document that was found and modified, or `null` if nothing matched.
     */
    value: WithId<Schema> | null;
    /**
     * If the operation was ok.
     */
    ok: number;
}

/**
 * The options representing the blocking behavior of many admin operations.
 *
 * @field blocking - False to not block until the operation is complete.
 *
 * @see AdminBlockingOptions
 *
 * @public
 */
export declare interface NoBlockingOptions extends WithTimeout {
    /**
     * False to not block until the operation is complete.
     */
    blocking: false;
}

/**
 * Represents a doc that doesn't have an `_id`
 *
 * @public
 */
export declare type NoId<Doc> = Omit<Doc, '_id'>;

/**
 * Represents the set of fields that are present in the result of an update operation where no upsert occurred.
 *
 * @field upsertedCount - The number of documents that were upserted.
 * @field upsertedId - This field is never present.
 *
 * @public
 */
export declare interface NoUpsertUpdateOptions {
    /**
     * The number of documents that were upserted. This will always be undefined, since none occurred.
     */
    upsertedCount: 0;
    /**
     * This field is never present.
     */
    upsertedId?: never;
}

/**
 * Shorthand type to represent some nullish value. Generally meant for internal use.
 *
 * @public
 */
export declare type nullish = null | undefined;

/**
 * Weaker version of StrictNumberUpdate which allows for more flexibility in typing number update operations.
 *
 * @public
 */
export declare type NumberUpdate<Schema> = {
    [K in keyof Schema as IsNum<Schema[K]> extends true ? K : never]?: number | bigint;
};

/**
 * Represents filter operations exclusive to number (or dynamically typed) fields
 *
 * @public
 */
export declare interface NumFilterOps {
    /**
     * Less than (exclusive) some number
     */
    $lt?: number | bigint;
    /**
     * Less than or equal to some number
     */
    $lte?: number | bigint;
    /**
     * Greater than (exclusive) some number
     */
    $gt?: number | bigint;
    /**
     * Greater than or equal to some number
     */
    $gte?: number | bigint;
}

/**
 * Represents an ObjectId that can be used as an _id in the DataAPI.
 *
 * Provides methods for generating ObjectIds and getting the timestamp of an ObjectId.
 *
 * @example
 * ```typescript
 * const collection = await db.createCollection('myCollection'. {
 *   defaultId: {
 *     type: 'objectId',
 *   },
 * });
 *
 * await collection.insertOne({ album: 'Inhuman Rampage' });
 *
 * const doc = await collection.findOne({ album: 'Inhuman Rampage' });
 *
 * // Prints the ObjectId of the document
 * console.log(doc._id.toString());
 *
 * // Prints the timestamp when the document was created (server time)
 * console.log(doc._id.getTimestamp());
 * ```
 *
 * @example
 * ```typescript
 * await collection.insertOne({ _id: new ObjectId(), album: 'Sacrificium' });
 *
 * const doc = await collection.findOne({ album: 'Sacrificium' });
 *
 * // Prints the ObjectId of the document
 * console.log(doc._id.toString());
 *
 * // Prints the timestamp when the document was created (server time)
 * console.log(doc._id.getTimestamp());
 * ```
 *
 * @public
 */
export declare class ObjectId {
    private readonly _raw;
    /**
     * Creates a new ObjectId instance.
     *
     * If `id` is provided, it must be a 24-character hex string. Otherwise, a new ObjectId is generated.
     *
     * @param id - The ObjectId string.
     * @param validate - Whether to validate the ObjectId string. Defaults to `true`.
     */
    constructor(id?: string | number | null, validate?: boolean);
    /**
     * Compares this ObjectId to another ObjectId.
     *
     * **The other ObjectId can be an ObjectId instance or a string.**
     *
     * An ObjectId is considered equal to another ObjectId if their string representations are equal.
     *
     * @param other - The ObjectId to compare to.
     *
     * @returns `true` if the ObjectIds are equal, `false` otherwise.
     */
    equals(other: unknown): boolean;
    /**
     * Returns the timestamp of the ObjectId.
     *
     * @returns The timestamp of the ObjectId.
     */
    getTimestamp(): Date;
    /**
     * Returns the string representation of the ObjectId.
     */
    toString(): string;
    /**
     * Inspects the ObjectId.
     */
    inspect(): string;
    /**
     * Converts the ObjectId to a JSON representation.
     *
     * Serializes to `{ $objectId: 'objectId' }`.
     */
    toJSON(): {
        $objectId: string;
    };
}

declare type PickArrayTypes<Schema> = Extract<Schema, any[]> extends (infer E)[] ? E : unknown;

/**
 * The options representing the blocking behavior of many admin operations.
 *
 * @field blocking - True or omitted to block until the operation is complete.
 * @field pollInterval - The interval (in MS) at which to poll the operation for completion.
 *
 * @see AdminBlockingOptions
 *
 * @public
 */
export declare interface PollBlockingOptions extends WithTimeout {
    /**
     * True or omitted to block until the operation is complete.
     */
    blocking?: true;
    /**
     * The interval (in MS) at which to poll the operation for completion.
     *
     * The default is determined on a method-by-method basis.
     */
    pollInterval?: number;
}

/**
 * Weaker version os StrictPop which allows for more flexibility in typing pop operations.
 *
 * @public
 */
export declare type Pop<Schema> = {
    [K in keyof ArrayUpdate<Schema>]?: number;
};

/**
 * Specifies which fields should be included/excluded in the returned documents.
 *
 * **If you want stricter type-checking and full auto-complete, see {@link StrictProjection}.**
 *
 * Can use `1`/`0`, or `true`/`false`.
 *
 * There's a special field `'*'` that can be used to include/exclude all fields.
 *
 * @example
 * ```typescript
 * // Include _id, name, and address.state
 * const projection1: Projection = {
 *   _id: 0,
 *   name: 1,
 *   'address.state': 1,
 * }
 *
 * // Exclude the $vector
 * const projection2: Projection = {
 *   $vector: 0,
 * }
 *
 * // Return array indices 2, 3, 4, and 5
 * const projection3: Projection = {
 *   test_scores: { $slice: [2, 4] },
 * }
 * ```
 *
 * @see StrictProjection
 *
 * @public
 */
export declare type Projection = Record<string, 1 | 0 | true | false | ProjectionSlice>;

/**
 * Specifies the number of elements in an array to return in the query result.
 *
 * Has one of the following forms:
 * ```
 * // Return the first two elements
 * { $slice: 2 }
 *
 * // Return the last two elements
 * { $slice: -2 }
 *
 * // Skip 4 elements (from 0th index), return the next 2
 * { $slice: [4, 2] }
 *
 * // Skip backward 4 elements, return next 2 elements (forward)
 * { $slice: [-4, 2] }
 * ```
 *
 * @example
 * ```typescript
 * await collection.insertOne({ arr: [1, 2, 3, 4, 5] });
 *
 * // Return [1, 2]
 * await collection.findOne({}, {
 *   projection: {
 *     arr: { $slice: 2 },
 *   },
 * });
 *
 * // Return [3, 4]
 * await collection.findOne({}, {
 *   projection: {
 *     arr: { $slice: [-3, 2] },
 *   },
 * });
 * ```
 *
 * @public
 */
export declare interface ProjectionSlice {
    /**
     * Either of the following:
     * - A positive integer to return the first N elements
     * - A negative integer to return the last N elements
     * - A tuple of two integers to skip the first N elements and return the next M elements
     */
    $slice: number | [number, number];
}

/**
 * Weaker version of StrictPush which allows for more flexibility in typing push operations.
 *
 * @public
 */
export declare type Push<Schema> = {
    [K in keyof ArrayUpdate<Schema>]?: (ArrayUpdate<Schema>[K] | {
        $each: ArrayUpdate<Schema>[K][];
        $position?: number;
    });
};

/**
 * The response format of a 2XX-status Data API call
 *
 * @public
 */
export declare interface RawDataAPIResponse {
    /**
     * A response data holding documents that were returned as the result of a command.
     */
    status?: Record<string, any>;
    /**
     * Status objects, generally describe the side effects of commands, such as the number of updated or inserted documents.
     */
    errors?: any[];
    /**
     * Array of objects or null (Error)
     */
    data?: Record<string, any>;
}

/* Excluded from this release type: Ref */

/**
 * Represents a replaceOne operation that can be used in a bulk write operation.
 *
 * @field filter - The filter to choose the document to replace.
 * @field replacement - The replacement document, which contains no `_id` field.
 * @field upsert - If true, perform an insert if no documents match the filter.
 *
 * @public
 */
export declare interface ReplaceOneModel<TSchema extends SomeDoc> {
    /**
     * The filter to choose the document to replace.
     */
    filter: Filter<TSchema>;
    /**
     * The replacement document, which contains no `_id` field.
     */
    replacement: NoId<TSchema>;
    /**
     * If true, perform an insert if no documents match the filter.
     *
     * If false, do not insert if no documents match the filter.
     *
     * Defaults to false.
     *
     * @defaultValue false
     */
    upsert?: boolean;
}

/**
 * Represents the options for the `replaceOne` command.
 *
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field sort - The sort order to pick which document to replace if the filter selects multiple documents.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.replaceOne
 *
 * @public
 */
export declare interface ReplaceOneOptions extends WithTimeout {
    /**
     * If true, perform an insert if no documents match the filter.
     *
     * If false, do not insert if no documents match the filter.
     *
     * Defaults to false.
     *
     * @defaultValue false
     */
    upsert?: boolean;
    /**
     * The order in which to apply the update if the filter selects multiple documents.
     *
     * If multiple documents match the filter, only one will be updated.
     *
     * Defaults to `null`, where the order is not guaranteed.
     *
     * @defaultValue null
     */
    sort?: Sort;
    /**
     * An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection
     * to find the closest matching document.
     *
     * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field in the
     * sort field itself. The two are interchangeable, but mutually exclusive.
     *
     * If the sort field is already set, an error will be thrown. If you really need to use both, you can set the $vector
     * field in the sort object directly.
     *
     * @deprecated - Prefer to use `sort: { $vector: [...] }` instead
     */
    vector?: number[];
    /**
     * Akin to {@link ReplaceOneOptions.vector}, but for `$vectorize`.
     *
     * @deprecated - Prefer to use `sort: { $vectorize: '...' }` instead
     */
    vectorize?: string;
}

/**
 * Represents the result of a replaceOne operation.
 *
 * @example
 * ```typescript
 * const result = await collection.replaceOne({
 *   _id: 'abc'
 * }, {
 *   name: 'John'
 * }, {
 *   upsert: true
 * });
 *
 * if (result.upsertedCount) {
 *   console.log(`Document with ID ${result.upsertedId} was upserted`);
 * }
 * ```
 *
 * @field matchedCount - The number of documents that matched the filter.
 * @field modifiedCount - The number of documents that were actually modified.
 * @field upsertedCount - The number of documents that were upserted.
 * @field upsertedId - The identifier of the upserted document if `upsertedCount > 0`.
 *
 * @see Collection.replaceOne
 *
 * @public
 */
export declare type ReplaceOneResult<Schema extends SomeDoc> = InternalUpdateResult<Schema, 0 | 1>;

/**
 * Options for executing some arbitrary command.
 *
 * @field collection - The collection to run the command on. If not provided, the command is run on the database.
 * @field keyspace - Overrides the keyspace to run the command in. If not provided, the default keyspace is used.
 *
 * @see Db.command
 *
 * @public
 */
export declare interface RunCommandOptions extends WithTimeout {
    /**
     * The collection to run the command on. If not provided, the command is run on the database.
     */
    collection?: string;
    /**
     * The keyspace to use for the db operation.
     */
    keyspace?: string | null;
    /**
     * The keyspace to use for the db operation.
     *
     * This is now a deprecated alias for the strictly equivalent {@link RunCommandOptions.keyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link RunCommandOptions.keyspace} instead.
     */
    namespace?: string | null;
}

/**
 * Represents *some document*. It's not a base type, but rather more of a
 * bottom type which can represent any legal document, to give more dynamic
 * typing flexibility at the cost of enhanced typechecking/autocomplete.
 *
 * {@link Collection}s will default to this if no specific type is provided.
 *
 * @public
 */
export declare type SomeDoc = Record<string, any>;

/**
 * All possible types for a document ID. JSON scalar types, `Date`, `UUID`, and `ObjectId`.
 *
 * Note that the `_id` *can* technically be `null`. Trying to set the `_id` to `null` doesn't mean "auto-generate
 * an ID" like it may in some other databases; it quite literally means "set the ID to `null`".
 *
 * It's heavily recommended to properly type this in your Schema, so you know what to expect for your `_id` field.
 *
 * @public
 */
export declare type SomeId = string | number | bigint | boolean | Date | UUID | ObjectId | null;

/**
 * Specifies the sort criteria for selecting documents.
 *
 * **If you want stricter type-checking and full auto-complete, see {@link StrictSort}.**
 *
 * Can use `1`/`-1` for ascending/descending, or `$vector` for sorting by vector distance.
 *
 * See {@link SortDirection} for all possible sort values.
 *
 * **NB. The order of the fields in the sort option is significant—fields are sorted in the order they are listed.**
 *
 * @example
 * ```typescript
 * // Sort by name in ascending order, then by age in descending order
 * const sort1: Sort = {
 *   name: 1,
 *   age: -1,
 * }
 *
 * // Sort by vector distance
 * const sort2: Sort = {
 *   $vector: [0.23, 0.38, 0.27, 0.91, 0.21],
 * }
 * ```
 *
 * @see StrictSort
 * @see SortDirection
 *
 * @public
 */
export declare type Sort = Record<string, SortDirection> | {
    $vector: number[];
} | {
    $vectorize: string;
};

/**
 * Allowed types to specify an ascending or descending sort.
 *
 * @public
 */
export declare type SortDirection = 1 | -1 | 'asc' | 'desc' | 'ascending' | 'descending';

/**
 * The most basic token provider, which simply returns the token it was instantiated with.
 *
 * Generally, anywhere this can be used in the public `astra-db-ts` interfaces, you may also pass in a plain
 * string or null/undefined, which is transformed into a {@link StaticTokenProvider} under the hood.
 *
 * @example
 * ```typescript
 * const provider = new StaticTokenProvider('token');
 * const client = new DataAPIClient(provider);
 *
 * // or just
 *
 * const client = new DataAPIClient('token');
 * ```
 *
 * @see TokenProvider
 *
 * @public
 */
export declare class StaticTokenProvider extends TokenProvider {
    #private;
    /**
     * Constructs an instead of the {@link StaticTokenProvider}.
     *
     * @param token - The token to regurgitate in `getTokenAsString`
     */
    constructor(token: string | nullish);
    /**
     * Returns the string the token provider was instantiated with.
     *
     * @returns the string the token provider was instantiated with.
     */
    getToken(): string | nullish;
}

/**
 * Strongly types date update operations (inc. dot notation schema).
 *
 * @public
 */
export declare type StrictDateUpdate<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsDate<InNotation> extends true ? {
    [K in keyof InNotation as ContainsDate<InNotation[K]> extends true ? K : never]?: Date | {
        $date: number;
    };
} : TypeErr<'Can not perform a date operation on a schema with no dates'>;

/**
 * Represents some filter operation for a given document schema.
 *
 * **If you want relaxed type-checking, see {@link Filter}.**
 *
 * This is a stricter version of {@link Filter} that type-checks nested fields.
 *
 * You can use it anywhere by using the `satisfies` keyword, or by creating a temporary const with the StrictFilter type.
 *
 * @example
 * ```typescript
 * interface BasicSchema {
 *   arr: string[],
 *   num: number,
 * }
 *
 * db.collection<BasicSchema>('coll_name').findOne({
 *   $and: [
 *     { _id: { $in: ['abc', 'def'] } },
 *     { $not: { arr: { $size: 0 } } },
 *   ]
 * } satisfies StrictFilter<BasicSchema>);
 * ```
 *
 * @see Filter
 *
 * @public
 */
export declare type StrictFilter<Schema extends SomeDoc> = {
    [K in keyof ToDotNotation<NoId<Schema>>]?: FilterExpr<ToDotNotation<NoId<Schema>>[K]>;
} & {
    _id?: FilterExpr<IdOf<Schema>>;
    $and?: StrictFilter<Schema>[];
    $or?: StrictFilter<Schema>[];
    $not?: StrictFilter<Schema>;
};

/**
 * Strongly types number update operations (inc. dot notation schema).
 *
 * @public
 */
export declare type StrictNumberUpdate<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsNum<InNotation> extends true ? {
    [K in keyof InNotation as IsNum<InNotation[K]> extends true ? K : never]?: number | bigint;
} : TypeErr<'Can not perform a number operation on a schema with no numbers'>;

/**
 * Strongly types the pop operation (inc. dot notation schema).
 *
 * @public
 */
export declare type StrictPop<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsArr<InNotation> extends true ? {
    [K in keyof ArrayUpdate<InNotation>]?: number;
} : TypeErr<'Can not pop on a schema with no arrays'>;

/**
 * Specifies which fields should be included/excluded in the returned documents.
 *
 * Can use `1`/`0`, or `true`/`false`.
 *
 * There's a special field `'*'` that can be used to include/exclude all fields.
 *
 * @example
 * ```typescript
 * await collection.findOne({}, {
 *   projection: {
 *     _id: 0,
 *     name: 1,
 *     'address.state': 1,
 *   } satisfies StrictProjection<SomeDoc>,
 * });
 *
 * await collection.findOne({}, {
 *   projection: {
 *     $vector: 0,
 *   } satisfies StrictProjection<SomeDoc>,
 * });
 *
 * await collection.findOne({}, {
 *   projection: {
 *     test_scores: { $slice: [2, 4] },
 *   } satisfies StrictProjection<SomeDoc>,
 * });
 * ```
 *
 * @see Projection
 *
 * @public
 */
export declare type StrictProjection<Schema extends SomeDoc> = {
    [K in keyof ToDotNotation<WithId<Schema>>]?: any[] extends (ToDotNotation<WithId<Schema>>)[K] ? 1 | 0 | true | false | ProjectionSlice : 1 | 0 | true | false;
} & {
    '*'?: 1 | 0 | true | false;
};

/**
 * Strongly types the push operation (inc. dot notation schema).
 *
 * @public
 */
export declare type StrictPush<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsArr<InNotation> extends true ? {
    [K in keyof ArrayUpdate<InNotation>]?: (ArrayUpdate<InNotation>[K] | {
        $each: ArrayUpdate<InNotation>[K][];
        $position?: number;
    });
} : TypeErr<'Can not perform array operation on a schema with no arrays'>;

/**
 * Strongly types the rename operation (inc. dot notation schema).
 *
 * @public
 */
export declare type StrictRename<Schema extends SomeDoc> = {
    [K in keyof ToDotNotation<Schema>]?: string;
};

/**
 * Specifies the sort criteria for selecting documents.
 *
 * Can use `1`/`-1` for ascending/descending, or `$vector` for sorting by vector distance.
 *
 * See {@link SortDirection} for all possible sort values.
 *
 * **NB. The order of the fields in the sort option is significant—fields are sorted in the order they are listed.**
 *
 * @example
 * ```typescript
 * // Sort by name in ascending order, then by age in descending order
 * await collection.findOne({}, {
 *   sort: {
 *     name: 1,
 *     age: -1,
 *   } satisfies StrictSort<SomeDoc>,
 * });
 *
 * // Sort by vector distance
 * await collection.findOne({}, {
 *   sort: {
 *     $vector: [0.23, 0.38, 0.27, 0.91, 0.21],
 *   } satisfies StrictSort<SomeDoc>,
 * });
 * ```
 *
 * @see Sort
 * @see SortDirection
 *
 * @public
 */
export declare type StrictSort<Schema extends SomeDoc> = {
    [K in keyof ToDotNotation<WithId<Schema>>]?: SortDirection;
} | {
    $vector: number[];
} | {
    $vectorize: string;
};

/**
 * Very strongly types the unset operation (inc. dot notation schema).
 *
 * @public
 */
export declare type StrictUnset<Schema extends SomeDoc> = {
    [K in keyof ToDotNotation<Schema>]?: '' | true | 1;
};

/**
 * Represents the update filter to specify how to update a document.
 *
 * **If you want relaxed type-checking, see {@link UpdateFilter}.**
 *
 * This is a stricter version of {@link UpdateFilter} that type-checks nested fields.
 *
 * You can use it anywhere by using the `satisfies` keyword, or by creating a temporary const with the StrictUpdateFilter type.
 *
 * @example
 * ```typescript
 * const updateFilter: UpdateFilter<SomeDoc> = {
 *   $set: {
 *     'customer.name': 'Jim B.'
 *   },
 *   $unset: {
 *     'customer.phone': ''
 *   },
 *   $inc: {
 *     'customer.age': 1
 *   },
 * } satisfies StrictUpdateFilter<SomeDoc>
 * ```
 *
 * @field $set - Set the value of a field in the document.
 * @field $setOnInsert - Set the value of a field in the document if an upsert is performed.
 * @field $unset - Remove the field from the document.
 * @field $inc - Increment the value of a field in the document.
 * @field $push - Add an element to an array field in the document.
 * @field $pop - Remove an element from an array field in the document.
 * @field $rename - Rename a field in the document.
 * @field $currentDate - Set the value of a field to the current date.
 * @field $min - Only update the field if the specified value is less than the existing value.
 * @field $max - Only update the field if the specified value is greater than the existing value.
 * @field $mul - Multiply the value of a field in the document.
 * @field $addToSet - Add an element to an array field in the document if it does not already exist.
 *
 * @see UpdateFilter
 *
 * @public
 */
export declare interface StrictUpdateFilter<Schema extends SomeDoc> {
    /**
     * Set the value of a field in the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $set: {
     *     'customer.name': 'Jim B.'
     *   }
     * }
     * ```
     */
    $set?: Partial<ToDotNotation<Schema>>;
    /**
     * Set the value of a field in the document if an upsert is performed.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $setOnInsert: {
     *     'customer.name': 'Jim B.'
     *   }
     * }
     * ```
     */
    $setOnInsert?: Partial<ToDotNotation<Schema>>;
    /**
     * Remove the field from the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $unset: {
     *     'customer.phone': ''
     *   }
     * }
     * ```
     */
    $unset?: StrictUnset<Schema>;
    /**
     * Increment the value of a field in the document if it's potentially a `number`.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $inc: {
     *     'customer.age': 1
     *   }
     * }
     * ```
     */
    $inc?: StrictNumberUpdate<Schema>;
    /**
     * Add an element to an array field in the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $push: {
     *     'items': 'Extended warranty - 5 years'
     *   }
     * }
     * ```
     */
    $push?: StrictPush<Schema>;
    /**
     * Remove an element from an array field in the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $pop: {
     *     'items': -1
     *   }
     * }
     * ```
     */
    $pop?: StrictPop<Schema>;
    /**
     * Rename a field in the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $rename: {
     *     'customer.name': 'client.name'
     *   }
     * }
     * ```
     */
    $rename?: StrictRename<Schema>;
    /**
     * Set the value of a field to the current date.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $currentDate: {
     *     'purchase_date': true
     *   }
     * }
     * ```
     */
    $currentDate?: CurrentDate<ToDotNotation<Schema>>;
    /**
     * Only update the field if the specified value is less than the existing value.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $min: {
     *     'customer.age': 18
     *   }
     * }
     * ```
     */
    $min?: StrictNumberUpdate<Schema> | StrictDateUpdate<Schema>;
    /**
     * Only update the field if the specified value is greater than the existing value.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $max: {
     *     'customer.age': 65
     *   }
     * }
     * ```
     */
    $max?: StrictNumberUpdate<Schema> | StrictDateUpdate<Schema>;
    /**
     * Multiply the value of a field in the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $mul: {
     *     'customer.age': 1.1
     *   }
     * }
     * ```
     */
    $mul?: StrictNumberUpdate<Schema>;
    /**
     * Add an element to an array field in the document if it does not already exist.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $addToSet: {
     *     'items': 'Extended warranty - 5 years'
     *   }
     * }
     * ```
     */
    $addToSet?: StrictPush<Schema>;
}

/* Excluded from this release type: TimeoutManager */

/* Excluded from this release type: TimeoutOptions */

/**
 * Converts some `Schema` into a type representing its dot notation (object paths).
 *
 * If a value is any or SomeDoc, it'll be allowed to be any old object.
 *
 * *Note that this does NOT support indexing into arrays beyond the initial array index itself. Meaning,
 * `arr.0` is supported, but `arr.0.property` is not. Use a more flexible type (such as `any` or `SomeDoc`)
 * to support that.*
 *
 * @example
 * ```typescript
 * interface BasicSchema {
 *   num: number,
 *   arr: string[],
 *   obj: {
 *     nested: string,
 *     someDoc: SomeDoc,
 *   }
 * }
 *
 * interface BasicSchemaInDotNotation {
 *   'num': number,
 *   'arr': string[],
 *   [`arr.${number}`]: string,
 *   'obj': { nested: string, someDoc: SomeDoc }
 *   'obj.nested': string,
 *   'obj.someDoc': SomeDoc,
 *   [`obj.someDoc.${string}`]: any,
 * }
 * ```
 *
 * @public
 */
export declare type ToDotNotation<Schema extends SomeDoc> = Merge<_ToDotNotation<Schema, ''>>;

declare type _ToDotNotation<_Elem extends SomeDoc, Prefix extends string, Elem = Required<_Elem>> = {
    [Key in keyof Elem]: SomeDoc extends Elem ? ((Prefix extends '' ? never : {
        [Path in CropTrailingDot<Prefix>]: Elem;
    }) | {
        [Path in `${Prefix}${string}`]: any;
    }) : true extends false & Elem[Key] ? ({
        [Path in `${Prefix}${Key & string}`]: Elem[Key];
    } | {
        [Path in `${Prefix}${Key & string}.${string}`]: Elem[Key];
    }) : Elem[Key] extends any[] ? ({
        [Path in `${Prefix}${Key & string}`]: Elem[Key];
    } | {
        [Path in `${Prefix}${Key & string}.${number}`]: Elem[Key][number];
    }) : Elem[Key] extends UUID | ObjectId ? {
        [Path in `${Prefix}${Key & string}`]: Elem[Key];
    } : Elem[Key] extends Date ? {
        [Path in `${Prefix}${Key & string}`]: Date | {
            $date: number;
        };
    } : Elem[Key] extends SomeDoc ? ({
        [Path in `${Prefix}${Key & string}`]: Elem[Key];
    } | _ToDotNotation<Elem[Key], `${Prefix}${Key & string}.`>) : {
        [Path in `${Prefix}${Key & string}`]: Elem[Key];
    };
}[keyof Elem] extends infer Value ? Value : never;

/**
 * The base class for some "token provider", a general concept for anything that provides some token to the client,
 * whether it be a static token, or if the token is dynamically fetched at runtime, or periodically refreshed.
 *
 * The {@link TokenProvider.getToken} function is called any time the token is required, whether it be
 * for the Data API, or the DevOps API.
 *
 * `astra-db-ts` provides all the main token providers you may ever need to use, but you're able to extend this
 * class to create your own if you find it necessary.
 *
 * Generally, where you can pass in a `TokenProvider`, you may also pass in a plain string which is translated
 * into a {@link StaticTokenProvider} under the hood.
 *
 * @example
 * ```typescript
 * const provider = new UsernamePasswordTokenProvider('username', 'password');
 * const client = new DataAPIClient(provider);
 * ```
 *
 * @see StaticTokenProvider
 * @see UsernamePasswordTokenProvider
 *
 * @public
 */
export declare abstract class TokenProvider {
    /**
     * The function which provides the token. It may do any I/O as it wishes to obtain/refresh the token, as it's called
     * every time the token is required for use, whether it be for the Data API, or the DevOps API.
     */
    abstract getToken(): string | nullish | Promise<string | nullish>;
    /* Excluded from this release type: parseToken */
}

/**
 * Caused by a `countDocuments` operation that failed because the resulting number of documents exceeded *either*
 * the upper bound set by the caller, or the hard limit imposed by the Data API.
 *
 * @example
 * ```typescript
 * await collection.insertMany('<100_length_array>');
 *
 * try {
 *   await collection.countDocuments({}, 50);
 * } catch (e) {
 *   if (e instanceof TooManyDocumentsToCountError) {
 *     console.log(e.limit); // 50
 *     console.log(e.hitServerLimit); // false
 *   }
 * }
 * ```
 *
 * @field limit - The limit that was set by the caller
 * @field hitServerLimit - Whether the server-imposed limit was hit
 *
 * @public
 */
export declare class TooManyDocumentsToCountError extends DataAPIError {
    /**
     * The limit that was specified by the caller, or the server-imposed limit if the caller's limit was too high.
     */
    readonly limit: number;
    /**
     * Specifies if the server-imposed limit was hit. If this is `true`, the `limit` field will contain the server's
     * limit; otherwise it will contain the caller's limit.
     */
    readonly hitServerLimit: boolean;
    /* Excluded from this release type: __constructor */
}

/**
 * Represents some type-level error which forces immediate attention rather than failing at runtime.
 *
 * More inflexable type than `never`, and gives contextual error messages.
 *
 * @example
 * ```typescript
 * function unsupported(): TypeErr<'Unsupported operation'> {
 *   throw new Error('Unsupported operation');
 * }
 *
 * // Doesn't compile with error:
 * // Type TypeErr<'Unsupported operation'> is not assignable to type string
 * const result: string = unsupported();
 * ```
 *
 * @public
 */
export declare type TypeErr<S> = {
    [__error]: S;
};

declare type UnionToIntersection<U> = (U extends any ? (arg: U) => any : never) extends ((arg: infer I) => void) ? I : never;

/**
 * Represents the update filter to specify how to update a document.
 *
 * **If you want stricter type-checking and full auto-complete, see {@link StrictUpdateFilter}.**
 *
 * This is a more relaxed version of {@link StrictUpdateFilter} that doesn't type-check nested fields.
 *
 * @example
 * ```typescript
 * const updateFilter: UpdateFilter<SomeDoc> = {
 *   $set: {
 *     'customer.name': 'Jim B.'
 *   },
 *   $unset: {
 *     'customer.phone': ''
 *   },
 *   $inc: {
 *     'customer.age': 1
 *   },
 * }
 * ```
 *
 * @field $set - Set the value of a field in the document.
 * @field $setOnInsert - Set the value of a field in the document if an upsert is performed.
 * @field $unset - Remove the field from the document.
 * @field $inc - Increment the value of a field in the document.
 * @field $push - Add an element to an array field in the document.
 * @field $pop - Remove an element from an array field in the document.
 * @field $rename - Rename a field in the document.
 * @field $currentDate - Set the value of a field to the current date.
 * @field $min - Only update the field if the specified value is less than the existing value.
 * @field $max - Only update the field if the specified value is greater than the existing value.
 * @field $mul - Multiply the value of a field in the document.
 * @field $addToSet - Add an element to an array field in the document if it does not already exist.
 *
 * @see StrictUpdateFilter
 *
 * @public
 */
export declare interface UpdateFilter<Schema extends SomeDoc> {
    /**
     * Set the value of a field in the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $set: {
     *     'customer.name': 'Jim B.'
     *   }
     * }
     * ```
     */
    $set?: Partial<Schema> & SomeDoc;
    /**
     * Set the value of a field in the document if an upsert is performed.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $setOnInsert: {
     *     'customer.name': 'Jim B.'
     *   }
     * }
     * ```
     */
    $setOnInsert?: Partial<Schema> & SomeDoc;
    /**
     * Remove the field from the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $unset: {
     *     'customer.phone': ''
     *   }
     * }
     * ```
     */
    $unset?: Record<string, '' | true | 1>;
    /**
     * Increment the value of a field in the document if it's potentially a `number`.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $inc: {
     *     'customer.age': 1
     *   }
     * }
     * ```
     */
    $inc?: NumberUpdate<Schema> & Record<string, number>;
    /**
     * Add an element to an array field in the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $push: {
     *     'items': 'Extended warranty - 5 years'
     *   }
     * }
     * ```
     */
    $push?: Push<Schema> & SomeDoc;
    /**
     * Remove an element from an array field in the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $pop: {
     *     'items': -1
     *   }
     * }
     * ```
     */
    $pop?: Pop<Schema> & Record<string, number>;
    /**
     * Rename a field in the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $rename: {
     *     'customer.name': 'client.name'
     *   }
     * }
     * ```
     */
    $rename?: Record<string, string>;
    /**
     * Set the value of a field to the current date.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $currentDate: {
     *     'purchase_date': true
     *   }
     * }
     * ```
     */
    $currentDate?: CurrentDate<Schema> & Record<string, boolean>;
    /**
     * Only update the field if the specified value is less than the existing value.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $min: {
     *     'customer.age': 18
     *   }
     * }
     * ```
     */
    $min?: (NumberUpdate<Schema> | DateUpdate<Schema>) & Record<string, number | bigint | Date | {
        $date: number;
    }>;
    /**
     * Only update the field if the specified value is greater than the existing value.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $max: {
     *     'customer.age': 65
     *   }
     * }
     * ```
     */
    $max?: (NumberUpdate<Schema> | DateUpdate<Schema>) & Record<string, number | bigint | Date | {
        $date: number;
    }>;
    /**
     * Multiply the value of a field in the document.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $mul: {
     *     'customer.age': 1.1
     *   }
     * }
     * ```
     */
    $mul?: StrictNumberUpdate<Schema> & Record<string, number>;
    /**
     * Add an element to an array field in the document if it does not already exist.
     *
     * @example
     * ```typescript
     * const updateFilter: UpdateFilter<SomeDoc> = {
     *   $addToSet: {
     *     'items': 'Extended warranty - 5 years'
     *   }
     * }
     * ```
     */
    $addToSet?: Push<Schema> & SomeDoc;
}

/**
 * Represents an error that occurred during an `updateMany` operation (which is, generally, paginated).
 *
 * Contains the number of documents that were successfully matched and/or modified, as well as the cumulative errors
 * that occurred during the operation.
 *
 * @field message - A human-readable message describing the *first* error
 * @field errorDescriptors - A list of error descriptors representing the individual errors returned by the API
 * @field detailedErrorDescriptors - A list of errors 1:1 with the number of errorful API requests made to the server.
 * @field partialResult - The partial result of the `UpdateMany` operation that was performed
 *
 * @public
 */
export declare class UpdateManyError extends CumulativeDataAPIError {
    /**
     * The name of the error. This is always 'UpdateManyError'.
     */
    name: string;
    /**
     * The partial result of the `UpdateMany` operation that was performed. This is *always* defined, and is the result
     * of the operation up to the point of the first error.
     */
    readonly partialResult: UpdateManyResult<SomeDoc>;
}

/**
 * Represents an updateMany operation that can be used in a bulk write operation.
 *
 * @field filter - The filter to choose the documents to update.
 * @field update - The update to apply to the documents.
 * @field upsert - If true, perform an insert if no documents match the filter.
 *
 * @public
 */
export declare interface UpdateManyModel<TSchema extends SomeDoc> {
    /**
     * The filter to choose the documents to update.
     */
    filter: Filter<TSchema>;
    /**
     * The update to apply to the documents.
     */
    update: UpdateFilter<TSchema>;
    /**
     * If true, perform an insert if no documents match the filter.
     *
     * If false, do not insert if no documents match the filter.
     *
     * Defaults to false.
     *
     * @defaultValue false
     */
    upsert?: boolean;
}

/**
 * Represents the options for the updateMany command.
 *
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @public
 */
export declare interface UpdateManyOptions extends WithTimeout {
    /**
     * If true, perform an insert if no documents match the filter.
     *
     * If false, do not insert if no documents match the filter.
     *
     * Defaults to false.
     *
     * @defaultValue false
     */
    upsert?: boolean;
}

/**
 * Represents the result of an updateMany operation.
 *
 * @example
 * ```typescript
 * const result = await collection.updateOne({
 *   _id: 'abc'
 * }, {
 *   $set: { name: 'John' }
 * }, {
 *   upsert: true
 * });
 *
 * if (result.upsertedCount) {
 *   console.log(`Document with ID ${result.upsertedId} was upserted`);
 * }
 * ```
 *
 * @field matchedCount - The number of documents that matched the filter.
 * @field modifiedCount - The number of documents that were actually modified.
 * @field upsertedCount - The number of documents that were upserted.
 * @field upsertedId - The identifier of the upserted document if `upsertedCount > 0`.
 *
 * @public
 */
export declare type UpdateManyResult<Schema extends SomeDoc> = InternalUpdateResult<Schema, number>;

/**
 * Represents an updateOne operation that can be used in a bulk write operation.
 *
 * @field filter - The filter to choose the document to update.
 * @field update - The update to apply to the document.
 * @field upsert - If true, perform an insert if no documents match the filter.
 *
 * @public
 */
export declare interface UpdateOneModel<TSchema extends SomeDoc> {
    /**
     * The filter to choose the document to update.
     */
    filter: Filter<TSchema>;
    /**
     * The update to apply to the document.
     */
    update: UpdateFilter<TSchema>;
    /**
     * If true, perform an insert if no documents match the filter.
     *
     * If false, do not insert if no documents match the filter.
     *
     * Defaults to false.
     *
     * @defaultValue false
     */
    upsert?: boolean;
}

/**
 * Represents the options for the updateOne command.
 *
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field sort - The sort order to pick which document to update if the filter selects multiple documents.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.updateOne
 *
 * @public
 */
export declare interface UpdateOneOptions extends WithTimeout {
    /**
     * If true, perform an insert if no documents match the filter.
     *
     * If false, do not insert if no documents match the filter.
     *
     * Defaults to false.
     *
     * @defaultValue false
     */
    upsert?: boolean;
    /**
     * The order in which to apply the update if the filter selects multiple documents.
     *
     * If multiple documents match the filter, only one will be updated.
     *
     * Defaults to `null`, where the order is not guaranteed.
     *
     * @defaultValue null
     */
    sort?: Sort;
    /**
     * An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection
     * to find the closest matching document.
     *
     * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field in the
     * sort field itself. The two are interchangeable, but mutually exclusive.
     *
     * If the sort field is already set, an error will be thrown. If you really need to use both, you can set the $vector
     * field in the sort object directly.
     *
     * @deprecated - Prefer to use `sort: { $vector: [...] }` instead
     */
    vector?: number[];
    /**
     * Akin to {@link UpdateOneOptions.vector}, but for `$vectorize`.
     *
     * @deprecated - Prefer to use `sort: { $vectorize: '...' }` instead
     */
    vectorize?: string;
}

/**
 * Represents the result of an updateOne operation.
 *
 * @example
 * ```typescript
 * const result = await collection.updateOne({
 *   _id: 'abc'
 * }, {
 *   $set: { name: 'John' }
 * }, {
 *   upsert: true
 * });
 *
 * if (result.upsertedCount) {
 *   console.log(`Document with ID ${result.upsertedId} was upserted`);
 * }
 * ```
 *
 * @field matchedCount - The number of documents that matched the filter.
 * @field modifiedCount - The number of documents that were actually modified.
 * @field upsertedCount - The number of documents that were upserted.
 * @field upsertedId - The identifier of the upserted document if `upsertedCount > 0`.
 *
 * @see Collection.updateOne
 *
 * @public
 */
export declare type UpdateOneResult<Schema extends SomeDoc> = InternalUpdateResult<Schema, 0 | 1>;

/**
 * Represents the set of fields that are present in the result of an update operation when the `upsert` option is true,
 * and an upsert occurred.
 *
 * @field upsertedId - The identifier of the upserted document.
 * @field upsertedCount - The number of documents that were upserted.
 *
 * @public
 */
export declare interface UpsertedUpdateOptions<Schema extends SomeDoc> {
    /**
     * The identifier of the upserted document (this will be an autogenerated ID if one was not provided).
     */
    upsertedId: IdOf<Schema>;
    /**
     * The number of documents that were upserted.
     */
    upsertedCount: 1;
}

/**
 * A token provider which translates a username-password pair into the appropriate authentication token for DSE, HCD.
 *
 * Uses the format `Cassandra:b64(username):password(username)`
 *
 * @example
 * ```typescript
 * const provider = new UsernamePasswordTokenProvider('username', 'password');
 * const client = new DataAPIClient(provider, { environment: 'dse' });
 * ```
 *
 * @see TokenProvider
 *
 * @public
 */
export declare class UsernamePasswordTokenProvider extends TokenProvider {
    #private;
    /**
     * Constructs an instead of the {@link TokenProvider}.
     *
     * @param username - The username for the DSE instance
     * @param password - The password for the DSE instance
     */
    constructor(username: string, password: string);
    /**
     * Returns the token in the format `cassandra:[username_b64]:[password_b64]`
     *
     * @returns the token in the format `cassandra:[username_b64]:[password_b64]`
     */
    getToken(): string;
    private _encodeB64;
}

/**
 * Represents a UUID that can be used as an _id in the DataAPI.
 *
 * Provides methods for creating v4 and v7 UUIDs, and for parsing timestamps from v7 UUIDs.
 *
 * @example
 * ```typescript
 * const collection = await db.createCollection('myCollection'. {
 *   defaultId: {
 *     type: 'uuidv7',
 *   },
 * });
 *
 * await collection.insertOne({ album: 'Jomsviking' });
 *
 * const doc = await collection.findOne({ album: 'Jomsviking' });
 *
 * // Prints the UUID of the document
 * console.log(doc._id.toString());
 *
 * // Prints the timestamp when the document was created (server time)
 * console.log(doc._id.getTimestamp());
 * ```
 *
 * @example
 * ```typescript
 * await collection.insertOne({ _id: UUID.v4(), album: 'Berserker' });
 *
 * const doc = await collection.findOne({ album: 'Berserker' });
 *
 * // Prints the UUID of the document
 * console.log(doc._id.toString());
 *
 * // Undefined, as the document was created with a v4 UUID
 * console.log(doc._id.getTimestamp());
 * ```
 *
 * @see ObjectId
 *
 * @public
 */
export declare class UUID {
    /**
     * The version of the UUID.
     */
    readonly version: number;
    private readonly _raw;
    /**
     * Creates a new UUID instance.
     *
     * Use `UUID.v4()` or `UUID.v7()` to generate random new UUIDs.
     *
     * @param uuid - The UUID string.
     * @param validate - Whether to validate the UUID string. Defaults to `true`.
     */
    constructor(uuid: string, validate?: boolean);
    /**
     * Compares this UUID to another UUID.
     *
     * **The other UUID can be a UUID instance or a string.**
     *
     * A UUID is considered equal to another UUID if their lowercase string representations are equal.
     *
     * @param other - The UUID to compare to.
     *
     * @returns `true` if the UUIDs are equal, `false` otherwise.
     */
    equals(other: unknown): boolean;
    /**
     * Returns the timestamp of a v7 UUID. If the UUID is not a v7 UUID, this method returns `undefined`.
     *
     * @returns The timestamp of the UUID, or `undefined` if the UUID is not a v7 UUID.
     */
    getTimestamp(): Date | undefined;
    /**
     * Returns the string representation of the UUID in lowercase.
     */
    toString(): string;
    /**
     * Creates a new v4 UUID.
     */
    static v4(): UUID;
    /**
     * Creates a new v7 UUID.
     */
    static v7(): UUID;
    /**
     * Inspects the UUID.
     */
    inspect(): string;
    /**
     * Converts the UUID to a JSON representation.
     *
     * Serializes to `{ $uuid: 'uuid' }`.
     */
    toJSON(): {
        $uuid: string;
    };
}

/**
 * Base type for a document that wishes to leverage raw vector capabilities.
 *
 * @example
 * ```typescript
 * export interface Idea extends VectorDoc {
 *   category: string,
 *   idea: string,
 * }
 *
 * db.collection<Idea>('ideas').insertOne({
 *   category: 'doors',
 *   idea: 'Upside down doors',
 *   $vector: [.23, .05, .95, .83, .42],
 * });
 * ```
 *
 * @public
 */
export declare interface VectorDoc {
    /**
     * A raw vector
     */
    $vector?: number[];
}

/**
 * Base type for a document that wishes to leverage automatic vectorization (assuming the collection is vectorize-enabled).
 *
 * @example
 * ```typescript
 * export interface Idea extends VectorizeDoc {
 *   category: string,
 * }
 *
 * db.collection<Idea>('ideas').insertOne({
 *   category: 'doors',
 *   $vectorize: 'Upside down doors',
 * });
 * ```
 *
 * @public
 */
export declare interface VectorizeDoc {
    /**
     * A string field to be automatically vectorized
     */
    $vectorize: string;
}

/**
 * The options for defining the embedding service used for vectorize, to automatically transform your
 * text into a vector ready for semantic vector searching.
 *
 * You can find out more information about each provider/model in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
 * or through {@link DbAdmin.findEmbeddingProviders}.
 *
 * @field provider - The name of the embedding provider which provides the model to use
 * @field model - The specific model to use for embedding, or undefined if it's an endpoint-defined model
 * @field authentication - Object containing any necessary collection-bound authentication, if any
 * @field parameters - Object allowing arbitrary parameters that may be necessary on a per-model basis
 *
 * @public
 */
export declare interface VectorizeServiceOptions {
    /**
     * The name of the embedding provider which provides the model to use.
     *
     * You can find out more information about each provider in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
     * or through  {@link DbAdmin.findEmbeddingProviders}.
     */
    provider: string;
    /**
     * The name of the embedding model to use.
     *
     * You can find out more information about each model in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
     * or through {@link DbAdmin.findEmbeddingProviders}.
     */
    modelName: string | nullish;
    /**
     * Object containing any necessary collection-bound authentication, if any.
     *
     * Most commonly, `providerKey: '*SHARED_SECRET_NAME*'` may be used here to reference an API key from the Astra KMS.
     *
     * {@link Db.createCollection} and {@link Db.collection} both offer an `embeddingApiKey` parameter which utilizes
     * header-based auth to pass the provider's token/api-key to the Data API on a per-request basis instead, if that
     * is preferred (or necessary).
     */
    authentication?: Record<string, string | undefined>;
    /**
     * Object allowing arbitrary parameters that may be necessary on a per-model/per-provider basis.
     *
     * Not all providers need this, but some, such as `huggingfaceDedicated` have required parameters, others have
     * optional parameters (e.g. `openAi`), and some don't require any at all.
     *
     * You can find out more information about each provider/model in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
     * or through {@link DbAdmin.findEmbeddingProviders}.
     */
    parameters?: Record<string, unknown>;
}

/**
 * Represents the options for the vector search.
 *
 * @field dimension - The dimension of the vectors.
 * @field metric - The similarity metric to use for the vector search.
 * @field service - Options related to configuring the automatic embedding service (vectorize)
 *
 * @public
 */
export declare interface VectorOptions {
    /**
     * The dimension of the vectors stored in the collection.
     *
     * If `service` is not provided, this must be set. Otherwise, the necessity of this being set comes on a per-model
     * basis:
     * - Some models have default vector dimensions which may be flexibly modified
     * - Some models have no default dimension, and must be given an explicit one
     * - Some models require a specific dimension that's already set by default
     *
     * You can find out more information about each model in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
     * or through {@link DbAdmin.findEmbeddingProviders}.
     */
    dimension?: number;
    /**
     * The similarity metric to use for the vector search.
     *
     * See [intro to vector databases](https://docs.datastax.com/en/astra/astra-db-vector/get-started/concepts.html#metrics) for more details.
     */
    metric?: 'cosine' | 'euclidean' | 'dot_product';
    /**
     * The options for defining the embedding service used for vectorize, to automatically transform your
     * text into a vector ready for semantic vector searching.
     *
     * You can find out more information about each provider/model in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
     * or through {@link DbAdmin.findEmbeddingProviders}.
     */
    service?: VectorizeServiceOptions;
}

/**
 * Forces the given type to include an `_id`
 *
 * @public
 */
export declare type WithId<T> = NoId<T> & {
    _id: IdOf<T>;
};

/**
 * Allows you to override the keyspace to use for some db operation. If not specified,
 * the db operation will use either the keyspace provided when creating the Db instance, the keyspace
 * provided when creating the DataAPIClient instance, or the default keyspace `'default_keyspace'`.
 * (in that order)
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('AstraCS:...');
 *
 * // Using 'default_keyspace' as the keyspace
 * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
 *
 * // Using 'my_keyspace' as the keyspace
 * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
 *   keyspace: 'my_keyspace',
 * });
 *
 * // Finds 'my_collection' in 'default_keyspace'
 * const coll1 = db1.collection('my_collection');
 *
 * // Finds 'my_collection' in 'my_keyspace'
 * const coll2 = db1.collection('my_collection', {
 *   keyspace: 'my_keyspace',
 * });
 * ```
 *
 * @field keyspace - The keyspace to use for the db operation.
 *
 * @public
 */
export declare interface WithKeyspace {
    /**
     * The keyspace to use for the operation.
     */
    keyspace?: string;
    /**
     * The keyspace to use for the operation.
     *
     * This is now a deprecated alias for the strictly equivalent {@link WithKeyspace.keyspace}, and will be removed
     * in an upcoming major version.
     *
     * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
     *
     * @deprecated - Prefer {@link WithKeyspace.keyspace} instead.
     */
    namespace?: string;
}

/**
 * This is now a deprecated alias for the strictly equivalent {@link WithKeyspace}, and will be removed
 * in an upcoming major version.
 *
 * @deprecated - Prefer {@link WithKeyspace} instead.
 *
 * @public
 */
export declare type WithNamespace = WithKeyspace;

/* Excluded from this release type: WithNullableKeyspace */

/**
 * Represents options related to timeouts. Note that this means "the max time the client will wait for a response
 * from the server"—**an operation timing out does not necessarily mean the operation failed on the server**.
 *
 * On paginated operations, the timeout applies across all network requests. For example, if you set a timeout of 5
 * seconds and the operation requires 3 network requests, each request must complete in less than 5 seconds total.
 *
 * @public
 */
export declare interface WithTimeout {
    /**
     * The maximum time to wait for a response from the server, in milliseconds.
     */
    maxTimeMS?: number;
}

export { }
