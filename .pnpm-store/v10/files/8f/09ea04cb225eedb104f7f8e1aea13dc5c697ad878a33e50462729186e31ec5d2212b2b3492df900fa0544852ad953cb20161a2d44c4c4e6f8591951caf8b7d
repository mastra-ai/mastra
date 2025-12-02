type ChecklistResponse = {
    max_batch_size: number;
    supports_base64_encoding: boolean;
};
type Database = {
    id: string;
    name: string;
    tenant: string;
};
type EmbeddingFunctionConfiguration = {
    type: 'legacy';
} | (EmbeddingFunctionNewConfiguration & {
    type: 'known';
});
type EmbeddingFunctionNewConfiguration = {
    config: unknown;
    name: string;
};
type GetUserIdentityResponse = {
    databases: Array<string>;
    tenant: string;
    user_id: string;
};
type HnswConfiguration = {
    ef_construction?: number | null;
    ef_search?: number | null;
    max_neighbors?: number | null;
    resize_factor?: number | null;
    space?: null | HnswSpace;
    sync_threshold?: number | null;
};
type HnswSpace = 'l2' | 'cosine' | 'ip';
type Include = 'distances' | 'documents' | 'embeddings' | 'metadatas' | 'uris';
type SpannConfiguration = {
    ef_construction?: number | null;
    ef_search?: number | null;
    max_neighbors?: number | null;
    merge_threshold?: number | null;
    reassign_neighbor_count?: number | null;
    search_nprobe?: number | null;
    space?: null | HnswSpace;
    split_threshold?: number | null;
    write_nprobe?: number | null;
};
/**
 * Represents a sparse vector using parallel arrays for indices and values.
 */
type SparseVector = {
    /**
     * Dimension indices
     */
    indices: Array<number>;
    /**
     * Values corresponding to each index
     */
    values: Array<number>;
};
type UpdateCollectionConfiguration$1 = {
    embedding_function?: null | EmbeddingFunctionConfiguration;
    hnsw?: null | UpdateHnswConfiguration;
    spann?: null | UpdateSpannConfiguration;
};
type UpdateHnswConfiguration = {
    batch_size?: number | null;
    ef_search?: number | null;
    max_neighbors?: number | null;
    num_threads?: number | null;
    resize_factor?: number | null;
    sync_threshold?: number | null;
};
type UpdateSpannConfiguration = {
    ef_search?: number | null;
    search_nprobe?: number | null;
};

/**
 * User identity information including tenant and database access.
 */
type UserIdentity = GetUserIdentityResponse;
/**
 * Metadata that can be associated with a collection.
 * Values must be boolean, number, or string types.
 */
type CollectionMetadata = Record<string, boolean | number | string | SparseVector | null>;
/**
 * Metadata that can be associated with individual records.
 * Values must be boolean, number, or string types.
 */
type Metadata = Record<string, boolean | number | string | SparseVector | null>;
/**
 * Base interface for record sets containing optional fields.
 */
interface BaseRecordSet {
    /** Array of embedding vectors */
    embeddings?: number[][];
    /** Array of metadata objects */
    metadatas?: Metadata[];
    /** Array of document text content */
    documents?: string[];
    /** Array of URIs/URLs */
    uris?: string[];
}
declare const baseRecordSetFields: string[];
/**
 * Complete record set with required IDs for operations like add/update.
 */
interface RecordSet extends BaseRecordSet {
    /** Array of unique record identifiers */
    ids: string[];
}
interface PreparedRecordSet extends Omit<RecordSet, "embeddings"> {
    embeddings?: number[][] | string[];
}
interface PreparedInsertRecordSet extends PreparedRecordSet {
    embeddings: number[][] | string[];
}
declare const recordSetFields: string[];
/**
 * Record set for query operations with required embeddings.
 */
interface QueryRecordSet extends BaseRecordSet {
    /** Optional array of record IDs to filter by */
    ids?: string[];
    /** Array of query embedding vectors (required for queries) */
    embeddings: number[][];
}
type LiteralValue = string | number | boolean;
type OperatorExpression = {
    $gt: LiteralValue;
} | {
    $gte: LiteralValue;
} | {
    $lt: LiteralValue;
} | {
    $lte: LiteralValue;
} | {
    $ne: LiteralValue;
} | {
    $eq: LiteralValue;
} | {
    $and: LiteralValue;
} | {
    $or: LiteralValue;
} | {
    $in: LiteralValue[];
} | {
    $nin: LiteralValue[];
};
/**
 * Where clause for filtering records based on metadata.
 * Supports field equality, comparison operators, and logical operators.
 */
