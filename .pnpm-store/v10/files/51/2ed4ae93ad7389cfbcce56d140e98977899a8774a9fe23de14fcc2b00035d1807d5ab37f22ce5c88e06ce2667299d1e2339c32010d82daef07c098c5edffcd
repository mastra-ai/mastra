"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventingFunctionManager = exports.EventingState = exports.EventingFunctionState = exports.EventingFunction = exports.EventingFunctionSettings = exports.EventingFunctionConstantBinding = exports.EventingFunctionUrlBinding = exports.EventingFunctionUrlAuthBearer = exports.EventingFunctionUrlAuthDigest = exports.EventingFunctionUrlAuthBasic = exports.EventingFunctionBucketBinding = exports.EventingFunctionKeyspace = exports.EventingFunctionUrlAuthMethod = exports.EventingFunctionBucketAccess = exports.EventingFunctionLogLevel = exports.EventingFunctionLanguageCompatibility = exports.EventingFunctionStatus = exports.EventingFunctionProcessingStatus = exports.EventingFunctionDeploymentStatus = exports.EventingFunctionDcpBoundary = void 0;
const utilities_1 = require("./utilities");
const bindingutilities_1 = require("./bindingutilities");
const errs = __importStar(require("./errors"));
/**
 * Represents the various dcp boundary options for eventing functions.
 *
 * @category Management
 */
var EventingFunctionDcpBoundary;
(function (EventingFunctionDcpBoundary) {
    /**
     * Indicates all documents should be processed by the function.
     */
    EventingFunctionDcpBoundary["Everything"] = "everything";
    /**
     * Indicates that only documents modified after a function is created
     * should be processed by the function.
     */
    EventingFunctionDcpBoundary["FromNow"] = "from_now";
})(EventingFunctionDcpBoundary || (exports.EventingFunctionDcpBoundary = EventingFunctionDcpBoundary = {}));
/**
 * Represents the various possible deployment statuses for an eventing function.
 *
 * @category Management
 */
var EventingFunctionDeploymentStatus;
(function (EventingFunctionDeploymentStatus) {
    /**
     * Indicates that the function is deployed.
     */
    EventingFunctionDeploymentStatus["Deployed"] = "deployed";
    /**
     * Indicates that the function has not yet been deployed.
     */
    EventingFunctionDeploymentStatus["Undeployed"] = "undeployed";
})(EventingFunctionDeploymentStatus || (exports.EventingFunctionDeploymentStatus = EventingFunctionDeploymentStatus = {}));
/**
 * Represents the various possible processing statuses for an eventing function.
 *
 * @category Management
 */
var EventingFunctionProcessingStatus;
(function (EventingFunctionProcessingStatus) {
    /**
     * Indicates that the eventing function is currently running.
     */
    EventingFunctionProcessingStatus["Running"] = "running";
    /**
     * Indicates that the eventing function is currently paused.
     */
    EventingFunctionProcessingStatus["Paused"] = "paused";
})(EventingFunctionProcessingStatus || (exports.EventingFunctionProcessingStatus = EventingFunctionProcessingStatus = {}));
/**
 * Represents the authentication method to use for a URL binding.
 *
 * @category Management
 */
var EventingFunctionStatus;
(function (EventingFunctionStatus) {
    /**
     * Indicates that the eventing function is undeployed.
     */
    EventingFunctionStatus["Undeployed"] = "undeployed";
    /**
     * Indicates that the eventing function is deploying.
     */
    EventingFunctionStatus["Deploying"] = "deploying";
    /**
     * Indicates that the eventing function is deployed.
     */
    EventingFunctionStatus["Deployed"] = "deployed";
    /**
     * Indicates that the eventing function is undeploying.
     */
    EventingFunctionStatus["Undeploying"] = "undeploying";
    /**
     * Indicates that the eventing function is paused.
     */
    EventingFunctionStatus["Paused"] = "paused";
    /**
     * Indicates that the eventing function is pausing.
     */
    EventingFunctionStatus["Pausing"] = "pausing";
})(EventingFunctionStatus || (exports.EventingFunctionStatus = EventingFunctionStatus = {}));
/**
 * Represents the language compatibility levels of an eventing function.
 *
 * @category Management
 */
