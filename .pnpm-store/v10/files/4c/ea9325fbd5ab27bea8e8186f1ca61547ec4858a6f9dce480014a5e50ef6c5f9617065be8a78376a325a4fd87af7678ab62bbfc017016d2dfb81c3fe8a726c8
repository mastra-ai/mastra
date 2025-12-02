/**
 * Represents the various service types available.
 */
export declare enum ServiceType {
    /**
     * The key-value service, responsible for data storage.
     */
    KeyValue = "kv",
    /**
     * The management service, responsible for managing the cluster.
     */
    Management = "mgmt",
    /**
     * The views service, responsible for views querying.
     */
    Views = "views",
    /**
     * The query service, responsible for N1QL querying.
     */
    Query = "query",
    /**
     * The search service, responsible for full-text search querying.
     */
    Search = "search",
    /**
     * The analytics service, responsible for analytics querying.
     */
    Analytics = "analytics",
    /**
     * The eventing service, responsible for event-driven actions.
     */
    Eventing = "eventing"
}
/**
 * Represents the durability level required for an operation.
 */
export declare enum DurabilityLevel {
    /**
     * Indicates that no durability is needed.
     */
    None = 0,
    /**
     * Indicates that mutations should be replicated to a majority of the
     * nodes in the cluster before the operation is marked as successful.
     */
    Majority = 1,
    /**
     * Indicates that mutations should be replicated to a majority of the
     * nodes in the cluster and persisted to the master node before the
     * operation is marked as successful.
     */
    MajorityAndPersistOnMaster = 2,
    /**
     * Indicates that mutations should be persisted to the majority of the
     * nodes in the cluster before the operation is marked as successful.
     */
    PersistToMajority = 3
}
/**
 * Represents the storage semantics to use for some types of operations.
 */
export declare enum StoreSemantics {
    /**
     * Indicates that replace semantics should be used.  This will replace
     * the document if it exists, and the operation will fail if the
     * document does not exist.
     */
    Replace = 0,
    /**
     * Indicates that upsert semantics should be used.  This will replace
     * the document if it exists, and create it if it does not.
     */
    Upsert = 1,
    /**
     * Indicates that insert semantics should be used.  This will insert
     * the document if it does not exist, and fail the operation if the
     * document already exists.
     */
    Insert = 2
}
/**
 * Represents the various scan consistency options that are available when
 * querying against the query service.
 */
export declare enum ReadPreference {
    /**
     * Indicates that filtering for replica set should not be enforced.
     */
    NoPreference = "no_preference",
    /**
     * Indicates that any nodes that do not belong to local group selected during
     * cluster instantiation using the `ConnectOptions.preferredServerGroup` option
     * should be excluded.
     */
    SelectedServerGroup = "selected_server_group"
}