type Where = {
    [key: string]: LiteralValue | OperatorExpression;
} | {
    $and: Where[];
} | {
    $or: Where[];
};
/**
 * Where clause for filtering based on document content.
 * Supports text search operators and logical combinations.
 */
type WhereDocument = {
    $contains: string;
} | {
    $not_contains: string;
} | {
    $matches: string;
} | {
    $not_matches: string;
} | {
    $regex: string;
} | {
    $not_regex: string;
} | {
    $and: WhereDocument[];
} | {
    $or: WhereDocument[];
};
/**
 * Enum specifying which fields to include in query results.
 */
declare enum IncludeEnum {
    /** Include similarity distances in results */
    distances = "distances",
    /** Include document text content in results */
    documents = "documents",
    /** Include embedding vectors in results */
    embeddings = "embeddings",
    /** Include metadata objects in results */
    metadatas = "metadatas",
    /** Include URIs in results */
    uris = "uris"
}
/**
 * Result class for get operations, containing retrieved records.
 * @template TMeta - The type of metadata associated with records
 */
declare class GetResult<TMeta extends Metadata = Metadata> {
    readonly documents: (string | null)[];
    readonly embeddings: number[][];
    readonly ids: string[];
    readonly include: Include[];
    readonly metadatas: (TMeta | null)[];
    readonly uris: (string | null)[];
    /**
     * Creates a new GetResult instance.
     * @param data - The result data containing all fields
     */
    constructor({ documents, embeddings, ids, include, metadatas, uris, }: {
        documents: (string | null)[];
        embeddings: number[][];
        ids: string[];
        include: Include[];
        metadatas: (TMeta | null)[];
        uris: (string | null)[];
    });
    /**
     * Converts the result to a row-based format for easier iteration.
     * @returns Object containing include fields and array of record objects
     */
    rows(): {
        id: string;
        document: string | null | undefined;
        embedding: number[] | undefined;
        metadata: TMeta | null | undefined;
        uri: string | null | undefined;
    }[];
}
/**
 * Interface for query results in row format.
 * @template TMeta - The type of metadata associated with records
 */
interface QueryRowResult<TMeta extends Metadata = Metadata> {
    /** Similarity distance to the query (if included) */
    distance?: number | null;
    /** Document text content (if included) */
    document?: string | null;
    /** Embedding vector (if included) */
    embedding?: number[] | null;
    /** Unique record identifier */
    id: string;
    /** Record metadata (if included) */
    metadata?: TMeta | null;
    /** Record URI (if included) */
    uri?: string | null;
}
/**
 * Result class for query operations, containing search results.
 * @template TMeta - The type of metadata associated with records
 */
declare class QueryResult<TMeta extends Metadata = Metadata> {
    readonly distances: (number | null)[][];
    readonly documents: (string | null)[][];
    readonly embeddings: (number[] | null)[][];
    readonly ids: string[][];
    readonly include: Include[];
    readonly metadatas: (TMeta | null)[][];
    readonly uris: (string | null)[][];
    /**
     * Creates a new QueryResult instance.
     * @param data - The query result data containing all fields
     */
    constructor({ distances, documents, embeddings, ids, include, metadatas, uris, }: {
        distances: (number | null)[][];
        documents: (string | null)[][];
        embeddings: (number[] | null)[][];
        ids: string[][];
        include: Include[];
        metadatas: (TMeta | null)[][];
        uris: (string | null)[][];
    });
    /**
     * Converts the query result to a row-based format for easier iteration.
     * @returns Object containing include fields and structured query results
     */
    rows(): QueryRowResult<TMeta>[][];
}

/**
 * Supported vector space types.
 */
type EmbeddingFunctionSpace = "cosine" | "l2" | "ip";
/**
 * Interface for embedding functions.
 * Embedding functions transform text documents into numerical representations
 * that can be used for similarity search and other vector operations.
 */