var EventingFunctionLanguageCompatibility;
(function (EventingFunctionLanguageCompatibility) {
    /**
     * Indicates that the function should run with compatibility with
     * Couchbase Server 6.0.0.
     */
    EventingFunctionLanguageCompatibility["Version_6_0_0"] = "6.0.0";
    /**
     * Indicates that the function should run with compatibility with
     * Couchbase Server 6.5.0.
     */
    EventingFunctionLanguageCompatibility["Version_6_5_0"] = "6.5.0";
    /**
     * Indicates that the function should run with compatibility with
     * Couchbase Server 6.6.2.
     */
    EventingFunctionLanguageCompatibility["Version_6_6_2"] = "6.6.2";
    /**
     * Indicates that the function should run with compatibility with
     * Couchbase Server 7.2.0.
     */
    EventingFunctionLanguageCompatibility["Version_7_2_0"] = "7.2.0";
})(EventingFunctionLanguageCompatibility || (exports.EventingFunctionLanguageCompatibility = EventingFunctionLanguageCompatibility = {}));
/**
 * Represents the various log levels for an eventing function.
 *
 * @category Management
 */
var EventingFunctionLogLevel;
(function (EventingFunctionLogLevel) {
    /**
     * Indicates to use INFO level logging.
     */
    EventingFunctionLogLevel["Info"] = "INFO";
    /**
     * Indicates to use ERROR level logging.
     */
    EventingFunctionLogLevel["Error"] = "ERROR";
    /**
     * Indicates to use WARNING level logging.
     */
    EventingFunctionLogLevel["Warning"] = "WARNING";
    /**
     * Indicates to use DEBUG level logging.
     */
    EventingFunctionLogLevel["Debug"] = "DEBUG";
    /**
     * Indicates to use TRACE level logging.
     */
    EventingFunctionLogLevel["Trace"] = "TRACE";
})(EventingFunctionLogLevel || (exports.EventingFunctionLogLevel = EventingFunctionLogLevel = {}));
/**
 * Represents the various bucket access levels for an eventing function.
 *
 * @category Management
 */
var EventingFunctionBucketAccess;
(function (EventingFunctionBucketAccess) {
    /**
     * Indicates that the function can only read the associated bucket.
     */
    EventingFunctionBucketAccess["ReadOnly"] = "r";
    /**
     * Indicates that the function can both read and write the associated bucket.
     */
    EventingFunctionBucketAccess["ReadWrite"] = "rw";
})(EventingFunctionBucketAccess || (exports.EventingFunctionBucketAccess = EventingFunctionBucketAccess = {}));
/**
 * Represents the authentication method to use for a URL binding.
 *
 * @category Management
 */
var EventingFunctionUrlAuthMethod;
(function (EventingFunctionUrlAuthMethod) {
    /**
     * Indicates that no authentication should be used.
     */
    EventingFunctionUrlAuthMethod["None"] = "no-auth";
    /**
     * Indicates that Basic should be used.
     */
    EventingFunctionUrlAuthMethod["Basic"] = "basic";
    /**
     * Indicates that Digest should be used.
     */
    EventingFunctionUrlAuthMethod["Digest"] = "digest";
    /**
     * Indicates that Bearer should be used.
     */
    EventingFunctionUrlAuthMethod["Bearer"] = "bearer";
})(EventingFunctionUrlAuthMethod || (exports.EventingFunctionUrlAuthMethod = EventingFunctionUrlAuthMethod = {}));
/**
 * Specifies the bucket/scope/collection used by an eventing function.
 *
 * @category Management
 */
class EventingFunctionKeyspace {
    constructor(v) {
        this.bucket = v.bucket;
        this.scope = v.scope;
        this.collection = v.collection;
    }
}
exports.EventingFunctionKeyspace = EventingFunctionKeyspace;
/**
 * Specifies a bucket binding for an eventing function.
 *
 * @category Management
 */
class EventingFunctionBucketBinding {
    constructor(v) {
        this.alias = v.alias;
        this.name = v.name;
        this.access = v.access;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new EventingFunctionBucketBinding({
            alias: data.alias,
            name: new EventingFunctionKeyspace({
                bucket: data.name.bucket,
                scope: data.name.scope,
                collection: data.name.collection,
            }),
            access: (0, bindingutilities_1.eventingBucketBindingAccessFromCpp)(data.access),
        });
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        return {
            alias: data.alias,
            name: {
                bucket: data.name.bucket,
                scope: data.name.scope,
                collection: data.name.collection,
            },
            access: (0, bindingutilities_1.eventingBucketBindingAccessToCpp)(data.access),
        };
    }
}
exports.EventingFunctionBucketBinding = EventingFunctionBucketBinding;
/**
 * Specifies that Basic authentication should be used for the URL.
 *
 * @category Management
 */
