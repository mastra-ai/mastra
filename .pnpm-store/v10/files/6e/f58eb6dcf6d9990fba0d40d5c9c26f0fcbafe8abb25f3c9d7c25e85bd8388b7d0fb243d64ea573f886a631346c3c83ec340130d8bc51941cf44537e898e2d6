"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsIndexManager = exports.AzureExternalAnalyticsLink = exports.S3ExternalAnalyticsLink = exports.CouchbaseRemoteAnalyticsLink = exports.AnalyticsLink = exports.CouchbaseAnalyticsEncryptionSettings = exports.AnalyticsIndex = exports.AnalyticsDataset = exports.AnalyticsEncryptionLevel = exports.AnalyticsLinkType = void 0;
const errors_1 = require("./errors");
const bindingutilities_1 = require("./bindingutilities");
const utilities_1 = require("./utilities");
/**
 * Represents the type of an analytics link.
 *
 * @category Analytics
 */
var AnalyticsLinkType;
(function (AnalyticsLinkType) {
    /**
     * Indicates that the link is for S3.
     */
    AnalyticsLinkType["S3External"] = "s3";
    /**
     * Indicates that the link is for Azure.
     */
    AnalyticsLinkType["AzureBlobExternal"] = "azureblob";
    /**
     * Indicates that the link is for a remote Couchbase cluster.
     */
    AnalyticsLinkType["CouchbaseRemote"] = "couchbase";
})(AnalyticsLinkType || (exports.AnalyticsLinkType = AnalyticsLinkType = {}));
/**
 * Represents what level of encryption to use for analytics remote links.
 *
 * @category Analytics
 */
var AnalyticsEncryptionLevel;
(function (AnalyticsEncryptionLevel) {
    /**
     * Indicates that no encryption should be used.
     */
    AnalyticsEncryptionLevel["None"] = "none";
    /**
     * Indicates that half encryption should be used.
     */
    AnalyticsEncryptionLevel["Half"] = "half";
    /**
     * Indicates that full encryption should be used.
     */
    AnalyticsEncryptionLevel["Full"] = "full";
})(AnalyticsEncryptionLevel || (exports.AnalyticsEncryptionLevel = AnalyticsEncryptionLevel = {}));
/**
 * Contains a specific dataset configuration for the analytics service.
 *
 * @category Management
 */
class AnalyticsDataset {
    /**
     * @internal
     */
    constructor(data) {
        this.name = data.name;
        this.dataverseName = data.dataverseName;
        this.linkName = data.linkName;
        this.bucketName = data.bucketName;
    }
}
exports.AnalyticsDataset = AnalyticsDataset;
/**
 * Contains a specific index configuration for the analytics service.
 *
 * @category Management
 */
class AnalyticsIndex {
    /**
     * @internal
     */
    constructor(data) {
        this.name = data.name;
        this.datasetName = data.datasetName;
        this.dataverseName = data.dataverseName;
        this.isPrimary = data.isPrimary;
    }
}
exports.AnalyticsIndex = AnalyticsIndex;
/**
 * Includes information about an analytics remote links encryption.
 */
class CouchbaseAnalyticsEncryptionSettings {
    /**
     * @internal
     */
    constructor(data) {
        this.encryptionLevel = data.encryptionLevel;
        this.certificate = data.certificate;
        this.clientCertificate = data.clientCertificate;
        this.clientKey = data.clientKey;
    }
}
exports.CouchbaseAnalyticsEncryptionSettings = CouchbaseAnalyticsEncryptionSettings;
/**
 * This is a base class for specific link configurations for the analytics service.
 */
class AnalyticsLink {
    /**
     * @internal
     */
    constructor() {
        this.linkType = '';
        this.dataverse = '';
        this.name = '';
    }
    /**
     * @internal
     */
    static _toHttpData(data) {
        if (data.linkType === AnalyticsLinkType.CouchbaseRemote) {
            return CouchbaseRemoteAnalyticsLink._toHttpData(new CouchbaseRemoteAnalyticsLink(data));
        }
        else if (data.linkType === AnalyticsLinkType.S3External) {
            return S3ExternalAnalyticsLink._toHttpData(new S3ExternalAnalyticsLink(data));
        }
        else if (data.linkType === AnalyticsLinkType.AzureBlobExternal) {
            return AzureExternalAnalyticsLink._toHttpData(new AzureExternalAnalyticsLink(data));
        }
        else {
            throw new Error('invalid link type');
        }
    }
    /**
     * @internal
     */
    static _fromHttpData(data) {
        if (data.type === 'couchbase') {
            return CouchbaseRemoteAnalyticsLink._fromHttpData(data);
        }
        else if (data.type === 's3') {
            return S3ExternalAnalyticsLink._fromHttpData(data);
        }
        else if (data.type === 'azure') {
            return AzureExternalAnalyticsLink._fromHttpData(data);
        }
        else {
            throw new Error('invalid link type');
        }
    }
}
exports.AnalyticsLink = AnalyticsLink;
/**
 * Provides information about a analytics remote Couchbase link.
 */