interface EmbeddingFunction {
    /**
     * Generates embeddings for the given texts.
     * @param texts - Array of text strings to embed
     * @returns Promise resolving to array of embedding vectors
     */
    generate(texts: string[]): Promise<number[][]>;
    /** Optional name identifier for the embedding function */
    name?: string;
    /** Returns the default vector space for this embedding function */
    defaultSpace?(): EmbeddingFunctionSpace;
    /** Returns all supported vector spaces for this embedding function */
    supportedSpaces?(): EmbeddingFunctionSpace[];
    /** Creates an instance from configuration object */
    buildFromConfig?(config: Record<string, any>): EmbeddingFunction;
    /** Returns the current configuration as an object */
    getConfig?(): Record<string, any>;
    /**
     * Validates that a configuration update is allowed.
     * @param newConfig - New configuration to validate
     */
    validateConfigUpdate?(newConfig: Record<string, any>): void;
    /**
     * Validates that a configuration object is valid.
     * @param config - Configuration to validate
     */
    validateConfig?(config: Record<string, any>): void;
}
/**
 * Interface for embedding function constructor classes.
 * Used for registering and instantiating embedding functions.
 */
interface EmbeddingFunctionClass {
    /** Constructor for creating new instances */
    new (...args: any[]): EmbeddingFunction;
    /** Name identifier for the embedding function */
    name: string;
    /** Static method to build instance from configuration */
    buildFromConfig(config: Record<string, any>): EmbeddingFunction;
}
/**
 * Registry of available embedding functions.
 * Maps function names to their constructor classes.
 */
declare const knownEmbeddingFunctions: Map<string, EmbeddingFunctionClass>;
/**
 * Registers an embedding function in the global registry.
 * @param name - Unique name for the embedding function
 * @param fn - Embedding function class to register
 * @throws ChromaValueError if name is already registered
 */
declare const registerEmbeddingFunction: (name: string, fn: EmbeddingFunctionClass) => void;
/**
 * Retrieves and instantiates an embedding function from configuration.
 * @param collectionName - Name of the collection (for error messages)
 * @param efConfig - Configuration for the embedding function
 * @returns Promise resolving to an EmbeddingFunction instance
 */
declare const getEmbeddingFunction: (collectionName: string, efConfig?: EmbeddingFunctionConfiguration) => Promise<EmbeddingFunction | undefined>;
/**
 * Serializes an embedding function to configuration format.
 * @param embeddingFunction - User provided embedding function
 * @param configEmbeddingFunction - Collection config embedding function
 * @returns Configuration object that can recreate the function
 */
declare const serializeEmbeddingFunction: ({ embeddingFunction, configEmbeddingFunction, }: {
    embeddingFunction?: EmbeddingFunction;
    configEmbeddingFunction?: EmbeddingFunction;
}) => EmbeddingFunctionConfiguration | undefined;
/**
 * Gets the configuration for the default embedding function.
 * Dynamically imports and registers the default embedding function if needed.
 * @returns Promise resolving to default embedding function configuration
 * @throws Error if default embedding function cannot be loaded
 */
declare const getDefaultEFConfig: () => Promise<EmbeddingFunctionConfiguration>;

interface CollectionConfiguration {
    embeddingFunction?: EmbeddingFunctionConfiguration | null;
    hnsw?: HNSWConfiguration | null;
    spann?: SpannConfiguration | null;
}
type HNSWConfiguration = HnswConfiguration & {
    batch_size?: number | null;
    num_threads?: number | null;
};
type CreateCollectionConfiguration = Omit<CollectionConfiguration, "embeddingFunction"> & {
    embeddingFunction?: EmbeddingFunction;
};
interface UpdateCollectionConfiguration {
    embeddingFunction?: EmbeddingFunction;
    hnsw?: UpdateHNSWConfiguration;
    spann?: UpdateSPANNConfiguration;
}
interface UpdateHNSWConfiguration {
    batch_size?: number;
    ef_search?: number;
    num_threads?: number;
    resize_factor?: number;
    sync_threshold?: number;
}
interface UpdateSPANNConfiguration {
    search_nprobe?: number;
    ef_search?: number;
}
/**
 * Validate user provided collection configuration and embedding function. Returns a
 * CollectionConfiguration to be used in collection creation.
 */
declare const processCreateCollectionConfig: ({ configuration, embeddingFunction, metadata, }: {
    configuration?: CreateCollectionConfiguration;
    embeddingFunction?: EmbeddingFunction | null;
    metadata?: CollectionMetadata;
}) => Promise<CollectionConfiguration>;
/**
 *
 */