class EventingFunctionUrlAuthBasic {
    constructor(v) {
        /**
         * Sets the auth method to Basic.
         */
        this.method = EventingFunctionUrlAuthMethod.Basic;
        this.username = v.username;
        this.password = v.password;
    }
}
exports.EventingFunctionUrlAuthBasic = EventingFunctionUrlAuthBasic;
/**
 * Specifies that Digest authentication should be used for the URL.
 *
 * @category Management
 */
class EventingFunctionUrlAuthDigest {
    constructor(v) {
        /**
         * Sets the auth method to Digest.
         */
        this.method = EventingFunctionUrlAuthMethod.Digest;
        this.username = v.username;
        this.password = v.password;
    }
}
exports.EventingFunctionUrlAuthDigest = EventingFunctionUrlAuthDigest;
/**
 * Specifies that Bearer authentication should be used for the URL.
 *
 * @category Management
 */
class EventingFunctionUrlAuthBearer {
    constructor(v) {
        /**
         * Sets the auth method to Bearer.
         */
        this.method = EventingFunctionUrlAuthMethod.Bearer;
        this.key = v.key;
    }
}
exports.EventingFunctionUrlAuthBearer = EventingFunctionUrlAuthBearer;
/**
 * Specifies a url binding for an eventing function.
 *
 * @category Management
 */
class EventingFunctionUrlBinding {
    constructor(v) {
        this.hostname = v.hostname;
        this.alias = v.alias;
        this.auth = v.auth;
        this.allowCookies = v.allowCookies;
        this.validateSslCertificate = v.validateSslCertificate;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        let authObj;
        if (data.auth_name === 'function_url_no_auth') {
            authObj = undefined;
        }
        else if (data.auth_name === 'function_url_auth_basic') {
            authObj = new EventingFunctionUrlAuthBasic({
                username: data.auth_value
                    .username,
                password: data.auth_value
                    .password,
            });
        }
        else if (data.auth_name === 'function_url_auth_digest') {
            authObj = new EventingFunctionUrlAuthDigest({
                username: data.auth_value.username,
                password: data.auth_value.password,
            });
        }
        else if (data.auth_name === 'function_url_auth_bearer') {
            authObj = new EventingFunctionUrlAuthBearer({
                key: data.auth_value
                    .key,
            });
        }
        else {
            throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionUrlBinding: ' + data.auth_name));
        }
        return {
            hostname: data.hostname,
            alias: data.alias,
            allowCookies: data.allow_cookies,
            validateSslCertificate: data.validate_ssl_certificate,
            auth: authObj,
        };
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        let authObj;
        let auth_name;
        if (!data.auth || data.auth.method === EventingFunctionUrlAuthMethod.None) {
            authObj = {};
            auth_name = 'function_url_no_auth';
        }
        else if (data.auth.method === EventingFunctionUrlAuthMethod.Basic) {
            authObj = {
                username: data.auth.username,
                password: data.auth.password,
            };
            auth_name = 'function_url_auth_basic';
        }
        else if (data.auth.method === EventingFunctionUrlAuthMethod.Digest) {
            authObj = {
                username: data.auth.username,
                password: data.auth.password,
            };
            auth_name = 'function_url_auth_digest';
        }
        else if (data.auth.method === EventingFunctionUrlAuthMethod.Bearer) {
            authObj = {
                key: data.auth.key,
            };
            auth_name = 'function_url_auth_bearer';
        }
        else {
            throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionUrlBinding'));
        }
        return {
            alias: data.alias,
            hostname: data.hostname,
            allow_cookies: data.allowCookies,
            validate_ssl_certificate: data.validateSslCertificate,
            auth_name: auth_name,
            auth_value: authObj,
        };
    }
}
exports.EventingFunctionUrlBinding = EventingFunctionUrlBinding;
/**
 * Specifies a constant binding for an eventing function.
 *
 * @category Management
 */