class CouchbaseRemoteAnalyticsLink extends AnalyticsLink {
    /**
     * Validates the CouchbaseRemoteAnalyticsLink.
     */
    validate() {
        if (!this.dataverse) {
            throw new errors_1.InvalidArgumentError(new Error('Must provide a dataverse for the CouchbaseRemoteAnalyticsLink.'));
        }
        if (!this.name) {
            throw new errors_1.InvalidArgumentError(new Error('Must provide a name for the CouchbaseRemoteAnalyticsLink.'));
        }
        if (!this.hostname) {
            throw new errors_1.InvalidArgumentError(new Error('Must provide a hostname for the CouchbaseRemoteAnalyticsLink.'));
        }
        if (this.encryption) {
            if ([AnalyticsEncryptionLevel.None, AnalyticsEncryptionLevel.Half].includes(this.encryption.encryptionLevel)) {
                if (!this.username || !this.password) {
                    throw new errors_1.InvalidArgumentError(new Error('When encryption level is half or none, username and password must be set for the CouchbaseRemoteAnalyticsLink.'));
                }
            }
            else {
                if (!this.encryption.certificate ||
                    this.encryption.certificate.length == 0) {
                    throw new errors_1.InvalidArgumentError(new Error('When encryption level full, a certificate must be set for the CouchbaseRemoteAnalyticsLink.'));
                }
                const clientCertificateInvalid = !this.encryption.clientCertificate ||
                    this.encryption.clientCertificate.length == 0;
                const clientKeyInvalid = !this.encryption.clientKey || this.encryption.clientKey.length == 0;
                if (clientCertificateInvalid || clientKeyInvalid) {
                    throw new errors_1.InvalidArgumentError(new Error('When encryption level full, a client key and certificate must be set for the CouchbaseRemoteAnalyticsLink.'));
                }
            }
        }
    }
    /**
     * @internal
     */
    constructor(data) {
        super();
        this.linkType = AnalyticsLinkType.CouchbaseRemote;
        this.dataverse = data.dataverse;
        this.name = data.name;
        this.hostname = data.hostname;
        this.encryption = data.encryption;
        this.username = data.username;
        this.password = data.password;
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        data.validate();
        return {
            link_name: data.name,
            dataverse: data.dataverse,
            hostname: data.hostname,
            username: data.hostname,
            password: data.password,
            encryption: (0, bindingutilities_1.encryptionSettingsToCpp)(data.encryption),
        };
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new CouchbaseRemoteAnalyticsLink({
            linkType: AnalyticsLinkType.CouchbaseRemote,
            dataverse: data.dataverse,
            name: data.link_name,
            hostname: data.hostname,
            encryption: (0, bindingutilities_1.encryptionSettingsFromCpp)(data.encryption),
            username: data.username,
            password: undefined,
        });
    }
}
exports.CouchbaseRemoteAnalyticsLink = CouchbaseRemoteAnalyticsLink;
/**
 * Provides information about a analytics remote S3 link.
 */