declare const processUpdateCollectionConfig: ({ collectionName, currentConfiguration, currentEmbeddingFunction, newConfiguration, }: {
    collectionName: string;
    currentConfiguration: CollectionConfiguration;
    currentEmbeddingFunction?: EmbeddingFunction;
    newConfiguration: UpdateCollectionConfiguration;
}) => Promise<{
    updateConfiguration?: UpdateCollectionConfiguration$1;
    updateEmbeddingFunction?: EmbeddingFunction;
}>;

/**
 * Configuration options for the ChromaClient.
 */
interface ChromaClientArgs {
    /** The host address of the Chroma server. Defaults to 'localhost' */
    host?: string;
    /** The port number of the Chroma server. Defaults to 8000 */
    port?: number;
    /** Whether to use SSL/HTTPS for connections. Defaults to false */
    ssl?: boolean;
    /** The tenant name in the Chroma server to connect to */
    tenant?: string;
    /** The database name to connect to */
    database?: string;
    /** Additional HTTP headers to send with requests */
    headers?: Record<string, string>;
    /** Additional fetch options for HTTP requests */
    fetchOptions?: RequestInit;
    /** @deprecated Use host, port, and ssl instead */
    path?: string;
    /** @deprecated */
    auth?: Record<string, string>;
}
/**
 * Main client class for interacting with ChromaDB.
 * Provides methods for managing collections and performing operations on them.
 */
declare class ChromaClient {
    private _tenant;
    private _database;
    private _preflightChecks;
    private readonly apiClient;
    /**
     * Creates a new ChromaClient instance.
     * @param args - Configuration options for the client
     */
    constructor(args?: Partial<ChromaClientArgs>);
    /**
     * Gets the current tenant name.
     * @returns The tenant name or undefined if not set
     */
    get tenant(): string | undefined;
    protected set tenant(tenant: string | undefined);
    /**
     * Gets the current database name.
     * @returns The database name or undefined if not set
     */
    get database(): string | undefined;
    protected set database(database: string | undefined);
    /**
     * Gets the preflight checks
     * @returns The preflight checks or undefined if not set
     */
    get preflightChecks(): ChecklistResponse | undefined;
    protected set preflightChecks(preflightChecks: ChecklistResponse | undefined);
    /** @ignore */
    _path(): Promise<{
        tenant: string;
        database: string;
    }>;
    /**
     * Gets the user identity information including tenant and accessible databases.
     * @returns Promise resolving to user identity data
     */
    getUserIdentity(): Promise<UserIdentity>;
    /**
     * Sends a heartbeat request to check server connectivity.
     * @returns Promise resolving to the server's nanosecond heartbeat timestamp
     */
    heartbeat(): Promise<number>;
    /**
     * Lists all collections in the current database.
     * @param args - Optional pagination parameters
     * @param args.limit - Maximum number of collections to return (default: 100)
     * @param args.offset - Number of collections to skip (default: 0)
     * @returns Promise resolving to an array of Collection instances
     */
    listCollections(args?: Partial<{
        limit: number;
        offset: number;
    }>): Promise<Collection[]>;
    /**
     * Gets the total number of collections in the current database.
     * @returns Promise resolving to the collection count
     */
    countCollections(): Promise<number>;
    /**
     * Creates a new collection with the specified configuration.
     * @param options - Collection creation options
     * @param options.name - The name of the collection
     * @param options.configuration - Optional collection configuration
     * @param options.metadata - Optional metadata for the collection
     * @param options.embeddingFunction - Optional embedding function to use. Defaults to `DefaultEmbeddingFunction` from @chroma-core/default-embed
     * @returns Promise resolving to the created Collection instance
     * @throws Error if a collection with the same name already exists
     */
    createCollection({ name, configuration, metadata, embeddingFunction, }: {
        name: string;
        configuration?: CreateCollectionConfiguration;
        metadata?: CollectionMetadata;
        embeddingFunction?: EmbeddingFunction | null;
    }): Promise<Collection>;
    /**
     * Retrieves an existing collection by name.
     * @param options - Collection retrieval options
     * @param options.name - The name of the collection to retrieve
     * @param options.embeddingFunction - Optional embedding function. Should match the one used to create the collection.
     * @returns Promise resolving to the Collection instance
     * @throws Error if the collection does not exist
     */
    getCollection({ name, embeddingFunction, }: {
        name: string;
        embeddingFunction?: EmbeddingFunction;
    }): Promise<Collection>;
    /**
     * Retrieves multiple collections by name.
     * @param items - Array of collection names or objects with name and optional embedding function (should match the ones used to create the collections)
     * @returns Promise resolving to an array of Collection instances
     */
    getCollections(items: string[] | {
        name: string;
        embeddingFunction?: EmbeddingFunction;
    }[]): Promise<Collection[]>;
    /**
     * Gets an existing collection or creates it if it doesn't exist.
     * @param options - Collection options
     * @param options.name - The name of the collection
     * @param options.configuration - Optional collection configuration (used only if creating)
     * @param options.metadata - Optional metadata for the collection (used only if creating)
     * @param options.embeddingFunction - Optional embedding function to use
     * @returns Promise resolving to the Collection instance
     */
    getOrCreateCollection({ name, configuration, metadata, embeddingFunction, }: {
        name: string;
        configuration?: CreateCollectionConfiguration;
        metadata?: CollectionMetadata;
        embeddingFunction?: EmbeddingFunction | null;
    }): Promise<Collection>;
    /**
     * Deletes a collection and all its data.
     * @param options - Deletion options
     * @param options.name - The name of the collection to delete
     */
    deleteCollection({ name }: {
        name: string;
    }): Promise<void>;
    /**
     * Resets the entire database, deleting all collections and data.
     * @returns Promise that resolves when the reset is complete
     * @warning This operation is irreversible and will delete all data
     */
    reset(): Promise<void>;
    /**
     * Gets the version of the Chroma server.
     * @returns Promise resolving to the server version string
     */
    version(): Promise<string>;
    /**
     * Gets the preflight checks
     * @returns Promise resolving to the preflight checks
     */
    getPreflightChecks(): Promise<ChecklistResponse>;
    /**
     * Gets the max batch size
     * @returns Promise resolving to the max batch size
     */
    getMaxBatchSize(): Promise<number>;
    /**
     * Gets whether base64_encoding is supported by the connected server
     * @returns Promise resolving to whether base64_encoding is supported
     */
    supportsBase64Encoding(): Promise<boolean>;
}