class EventingFunctionConstantBinding {
    constructor(v) {
        this.alias = v.alias;
        this.literal = v.literal;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new EventingFunctionConstantBinding({
            alias: data.alias,
            literal: data.literal,
        });
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        return {
            alias: data.alias,
            literal: data.literal,
        };
    }
}
exports.EventingFunctionConstantBinding = EventingFunctionConstantBinding;
/**
 * Specifies a number of options which can be used when updating or creating
 * a eventing function.
 *
 * @category Management
 */
class EventingFunctionSettings {
    constructor(v) {
        this.cppWorkerThreadCount = v.cppWorkerThreadCount;
        this.dcpStreamBoundary = v.dcpStreamBoundary;
        this.description = v.description;
        this.deploymentStatus = v.deploymentStatus;
        this.processingStatus = v.processingStatus;
        this.languageCompatibility = v.languageCompatibility;
        this.logLevel = v.logLevel;
        this.executionTimeout = v.executionTimeout;
        this.lcbInstCapacity = v.lcbInstCapacity;
        this.lcbRetryCount = v.lcbRetryCount;
        this.lcbTimeout = v.lcbTimeout;
        this.queryConsistency = v.queryConsistency;
        this.numTimerPartitions = v.numTimerPartitions;
        this.sockBatchSize = v.sockBatchSize;
        this.tickDuration = v.tickDuration;
        this.timerContextSize = v.timerContextSize;
        this.userPrefix = v.userPrefix;
        this.bucketCacheSize = v.bucketCacheSize;
        this.bucketCacheAge = v.bucketCacheAge;
        this.curlMaxAllowedRespSize = v.curlMaxAllowedRespSize;
        this.queryPrepareAll = v.queryPrepareAll;
        this.workerCount = v.workerCount;
        this.handlerHeaders = v.handlerHeaders;
        this.handlerFooters = v.handlerFooters;
        this.enableAppLogRotation = v.enableAppLogRotation;
        this.appLogDir = v.appLogDir;
        this.appLogMaxSize = v.appLogMaxSize;
        this.appLogMaxFiles = v.appLogMaxFiles;
        this.checkpointInterval = v.checkpointInterval;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new EventingFunctionSettings({
            cppWorkerThreadCount: data.cpp_worker_count,
            dcpStreamBoundary: (0, bindingutilities_1.eventingFunctionDcpBoundaryFromCpp)(data.dcp_stream_boundary),
            description: data.description,
            deploymentStatus: (0, bindingutilities_1.eventingFunctionDeploymentStatusFromCpp)(data.deployment_status),
            processingStatus: (0, bindingutilities_1.eventingFunctionProcessingStatusFromCpp)(data.processing_status),
            logLevel: (0, bindingutilities_1.eventingFunctionLogLevelFromCpp)(data.log_level),
            languageCompatibility: (0, bindingutilities_1.eventingFunctionLanguageCompatibilityFromCpp)(data.language_compatibility),
            executionTimeout: data.execution_timeout,
            lcbInstCapacity: data.lcb_inst_capacity,
            lcbRetryCount: data.lcb_retry_count,
            lcbTimeout: data.lcb_timeout,
            queryConsistency: (0, bindingutilities_1.queryScanConsistencyFromCpp)(data.query_consistency),
            numTimerPartitions: data.num_timer_partitions,
            sockBatchSize: data.sock_batch_size,
            tickDuration: data.tick_duration,
            timerContextSize: data.timer_context_size,
            userPrefix: data.user_prefix,
            bucketCacheSize: data.bucket_cache_size,
            bucketCacheAge: data.bucket_cache_age,
            curlMaxAllowedRespSize: data.curl_max_allowed_resp_size,
            queryPrepareAll: data.query_prepare_all,
            workerCount: data.worker_count,
            handlerHeaders: data.handler_headers,
            handlerFooters: data.handler_footers,
            enableAppLogRotation: data.enable_app_log_rotation,
            appLogDir: data.app_log_dir,
            appLogMaxSize: data.app_log_max_size,
            appLogMaxFiles: data.app_log_max_files,
            checkpointInterval: data.checkpoint_interval,
        });
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        var _a, _b;
        if (!data) {
            return {
                handler_headers: [],
                handler_footers: [],
            };
        }
        return {
            cpp_worker_count: data.cppWorkerThreadCount,
            dcp_stream_boundary: (0, bindingutilities_1.eventingFunctionDcpBoundaryToCpp)(data.dcpStreamBoundary),
            description: data.description,
            deployment_status: (0, bindingutilities_1.eventingFunctionDeploymentStatusToCpp)(data.deploymentStatus),
            processing_status: (0, bindingutilities_1.eventingFunctionProcessingStatusToCpp)(data.processingStatus),
            log_level: (0, bindingutilities_1.eventingFunctionLogLevelToCpp)(data.logLevel),
            language_compatibility: (0, bindingutilities_1.eventingFunctionLanguageCompatibilityToCpp)(data.languageCompatibility),
            execution_timeout: data.executionTimeout,
            lcb_inst_capacity: data.lcbInstCapacity,
            lcb_retry_count: data.lcbRetryCount,
            lcb_timeout: data.lcbTimeout,
            query_consistency: (0, bindingutilities_1.queryScanConsistencyToCpp)(data.queryConsistency),
            num_timer_partitions: data.numTimerPartitions,
            sock_batch_size: data.sockBatchSize,
            tick_duration: data.tickDuration,
            timer_context_size: data.timerContextSize,
            user_prefix: data.userPrefix,
            bucket_cache_size: data.bucketCacheSize,
            bucket_cache_age: data.bucketCacheAge,
            curl_max_allowed_resp_size: data.curlMaxAllowedRespSize,
            query_prepare_all: data.queryPrepareAll,
            worker_count: data.workerCount,
            handler_headers: (_a = data.handlerHeaders) !== null && _a !== void 0 ? _a : [],
            handler_footers: (_b = data.handlerFooters) !== null && _b !== void 0 ? _b : [],
            enable_app_log_rotation: data.enableAppLogRotation,
            app_log_dir: data.appLogDir,
            app_log_max_size: data.appLogMaxSize,
            app_log_max_files: data.appLogMaxFiles,
            checkpoint_interval: data.checkpointInterval,
        };
    }
}
exports.EventingFunctionSettings = EventingFunctionSettings;
/**
 * Describes an eventing function.
 *
 * @category Management
 */