class S3ExternalAnalyticsLink extends AnalyticsLink {
    /**
     * @internal
     */
    constructor(data) {
        super();
        this.linkType = AnalyticsLinkType.S3External;
        this.dataverse = data.dataverse;
        this.name = data.name;
        this.accessKeyId = data.accessKeyId;
        this.secretAccessKey = data.secretAccessKey;
        this.sessionToken = data.sessionToken;
        this.region = data.region;
        this.serviceEndpoint = data.serviceEndpoint;
    }
    /**
     * Validates the S3ExternalAnalyticsLink.
     */
    validate() {
        if (!this.dataverse) {
            throw new errors_1.InvalidArgumentError(new Error('Must provide a dataverse for the S3ExternalAnalyticsLink.'));
        }
        if (!this.name) {
            throw new errors_1.InvalidArgumentError(new Error('Must provide a name for the S3ExternalAnalyticsLink.'));
        }
        if (!this.accessKeyId) {
            throw new errors_1.InvalidArgumentError(new Error('Must provide an accessKeyId for the S3ExternalAnalyticsLink.'));
        }
        if (!this.secretAccessKey) {
            throw new errors_1.InvalidArgumentError(new Error('Must provide an secretAccessKey for the S3ExternalAnalyticsLink.'));
        }
        if (!this.region) {
            throw new errors_1.InvalidArgumentError(new Error('Must provide an region for the S3ExternalAnalyticsLink.'));
        }
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        data.validate();
        return {
            link_name: data.name,
            dataverse: data.dataverse,
            access_key_id: data.accessKeyId,
            secret_access_key: data.secretAccessKey,
            session_token: data.sessionToken,
            region: data.region,
            service_endpoint: data.serviceEndpoint,
        };
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new S3ExternalAnalyticsLink({
            name: data.link_name,
            linkType: AnalyticsLinkType.S3External,
            dataverse: data.dataverse,
            accessKeyId: data.access_key_id,
            secretAccessKey: undefined,
            sessionToken: undefined,
            region: data.region,
            serviceEndpoint: data.service_endpoint,
        });
    }
}
exports.S3ExternalAnalyticsLink = S3ExternalAnalyticsLink;
/**
 * Provides information about a analytics remote S3 link.
 */
class AzureExternalAnalyticsLink extends AnalyticsLink {
    /**
     * @internal
     */
    constructor(data) {
        super();
        this.linkType = AnalyticsLinkType.AzureBlobExternal;
        this.dataverse = data.dataverse;
        this.name = data.name;
        this.connectionString = data.connectionString;
        this.accountName = data.accountName;
        this.accountKey = data.accountKey;
        this.sharedAccessSignature = data.sharedAccessSignature;
        this.blobEndpoint = data.blobEndpoint;
        this.endpointSuffix = data.endpointSuffix;
    }
    /**
     * Validates the AzureExternalAnalyticsLink.
     */
    validate() {
        if (!this.dataverse) {
            throw new errors_1.InvalidArgumentError(new Error('Must provide a dataverse for the AzureExternalAnalyticsLink.'));
        }
        if (!this.name) {
            throw new errors_1.InvalidArgumentError(new Error('Must provide a name for the AzureExternalAnalyticsLink.'));
        }
        if (!this.connectionString) {
            const missingAcctNameAndKey = !(this.accountName && this.accountKey);
            const missingAcctNameAndSharedAccessSignature = !(this.accountName && this.sharedAccessSignature);
            if (missingAcctNameAndKey && missingAcctNameAndSharedAccessSignature) {
                throw new errors_1.InvalidArgumentError(new Error('If not providing connectionString, accountName and either accountKey' +
                    ' or sharedAccessSignature must be provided for the AzureExternalAnalyticsLink.'));
            }
        }
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        data.validate();
        return {
            link_name: data.name,
            dataverse: data.dataverse,
            connection_string: data.connectionString,
            account_name: data.accountName,
            account_key: data.accountKey,
            shared_access_signature: data.sharedAccessSignature,
            blob_endpoint: data.blobEndpoint,
            endpoint_suffix: data.endpointSuffix,
        };
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new AzureExternalAnalyticsLink({
            name: data.link_name,
            linkType: AnalyticsLinkType.AzureBlobExternal,
            dataverse: data.dataverse,
            connectionString: undefined,
            accountName: data.account_name,
            accountKey: undefined,
            sharedAccessSignature: undefined,
            blobEndpoint: data.blob_endpoint,
            endpointSuffix: data.endpoint_suffix,
        });
    }
}
exports.AzureExternalAnalyticsLink = AzureExternalAnalyticsLink;
/**
 * AnalyticsIndexManager provides an interface for performing management
 * operations against the analytics service of the cluster.
 *
 * @category Management
 */