/**
 * Interface for collection operations using collection ID.
 * Provides methods for adding, querying, updating, and deleting records.
 */
interface Collection {
    /** Unique identifier for the collection */
    id: string;
    /** Name of the collection */
    name: string;
    /** Collection-level metadata */
    metadata: CollectionMetadata | undefined;
    /** Collection configuration settings */
    configuration: CollectionConfiguration;
    /** Optional embedding function. Must match the one used to create the collection. */
    embeddingFunction?: EmbeddingFunction;
    /** Gets the total number of records in the collection */
    count(): Promise<number>;
    /**
     * Adds new records to the collection.
     * @param args - Record data to add
     */
    add(args: {
        /** Unique identifiers for the records */
        ids: string[];
        /** Optional pre-computed embeddings */
        embeddings?: number[][];
        /** Optional metadata for each record */
        metadatas?: Metadata[];
        /** Optional document text (will be embedded if embeddings not provided) */
        documents?: string[];
        /** Optional URIs for the records */
        uris?: string[];
    }): Promise<void>;
    /**
     * Retrieves records from the collection based on filters.
     * @template TMeta - Type of metadata for type safety
     * @param args - Query parameters for filtering records
     * @returns Promise resolving to matching records
     */
    get<TMeta extends Metadata = Metadata>(args?: {
        /** Specific record IDs to retrieve */
        ids?: string[];
        /** Metadata-based filtering conditions */
        where?: Where;
        /** Maximum number of records to return */
        limit?: number;
        /** Number of records to skip */
        offset?: number;
        /** Document content-based filtering conditions */
        whereDocument?: WhereDocument;
        /** Fields to include in the response */
        include?: Include[];
    }): Promise<GetResult<TMeta>>;
    /**
     * Retrieves a preview of records from the collection.
     * @param args - Preview options
     * @returns Promise resolving to a sample of records
     */
    peek(args: {
        limit?: number;
    }): Promise<GetResult>;
    /**
     * Performs similarity search on the collection.
     * @template TMeta - Type of metadata for type safety
     * @param args - Query parameters for similarity search
     * @returns Promise resolving to similar records ranked by distance
     */
    query<TMeta extends Metadata = Metadata>(args: {
        /** Pre-computed query embedding vectors */
        queryEmbeddings?: number[][];
        /** Query text to be embedded and searched */
        queryTexts?: string[];
        /** Query URIs to be processed */
        queryURIs?: string[];
        /** Filter to specific record IDs */
        ids?: string[];
        /** Maximum number of results per query (default: 10) */
        nResults?: number;
        /** Metadata-based filtering conditions */
        where?: Where;
        /** Full-text search conditions */
        whereDocument?: WhereDocument;
        /** Fields to include in the response */
        include?: Include[];
    }): Promise<QueryResult<TMeta>>;
    /**
     * Modifies collection properties like name, metadata, or configuration.
     * @param args - Properties to update
     */
    modify(args: {
        /** New name for the collection */
        name?: string;
        /** New metadata for the collection */
        metadata?: CollectionMetadata;
        /** New configuration settings */
        configuration?: UpdateCollectionConfiguration;
    }): Promise<void>;
    /**
     * Creates a copy of the collection with a new name.
     * @param args - Fork options
     * @returns Promise resolving to the new Collection instance
     */
    fork({ name }: {
        name: string;
    }): Promise<Collection>;
    /**
     * Updates existing records in the collection.
     * @param args - Record data to update
     */
    update(args: {
        /** IDs of records to update */
        ids: string[];
        /** New embedding vectors */
        embeddings?: number[][];
        /** New metadata */
        metadatas?: Metadata[];
        /** New document text */
        documents?: string[];
        /** New URIs */
        uris?: string[];
    }): Promise<void>;
    /**
     * Inserts new records or updates existing ones (upsert operation).
     * @param args - Record data to upsert
     */
    upsert(args: {
        /** IDs of records to upsert */
        ids: string[];
        /** Embedding vectors */
        embeddings?: number[][];
        /** Metadata */
        metadatas?: Metadata[];
        /** Document text */
        documents?: string[];
        /** URIs */
        uris?: string[];
    }): Promise<void>;
    /**
     * Deletes records from the collection based on filters.
     * @param args - Deletion criteria
     */
    delete(args: {
        /** Specific record IDs to delete */
        ids?: string[];
        /** Metadata-based filtering for deletion */
        where?: Where;
        /** Document content-based filtering for deletion */
        whereDocument?: WhereDocument;
    }): Promise<void>;
}