class EventingFunction {
    constructor(v) {
        this.name = v.name;
        this.code = v.code;
        this.version = v.version;
        this.enforceSchema = v.enforceSchema;
        this.handlerUuid = v.handlerUuid;
        this.functionInstanceId = v.functionInstanceId;
        this.metadataKeyspace = v.metadataKeyspace;
        this.sourceKeyspace = v.sourceKeyspace;
        this.bucketBindings = v.bucketBindings;
        this.urlBindings = v.urlBindings;
        this.constantBindings = v.constantBindings;
        this.settings = v.settings;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new EventingFunction({
            name: data.name,
            code: data.code,
            metadataKeyspace: new EventingFunctionKeyspace({
                bucket: data.metadata_keyspace.bucket,
                scope: data.metadata_keyspace.scope,
                collection: data.metadata_keyspace.collection,
            }),
            sourceKeyspace: new EventingFunctionKeyspace({
                bucket: data.source_keyspace.bucket,
                scope: data.source_keyspace.scope,
                collection: data.source_keyspace.collection,
            }),
            version: data.version,
            enforceSchema: data.enforce_schema,
            handlerUuid: data.handler_uuid,
            functionInstanceId: data.function_instance_id,
            bucketBindings: data.bucket_bindings.map((bindingData) => EventingFunctionBucketBinding._fromCppData(bindingData)),
            urlBindings: data.url_bindings.map((bindingData) => EventingFunctionUrlBinding._fromCppData(bindingData)),
            constantBindings: data.constant_bindings.map((bindingData) => EventingFunctionConstantBinding._fromCppData(bindingData)),
            settings: EventingFunctionSettings._fromCppData(data.settings),
        });
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        return {
            name: data.name,
            code: data.code,
            metadata_keyspace: {
                bucket: data.metadataKeyspace.bucket,
                scope: data.metadataKeyspace.scope,
                collection: data.metadataKeyspace.collection,
            },
            source_keyspace: {
                bucket: data.sourceKeyspace.bucket,
                scope: data.sourceKeyspace.scope,
                collection: data.sourceKeyspace.collection,
            },
            version: data.version,
            enforce_schema: data.enforceSchema,
            handler_uuid: data.handlerUuid,
            function_instance_id: data.functionInstanceId,
            bucket_bindings: data.bucketBindings.map((binding) => EventingFunctionBucketBinding._toCppData(binding)),
            url_bindings: data.urlBindings.map((binding) => EventingFunctionUrlBinding._toCppData(binding)),
            constant_bindings: data.constantBindings.map((binding) => EventingFunctionConstantBinding._toCppData(binding)),
            settings: EventingFunctionSettings._toCppData(data.settings),
        };
    }
}
exports.EventingFunction = EventingFunction;
/**
 * Describes the current state of an eventing function.
 *
 * @category Management
 */