class AnalyticsIndexManager {
    /**
     * @internal
     */
    constructor(cluster) {
        this._cluster = cluster;
    }
    /**
     * Creates a new dataverse.
     *
     * @param dataverseName The name of the dataverse to create.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async createDataverse(dataverseName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        const ignoreIfExists = options.ignoreIfExists || false;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsDataverseCreate({
                dataverse_name: dataverseName,
                timeout: timeout,
                ignore_if_exists: ignoreIfExists,
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
     * Drops a previously created dataverse.
     *
     * @param dataverseName The name of the dataverse to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async dropDataverse(dataverseName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        const ignoreIfNotExists = options.ignoreIfNotExists || false;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsDataverseDrop({
                dataverse_name: dataverseName,
                timeout: timeout,
                ignore_if_does_not_exist: ignoreIfNotExists,
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
     * Creates a new dataset.
     *
     * @param bucketName The name of the bucket to create this dataset of.
     * @param datasetName The name of the new dataset.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async createDataset(bucketName, datasetName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const dataverseName = options.dataverseName || 'Default';
        const ignoreIfExists = options.ignoreIfExists || false;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsDatasetCreate({
                dataverse_name: dataverseName,
                dataset_name: datasetName,
                bucket_name: bucketName,
                condition: options === null || options === void 0 ? void 0 : options.condition,
                timeout: timeout,
                ignore_if_exists: ignoreIfExists,
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
     * Drops a previously created dataset.
     *
     * @param datasetName The name of the dataset to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async dropDataset(datasetName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const dataverseName = options.dataverseName || 'Default';
        const ignoreIfNotExists = options.ignoreIfNotExists || false;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsDatasetDrop({
                dataverse_name: dataverseName,
                dataset_name: datasetName,
                timeout: timeout,
                ignore_if_does_not_exist: ignoreIfNotExists,
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
     * Returns a list of all existing datasets.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getAllDatasets(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsDatasetGetAll({
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const dataSets = resp.datasets.map((dataset) => new AnalyticsDataset({
                    name: dataset.name,
                    dataverseName: dataset.dataverse_name,
                    linkName: dataset.link_name,
                    bucketName: dataset.bucket_name,
                }));
                wrapCallback(null, dataSets);
            });
        }, callback);
    }
    /**
     * Creates a new index.
     *
     * @param datasetName The name of the dataset to create this index on.
     * @param indexName The name of index to create.
     * @param fields A map of fields that the index should contain.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async createIndex(datasetName, indexName, fields, options, callback) {
        if (options instanceof Function) {
            callback = arguments[3];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const dataverseName = options.dataverseName || 'Default';
        const ignoreIfExists = options.ignoreIfExists || false;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsIndexCreate({
                dataverse_name: dataverseName,
                dataset_name: datasetName,
                index_name: indexName,
                fields: fields,
                timeout: timeout,
                ignore_if_exists: ignoreIfExists,
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
     * Drops a previously created index.
     *
     * @param datasetName The name of the dataset containing the index to drop.
     * @param indexName The name of the index to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async dropIndex(datasetName, indexName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const dataverseName = options.dataverseName || 'Default';
        const ignoreIfNotExists = options.ignoreIfNotExists || false;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsIndexDrop({
                dataverse_name: dataverseName,
                dataset_name: datasetName,
                index_name: indexName,
                timeout: timeout,
                ignore_if_does_not_exist: ignoreIfNotExists,
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
     * Returns a list of all existing indexes.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getAllIndexes(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsIndexGetAll({
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const indexes = resp.indexes.map((index) => new AnalyticsIndex({
                    name: index.name,
                    dataverseName: index.dataverse_name,
                    datasetName: index.dataset_name,
                    isPrimary: index.is_primary,
                }));
                wrapCallback(null, indexes);
            });
        }, callback);
    }
    /**
     * @internal
     */
    async connectLink() {
        if (typeof arguments[0] === 'string') {
            return this._connectLinkDeprecated(arguments[0], arguments[1], arguments[2]);
        }
        else {
            return this._connectLink(arguments[0], arguments[1]);
        }
    }
    // TODO(JSCBC-1293):  Remove deprecated path
    /**
     * @internal
     */
    async _connectLinkDeprecated(linkStr, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const force = options.force || false;
        const timeout = options.timeout || this._cluster.managementTimeout;
        let qs = 'CONNECT LINK ' + linkStr;
        if (force) {
            qs += ' WITH {"force": true}';
        }
        return utilities_1.PromiseHelper.wrapAsync(async () => {
            await this._cluster.analyticsQuery(qs, {
                timeout: timeout,
            });
        }, callback);
    }
    /**
     * @internal
     */
    async _connectLink(options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const dataverseName = options.dataverseName || 'Default';
        const linkName = options.linkName || 'Local';
        const force = options.force || false;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsLinkConnect({
                dataverse_name: dataverseName,
                link_name: linkName,
                timeout: timeout,
                force: force,
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
     * @internal
     */
    async disconnectLink() {
        if (typeof arguments[0] === 'string') {
            return this._disconnectLinkDeprecated(arguments[0], arguments[1], arguments[2]);
        }
        else {
            return this._disconnectLink(arguments[0], arguments[1]);
        }
    }
    // TODO(JSCBC-1293):  Remove deprecated path
    /**
     * @internal
     */
    async _disconnectLinkDeprecated(linkStr, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const qs = 'DISCONNECT LINK ' + linkStr;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrapAsync(async () => {
            await this._cluster.analyticsQuery(qs, {
                timeout: timeout,
            });
        }, callback);
    }
    /**
     * @internal
     */
    async _disconnectLink(options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const dataverseName = options.dataverseName || 'Default';
        const linkName = options.linkName || 'Local';
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsLinkDisconnect({
                dataverse_name: dataverseName,
                link_name: linkName,
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
     * Returns a list of all pending mutations.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getPendingMutations(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsGetPendingMutations({
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const stats = {
                    stats: resp.stats,
                };
                wrapCallback(null, stats);
            });
        }, callback);
    }
    /**
     * Creates a new analytics remote link.
     *
     * @param link The settings for the link to create.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async createLink(link, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        if (link.linkType == AnalyticsLinkType.CouchbaseRemote) {
            return utilities_1.PromiseHelper.wrap((wrapCallback) => {
                this._cluster.conn.managementAnalyticsLinkCreateCouchbaseRemoteLink({
                    link: CouchbaseRemoteAnalyticsLink._toCppData(new CouchbaseRemoteAnalyticsLink(link)),
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
        else if (link.linkType == AnalyticsLinkType.S3External) {
            return utilities_1.PromiseHelper.wrap((wrapCallback) => {
                this._cluster.conn.managementAnalyticsLinkCreateS3ExternalLink({
                    link: S3ExternalAnalyticsLink._toCppData(new S3ExternalAnalyticsLink(link)),
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
        else if (link.linkType == AnalyticsLinkType.AzureBlobExternal) {
            return utilities_1.PromiseHelper.wrap((wrapCallback) => {
                this._cluster.conn.managementAnalyticsLinkCreateAzureBlobExternalLink({
                    link: AzureExternalAnalyticsLink._toCppData(new AzureExternalAnalyticsLink(link)),
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
        else {
            throw new Error('invalid link type');
        }
    }
    /**
     * Replaces an existing analytics remote link.
     *
     * @param link The settings for the updated link.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async replaceLink(link, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        if (link.linkType == AnalyticsLinkType.CouchbaseRemote) {
            return utilities_1.PromiseHelper.wrap((wrapCallback) => {
                this._cluster.conn.managementAnalyticsLinkReplaceCouchbaseRemoteLink({
                    link: CouchbaseRemoteAnalyticsLink._toCppData(new CouchbaseRemoteAnalyticsLink(link)),
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
        else if (link.linkType == AnalyticsLinkType.S3External) {
            return utilities_1.PromiseHelper.wrap((wrapCallback) => {
                this._cluster.conn.managementAnalyticsLinkReplaceS3ExternalLink({
                    link: S3ExternalAnalyticsLink._toCppData(new S3ExternalAnalyticsLink(link)),
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
        else if (link.linkType == AnalyticsLinkType.AzureBlobExternal) {
            return utilities_1.PromiseHelper.wrap((wrapCallback) => {
                this._cluster.conn.managementAnalyticsLinkReplaceAzureBlobExternalLink({
                    link: AzureExternalAnalyticsLink._toCppData(new AzureExternalAnalyticsLink(link)),
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
        else {
            throw new Error('invalid link type');
        }
    }
    /**
     * Drops an existing analytics remote link.
     *
     * @param linkName The name of the link to drop.
     * @param dataverseName The dataverse containing the link to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async dropLink(linkName, dataverseName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[2];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsLinkDrop({
                dataverse_name: dataverseName,
                link_name: linkName,
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
     * Returns a list of existing analytics remote links.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getAllLinks(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const dataverseName = options.dataverse;
        const linkName = options.name;
        const linkType = options.linkType;
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementAnalyticsLinkGetAll({
                link_type: linkType,
                link_name: linkName,
                dataverse_name: dataverseName,
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const links = [];
                resp.couchbase.forEach((link) => {
                    links.push(CouchbaseRemoteAnalyticsLink._fromCppData(link));
                });
                resp.s3.forEach((link) => {
                    links.push(S3ExternalAnalyticsLink._fromCppData(link));
                });
                resp.azure_blob.forEach((link) => {
                    links.push(AzureExternalAnalyticsLink._fromCppData(link));
                });
                wrapCallback(null, links);
            });
        }, callback);
    }
}
exports.AnalyticsIndexManager = AnalyticsIndexManager;