declare function withChroma(userNextConfig?: any): any;

/**
 * Configuration options for the AdminClient.
 */
interface AdminClientArgs {
    /** The host address of the Chroma server */
    host: string;
    /** The port number of the Chroma server */
    port: number;
    /** Whether to use SSL/HTTPS for connections */
    ssl: boolean;
    /** Additional HTTP headers to send with requests */
    headers?: Record<string, string>;
    /** Additional fetch options for HTTP requests */
    fetchOptions?: RequestInit;
}
/**
 * Arguments for listing databases within a tenant.
 */
interface ListDatabasesArgs {
    /** The tenant name to list databases for */
    tenant: string;
    /** Maximum number of databases to return (default: 100) */
    limit?: number;
    /** Number of databases to skip (default: 0) */
    offset?: number;
}
/**
 * Administrative client for managing ChromaDB tenants and databases.
 * Provides methods for creating, deleting, and listing tenants and databases.
 */
declare class AdminClient {
    private readonly apiClient;
    /**
     * Creates a new AdminClient instance.
     * @param args - Optional configuration for the admin client
     */
    constructor(args?: AdminClientArgs);
    /**
     * Creates a new database within a tenant.
     * @param options - Database creation options
     * @param options.name - Name of the database to create
     * @param options.tenant - Tenant that will own the database
     */
    createDatabase({ name, tenant, }: {
        name: string;
        tenant: string;
    }): Promise<void>;
    /**
     * Retrieves information about a specific database.
     * @param options - Database retrieval options
     * @param options.name - Name of the database to retrieve
     * @param options.tenant - Tenant that owns the database
     * @returns Promise resolving to database information
     */
    getDatabase({ name, tenant, }: {
        name: string;
        tenant: string;
    }): Promise<Database>;
    /**
     * Deletes a database and all its data.
     * @param options - Database deletion options
     * @param options.name - Name of the database to delete
     * @param options.tenant - Tenant that owns the database
     * @warning This operation is irreversible and will delete all data
     */
    deleteDatabase({ name, tenant, }: {
        name: string;
        tenant: string;
    }): Promise<void>;
    /**
     * Lists all databases within a tenant.
     * @param args - Listing parameters including tenant and pagination
     * @returns Promise resolving to an array of database information
     */
    listDatabases(args: ListDatabasesArgs): Promise<Database[]>;
    /**
     * Creates a new tenant.
     * @param options - Tenant creation options
     * @param options.name - Name of the tenant to create
     */
    createTenant({ name }: {
        name: string;
    }): Promise<void>;
    /**
     * Retrieves information about a specific tenant.
     * @param options - Tenant retrieval options
     * @param options.name - Name of the tenant to retrieve
     * @returns Promise resolving to the tenant name
     */
    getTenant({ name }: {
        name: string;
    }): Promise<string>;
}

