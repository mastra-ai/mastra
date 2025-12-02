"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadPreference = exports.StoreSemantics = exports.DurabilityLevel = exports.ServiceType = void 0;
/**
 * Represents the various service types available.
 */
var ServiceType;
(function (ServiceType) {
    /**
     * The key-value service, responsible for data storage.
     */
    ServiceType["KeyValue"] = "kv";
    /**
     * The management service, responsible for managing the cluster.
     */
    ServiceType["Management"] = "mgmt";
    /**
     * The views service, responsible for views querying.
     */
    ServiceType["Views"] = "views";
    /**
     * The query service, responsible for N1QL querying.
     */
    ServiceType["Query"] = "query";
    /**
     * The search service, responsible for full-text search querying.
     */
    ServiceType["Search"] = "search";
    /**
     * The analytics service, responsible for analytics querying.
     */
    ServiceType["Analytics"] = "analytics";
    /**
     * The eventing service, responsible for event-driven actions.
     */
    ServiceType["Eventing"] = "eventing";
})(ServiceType || (exports.ServiceType = ServiceType = {}));
/**
 * Represents the durability level required for an operation.
 */
var DurabilityLevel;
(function (DurabilityLevel) {
    /**
     * Indicates that no durability is needed.
     */
    DurabilityLevel[DurabilityLevel["None"] = 0] = "None";
    /**
     * Indicates that mutations should be replicated to a majority of the
     * nodes in the cluster before the operation is marked as successful.
     */
    DurabilityLevel[DurabilityLevel["Majority"] = 1] = "Majority";
    /**
     * Indicates that mutations should be replicated to a majority of the
     * nodes in the cluster and persisted to the master node before the
     * operation is marked as successful.
     */
    DurabilityLevel[DurabilityLevel["MajorityAndPersistOnMaster"] = 2] = "MajorityAndPersistOnMaster";
    /**
     * Indicates that mutations should be persisted to the majority of the
     * nodes in the cluster before the operation is marked as successful.
     */
    DurabilityLevel[DurabilityLevel["PersistToMajority"] = 3] = "PersistToMajority";
})(DurabilityLevel || (exports.DurabilityLevel = DurabilityLevel = {}));
/**
 * Represents the storage semantics to use for some types of operations.
 */
var StoreSemantics;
(function (StoreSemantics) {
    /**
     * Indicates that replace semantics should be used.  This will replace
     * the document if it exists, and the operation will fail if the
     * document does not exist.
     */
    StoreSemantics[StoreSemantics["Replace"] = 0] = "Replace";
    /**
     * Indicates that upsert semantics should be used.  This will replace
     * the document if it exists, and create it if it does not.
     */
    StoreSemantics[StoreSemantics["Upsert"] = 1] = "Upsert";
    /**
     * Indicates that insert semantics should be used.  This will insert
     * the document if it does not exist, and fail the operation if the
     * document already exists.
     */
    StoreSemantics[StoreSemantics["Insert"] = 2] = "Insert";
})(StoreSemantics || (exports.StoreSemantics = StoreSemantics = {}));
/**
 * Represents the various scan consistency options that are available when
 * querying against the query service.
 */
var ReadPreference;
(function (ReadPreference) {
    /**
     * Indicates that filtering for replica set should not be enforced.
     */
    ReadPreference["NoPreference"] = "no_preference";
    /**
     * Indicates that any nodes that do not belong to local group selected during
     * cluster instantiation using the `ConnectOptions.preferredServerGroup` option
     * should be excluded.
     */
    ReadPreference["SelectedServerGroup"] = "selected_server_group";
})(ReadPreference || (exports.ReadPreference = ReadPreference = {}));