class EventingFunctionState {
    constructor(v) {
        this.name = v.name;
        this.status = v.status;
        this.numBootstrappingNodes = v.numBootstrappingNodes;
        this.numDeployedNodes = v.numDeployedNodes;
        this.deploymentStatus = v.deploymentStatus;
        this.processingStatus = v.processingStatus;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new EventingFunctionState({
            name: data.name,
            status: (0, bindingutilities_1.eventingFunctionStatusFromCpp)(data.status),
            numBootstrappingNodes: data.num_bootstrapping_nodes,
            numDeployedNodes: data.num_deployed_nodes,
            // deploymentStatus & processingStatus are required in the EventingFunctionState, and always set in the c++ interface, so asserting the type here.
            deploymentStatus: (0, bindingutilities_1.eventingFunctionDeploymentStatusFromCpp)(data.deployment_status),
            processingStatus: (0, bindingutilities_1.eventingFunctionProcessingStatusFromCpp)(data.processing_status),
        });
    }
}
exports.EventingFunctionState = EventingFunctionState;
/**
 * Describes the current state of all eventing function.
 *
 * @category Management
 */
class EventingState {
    constructor(v) {
        this.numEventingNodes = v.numEventingNodes;
        this.functions = v.functions;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new EventingState({
            numEventingNodes: data.num_eventing_nodes,
            functions: data.functions.map((functionData) => EventingFunctionState._fromCppData(functionData)),
        });
    }
}
exports.EventingState = EventingState;
/**
 * EventingFunctionManager provides an interface for managing the
 * eventing functions on the cluster.
 * Uncommitted: This API is subject to change in the future.
 *
 * @category Management
 */
class EventingFunctionManager {
    /**
     * @internal
     */
    constructor(cluster) {
        this._cluster = cluster;
    }
    /**
     * Creates or updates an eventing function.
     *
     * @param functionDefinition The description of the eventing function to upsert.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async upsertFunction(functionDefinition, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementEventingUpsertFunction({
                function: EventingFunction._toCppData(functionDefinition),
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Deletes an eventing function.
     *
     * @param name The name of the eventing function to delete.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async dropFunction(name, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementEventingDropFunction({
                name: name,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Fetches all eventing functions.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getAllFunctions(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementEventingGetAllFunctions({
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const functions = resp.functions.map((functionData) => EventingFunction._fromCppData(functionData));
                wrapCallback(null, functions);
            });
        }, callback);
    }
    /**
     * Fetches a specific eventing function.
     *
     * @param name The name of the eventing function to fetch.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getFunction(name, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementEventingGetFunction({
                name: name,
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const eventingFunction = EventingFunction._fromCppData(resp.function);
                wrapCallback(null, eventingFunction);
            });
        }, callback);
    }
    /**
     * Deploys an eventing function.
     *
     * @param name The name of the eventing function to deploy.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async deployFunction(name, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementEventingDeployFunction({
                name: name,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Undeploys an eventing function.
     *
     * @param name The name of the eventing function to undeploy.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async undeployFunction(name, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementEventingUndeployFunction({
                name: name,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Pauses an eventing function.
     *
     * @param name The name of the eventing function to pause.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async pauseFunction(name, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementEventingPauseFunction({
                name: name,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Resumes an eventing function.
     *
     * @param name The name of the eventing function to resume.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async resumeFunction(name, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementEventingResumeFunction({
                name: name,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Fetches the status of all eventing functions.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async functionsStatus(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementEventingGetStatus({
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const state = EventingState._fromCppData(resp.status);
                wrapCallback(null, state);
            });
        }, callback);
    }
}
exports.EventingFunctionManager = EventingFunctionManager;