/**
 * ChromaDB cloud client for connecting to hosted Chroma instances.
 * Extends ChromaClient with cloud-specific authentication and configuration.
 */
declare class CloudClient extends ChromaClient {
    /**
     * Creates a new CloudClient instance for Chroma Cloud.
     * @param args - Cloud client configuration options
     */
    constructor(args?: Partial<{
        /** API key for authentication (or set CHROMA_API_KEY env var) */
        apiKey?: string;
        /** Tenant name for multi-tenant deployments */
        tenant?: string;
        /** Database name to connect to */
        database?: string;
        /** Additional fetch options for HTTP requests */
        fetchOptions?: RequestInit;
    }>);
}
/**
 * Admin client for Chroma Cloud administrative operations.
 * Extends AdminClient with cloud-specific authentication.
 */
declare class AdminCloudClient extends AdminClient {
    /**
     * Creates a new AdminCloudClient instance for cloud admin operations.
     * @param args - Admin cloud client configuration options
     */
    constructor(args?: Partial<{
        /** API key for authentication (or set CHROMA_API_KEY env var) */
        apiKey?: string;
        /** Additional fetch options for HTTP requests */
        fetchOptions?: RequestInit;
    }>);
}

/**
 * This is a generic Chroma error.
 */
declare class ChromaError extends Error {
    readonly cause?: unknown | undefined;
    constructor(name: string, message: string, cause?: unknown | undefined);
}
/**
 * Indicates that there was a problem with the connection to the Chroma server (e.g. the server is down or the client is not connected to the internet)
 */
declare class ChromaConnectionError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
/** Indicates that the server encountered an error while handling the request. */
declare class ChromaServerError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
/** Indicate that there was an issue with the request that the client made. */
declare class ChromaClientError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
/** The request lacked valid authentication. */
declare class ChromaUnauthorizedError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
/** The user does not have permission to access the requested resource. */
declare class ChromaForbiddenError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
declare class ChromaNotFoundError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
declare class ChromaValueError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
declare class InvalidCollectionError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
declare class InvalidArgumentError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
declare class ChromaUniqueError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
declare class ChromaQuotaExceededError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
declare class ChromaRateLimitError extends Error {
    readonly cause?: unknown | undefined;
    name: string;
    constructor(message: string, cause?: unknown | undefined);
}
declare function createErrorByType(type: string, message: string): InvalidCollectionError | InvalidArgumentError | undefined;

export { AdminClient, type AdminClientArgs, AdminCloudClient, type BaseRecordSet, ChromaClient, type ChromaClientArgs, ChromaClientError, ChromaConnectionError, ChromaError, ChromaForbiddenError, ChromaNotFoundError, ChromaQuotaExceededError, ChromaRateLimitError, ChromaServerError, ChromaUnauthorizedError, ChromaUniqueError, ChromaValueError, CloudClient, type Collection, type CollectionConfiguration, type CollectionMetadata, type CreateCollectionConfiguration, type EmbeddingFunction, type EmbeddingFunctionClass, type EmbeddingFunctionSpace, GetResult, type HNSWConfiguration, IncludeEnum, InvalidArgumentError, InvalidCollectionError, type ListDatabasesArgs, type Metadata, type PreparedInsertRecordSet, type PreparedRecordSet, type QueryRecordSet, QueryResult, type QueryRowResult, type RecordSet, type UpdateCollectionConfiguration, type UpdateHNSWConfiguration, type UpdateSPANNConfiguration, type UserIdentity, type Where, type WhereDocument, baseRecordSetFields, createErrorByType, getDefaultEFConfig, getEmbeddingFunction, knownEmbeddingFunctions, processCreateCollectionConfig, processUpdateCollectionConfig, recordSetFields, registerEmbeddingFunction, serializeEmbeddingFunction, withChroma };
