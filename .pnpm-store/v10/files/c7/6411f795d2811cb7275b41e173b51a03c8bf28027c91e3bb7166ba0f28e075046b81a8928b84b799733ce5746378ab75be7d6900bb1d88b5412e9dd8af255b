/// <reference types="node" />
/// <reference types="node" />
import { Cluster } from './cluster';
import { CppManagementAnalyticsCouchbaseRemoteLink, CppManagementAnalyticsS3ExternalLink, CppManagementAnalyticsAzureBlobExternalLink } from './binding';
import { NodeCallback } from './utilities';
/**
 * Represents the type of an analytics link.
 *
 * @category Analytics
 */
export declare enum AnalyticsLinkType {
    /**
     * Indicates that the link is for S3.
     */
    S3External = "s3",
    /**
     * Indicates that the link is for Azure.
     */
    AzureBlobExternal = "azureblob",
    /**
     * Indicates that the link is for a remote Couchbase cluster.
     */
    CouchbaseRemote = "couchbase"
}
/**
 * Represents what level of encryption to use for analytics remote links.
 *
 * @category Analytics
 */
export declare enum AnalyticsEncryptionLevel {
    /**
     * Indicates that no encryption should be used.
     */
    None = "none",
    /**
     * Indicates that half encryption should be used.
     */
    Half = "half",
    /**
     * Indicates that full encryption should be used.
     */
    Full = "full"
}
/**
 * Contains a specific dataset configuration for the analytics service.
 *
 * @category Management
 */
export declare class AnalyticsDataset {
    /**
     * The name of the dataset.
     */
    name: string;
    /**
     * The name of the dataverse that this dataset exists within.
     */
    dataverseName: string;
    /**
     * The name of the link that is associated with this dataset.
     */
    linkName: string;
    /**
     * The name of the bucket that this dataset includes.
     */
    bucketName: string;
    /**
     * @internal
     */
    constructor(data: AnalyticsDataset);
}
/**
 * Contains a specific index configuration for the analytics service.
 *
 * @category Management
 */
export declare class AnalyticsIndex {
    /**
     * The name of the index.
     */
    name: string;
    /**
     * The name of the dataset this index belongs to.
     */
    datasetName: string;
    /**
     * The name of the dataverse this index belongs to.
     */
    dataverseName: string;
    /**
     * Whether or not this is a primary index or not.
     */
    isPrimary: boolean;
    /**
     * @internal
     */
    constructor(data: AnalyticsIndex);
}
/**
 * Specifies encryption options for an analytics remote link.
 */
export interface ICouchbaseAnalyticsEncryptionSettings {
    /**
     * Specifies what level of encryption should be used.
     */
    encryptionLevel: AnalyticsEncryptionLevel;
    /**
     * Provides a certificate to use for connecting when encryption level is set
     * to full.  Required when encryptionLevel is set to Full.
     */
    certificate?: Buffer;
    /**
     * Provides a client certificate to use for connecting when encryption level
     * is set to full.  Cannot be set if a username/password are used.
     */
    clientCertificate?: Buffer;
    /**
     * Provides a client key to use for connecting when encryption level is set
     * to full.  Cannot be set if a username/password are used.
     */
    clientKey?: Buffer;
}
/**
 * Includes information about an analytics remote links encryption.
 */
export declare class CouchbaseAnalyticsEncryptionSettings implements ICouchbaseAnalyticsEncryptionSettings {
    /**
     * Specifies what level of encryption should be used.
     */
    encryptionLevel: AnalyticsEncryptionLevel;
    /**
     * Provides a certificate to use for connecting when encryption level is set
     * to full.  Required when encryptionLevel is set to Full.
     */
    certificate?: Buffer;
    /**
     * Provides a client certificate to use for connecting when encryption level
     * is set to full.  Cannot be set if a username/password are used.
     */
    clientCertificate?: Buffer;
    /**
     * Provides a client key to use for connecting when encryption level is set
     * to full.  Cannot be set if a username/password are used.
     */
    clientKey?: Buffer;
    /**
     * @internal
     */
    constructor(data: CouchbaseAnalyticsEncryptionSettings);
}
/**
 * Provides a base class for specifying options for an analytics link.
 *
 * @category Management
 */
export interface IAnalyticsLink {
    /**
     * Specifies what type of analytics link this represents.
     */
    linkType: AnalyticsLinkType;
    /**
     * The dataverse that this link belongs to.
     */
    dataverse: string;
    /**
     * The name of this link.
     */
    name: string;
}
/**
 * This is a base class for specific link configurations for the analytics service.
 */
export declare abstract class AnalyticsLink implements IAnalyticsLink {
    /**
     * @internal
     */
    constructor();
    /**
     * Specifies what type of analytics link this represents.
     */
    linkType: AnalyticsLinkType;
    /**
     * The dataverse that this link belongs to.
     */
    dataverse: string;
    /**
     * The name of this link.
     */
    name: string;
    /**
     * Validates the link.
     */
    abstract validate(): void;
    /**
     * @internal
     */
    static _toHttpData(data: IAnalyticsLink): any;
    /**
     * @internal
     */
    static _fromHttpData(data: any): AnalyticsLink;
}
/**
 * Provides options for configuring an analytics remote couchbase cluster link.
 */
export interface ICouchbaseRemoteAnalyticsLink extends IAnalyticsLink {
    /**
     * Specifies what type of analytics link this represents.
     */
    linkType: AnalyticsLinkType.CouchbaseRemote;
    /**
     * The dataverse that this link belongs to.
     */
    dataverse: string;
    /**
     * The name of this link.
     */
    name: string;
    /**
     * The hostname of the target Couchbase cluster.
     */
    hostname: string;
    /**
     * The encryption settings to be used for the link.
     */
    encryption?: ICouchbaseAnalyticsEncryptionSettings;
    /**
     * The username to use for authentication with the remote cluster.  Optional
     * if client-certificate authentication
     * (@see ICouchbaseAnalyticsEncryptionSettings.clientCertificate) is being used.
     */
    username?: string;
    /**
     * The password to use for authentication with the remote cluster.  Optional
     * if client-certificate authentication
     * (@see ICouchbaseAnalyticsEncryptionSettings.clientCertificate) is being used.
     */
    password?: string;
}
/**
 * Provides information about a analytics remote Couchbase link.
 */
export declare class CouchbaseRemoteAnalyticsLink extends AnalyticsLink implements ICouchbaseRemoteAnalyticsLink {
    /**
     * Specifies what type of analytics link this represents.
     */
    linkType: AnalyticsLinkType.CouchbaseRemote;
    /**
     * The dataverse that this link belongs to.
     */
    dataverse: string;
    /**
     * The name of this link.
     */
    name: string;
    /**
     * The hostname of the target Couchbase cluster.
     */
    hostname: string;
    /**
     * The encryption settings to be used for the link.
     */
    encryption?: CouchbaseAnalyticsEncryptionSettings;
    /**
     * The username to use for authentication with the remote cluster.  Optional
     * if client-certificate authentication
     * (@see ICouchbaseAnalyticsEncryptionSettings.clientCertificate) is being used.
     */
    username?: string;
    /**
     * The password to use for authentication with the remote cluster.  Optional
     * if client-certificate authentication
     * (@see ICouchbaseAnalyticsEncryptionSettings.clientCertificate) is being used.
     */
    password?: string;
    /**
     * Validates the CouchbaseRemoteAnalyticsLink.
     */
    validate(): void;
    /**
     * @internal
     */
    constructor(data: ICouchbaseRemoteAnalyticsLink);
    /**
     * @internal
     */
    static _toCppData(data: CouchbaseRemoteAnalyticsLink): CppManagementAnalyticsCouchbaseRemoteLink;
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementAnalyticsCouchbaseRemoteLink): CouchbaseRemoteAnalyticsLink;
}
/**
 * Provides options for configuring an analytics remote S3 link.
 */
export interface IS3ExternalAnalyticsLink extends IAnalyticsLink {
    /**
     * Specifies what type of analytics link this represents.
     */
    linkType: AnalyticsLinkType.S3External;
    /**
     * The dataverse that this link belongs to.
     */
    dataverse: string;
    /**
     * The name of this link.
     */
    name: string;
    /**
     * The AWS S3 access key.
     */
    accessKeyId: string;
    /**
     * The AWS S3 secret key.
     */
    secretAccessKey?: string;
    /**
     * The AWS S3 token if temporary credentials are provided.  Only available
     * in Couchbase Server 7.0 and above.
     */
    sessionToken?: string;
    /**
     * The AWS S3 region.
     */
    region: string;
    /**
     * The AWS S3 service endpoint.
     */
    serviceEndpoint?: string;
}
/**
 * Provides information about a analytics remote S3 link.
 */
export declare class S3ExternalAnalyticsLink extends AnalyticsLink implements IS3ExternalAnalyticsLink {
    /**
     * Specifies what type of analytics link this represents.
     */
    linkType: AnalyticsLinkType.S3External;
    /**
     * The dataverse that this link belongs to.
     */
    dataverse: string;
    /**
     * The name of this link.
     */
    name: string;
    /**
     * The AWS S3 access key.
     */
    accessKeyId: string;
    /**
     * The AWS S3 secret key.
     */
    secretAccessKey?: string;
    /**
     * The AWS S3 token if temporary credentials are provided.  Only available
     * in Couchbase Server 7.0 and above.
     */
    sessionToken?: string;
    /**
     * The AWS S3 region.
     */
    region: string;
    /**
     * The AWS S3 service endpoint.
     */
    serviceEndpoint?: string;
    /**
     * @internal
     */
    constructor(data: IS3ExternalAnalyticsLink);
    /**
     * Validates the S3ExternalAnalyticsLink.
     */
    validate(): void;
    /**
     * @internal
     */
    static _toCppData(data: S3ExternalAnalyticsLink): CppManagementAnalyticsS3ExternalLink;
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementAnalyticsS3ExternalLink): S3ExternalAnalyticsLink;
}
/**
 * Provides options for configuring an analytics remote Azure link.
 */
export interface IAzureExternalAnalyticsLink extends IAnalyticsLink {
    /**
     * Specifies what type of analytics link this represents.
     */
    linkType: AnalyticsLinkType.AzureBlobExternal;
    /**
     * The dataverse that this link belongs to.
     */
    dataverse: string;
    /**
     * The name of this link.
     */
    name: string;
    /**
     * The connection string to use to connect to the external Azure store.
     */
    connectionString?: string;
    /**
     * The Azure blob storage account name.
     */
    accountName?: string;
    /**
     * The Azure blob storage account key.
     */
    accountKey?: string;
    /**
     * The shared access signature to use for authentication.
     */
    sharedAccessSignature?: string;
    /**
     * The Azure blob storage endpoint.
     */
    blobEndpoint?: string;
    /**
     * The Azure blob endpoint suffix.
     */
    endpointSuffix?: string;
}
/**
 * Provides information about a analytics remote S3 link.
 */
export declare class AzureExternalAnalyticsLink extends AnalyticsLink implements IAzureExternalAnalyticsLink {
    /**
     * Specifies what type of analytics link this represents.
     */
    linkType: AnalyticsLinkType.AzureBlobExternal;
    /**
     * The dataverse that this link belongs to.
     */
    dataverse: string;
    /**
     * The name of this link.
     */
    name: string;
    /**
     * The connection string to use to connect to the external Azure store.
     */
    connectionString?: string;
    /**
     * The Azure blob storage account name.
     */
    accountName?: string;
    /**
     * The Azure blob storage account key.
     */
    accountKey?: string;
    /**
     * The shared access signature to use for authentication.
     */
    sharedAccessSignature?: string;
    /**
     * The Azure blob storage endpoint.
     */
    blobEndpoint?: string;
    /**
     * The Azure blob endpoint suffix.
     */
    endpointSuffix?: string;
    /**
     * @internal
     */
    constructor(data: IAzureExternalAnalyticsLink);
    /**
     * Validates the AzureExternalAnalyticsLink.
     */
    validate(): void;
    /**
     * @internal
     */
    static _toCppData(data: AzureExternalAnalyticsLink): CppManagementAnalyticsAzureBlobExternalLink;
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementAnalyticsAzureBlobExternalLink): AzureExternalAnalyticsLink;
}
/**
 * @category Management
 */
export interface CreateAnalyticsDataverseOptions {
    /**
     * Whether or not the call should ignore the dataverse already existing when
     * determining whether the call was successful.
     */
    ignoreIfExists?: boolean;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DropAnalyticsDataverseOptions {
    /**
     * Whether or not the call should ignore the dataverse not existing when
     * determining whether the call was successful.
     */
    ignoreIfNotExists?: boolean;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface CreateAnalyticsDatasetOptions {
    /**
     * Whether or not the call should ignore the dataset already existing when
     * determining whether the call was successful.
     */
    ignoreIfExists?: boolean;
    /**
     * The name of the dataverse the dataset should belong to.
     */
    dataverseName?: string;
    /**
     * A conditional expression to limit the indexes scope.
     */
    condition?: string;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DropAnalyticsDatasetOptions {
    /**
     * Whether or not the call should ignore the dataset already existing when
     * determining whether the call was successful.
     */
    ignoreIfNotExists?: boolean;
    /**
     * The name of the dataverse the dataset belongs to.
     */
    dataverseName?: string;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetAllAnalyticsDatasetsOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface CreateAnalyticsIndexOptions {
    /**
     * Whether or not the call should ignore the dataverse not existing when
     * determining whether the call was successful.
     */
    ignoreIfExists?: boolean;
    /**
     * The name of the dataverse the index should belong to.
     */
    dataverseName?: string;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DropAnalyticsIndexOptions {
    /**
     * Whether or not the call should ignore the index already existing when
     * determining whether the call was successful.
     */
    ignoreIfNotExists?: boolean;
    /**
     * The name of the dataverse the index belongs to.
     */
    dataverseName?: string;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetAllAnalyticsIndexesOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface ConnectAnalyticsLinkOptions {
    /**
     * Whether or not the call should attempt to force the link connection.
     */
    force?: boolean;
    /**
     * The name of the dataverse the link belongs to.
     */
    dataverseName?: string;
    /**
     * The name of the link to connect.
     */
    linkName?: string;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DisconnectAnalyticsLinkOptions {
    /**
     * The name of the dataverse the link belongs to.
     */
    dataverseName?: string;
    /**
     * The name of the link to connect.
     */
    linkName?: string;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetPendingAnalyticsMutationsOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface CreateAnalyticsLinkOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface ReplaceAnalyticsLinkOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DropAnalyticsLinkOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetAllAnalyticsLinksOptions {
    /**
     * The name of a dataverse to filter the links list to.
     */
    dataverse?: string;
    /**
     * The name of a specific link to fetch.
     */
    name?: string;
    /**
     * The type of link to filter the links list to.
     */
    linkType?: AnalyticsLinkType;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * AnalyticsIndexManager provides an interface for performing management
 * operations against the analytics service of the cluster.
 *
 * @category Management
 */
export declare class AnalyticsIndexManager {
    private _cluster;
    /**
     * @internal
     */
    constructor(cluster: Cluster);
    /**
     * Creates a new dataverse.
     *
     * @param dataverseName The name of the dataverse to create.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    createDataverse(dataverseName: string, options?: CreateAnalyticsDataverseOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Drops a previously created dataverse.
     *
     * @param dataverseName The name of the dataverse to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropDataverse(dataverseName: string, options?: DropAnalyticsDataverseOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Creates a new dataset.
     *
     * @param bucketName The name of the bucket to create this dataset of.
     * @param datasetName The name of the new dataset.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    createDataset(bucketName: string, datasetName: string, options?: CreateAnalyticsDatasetOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Drops a previously created dataset.
     *
     * @param datasetName The name of the dataset to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropDataset(datasetName: string, options?: DropAnalyticsDatasetOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Returns a list of all existing datasets.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAllDatasets(options?: GetAllAnalyticsDatasetsOptions, callback?: NodeCallback<AnalyticsDataset[]>): Promise<AnalyticsDataset[]>;
    /**
     * Creates a new index.
     *
     * @param datasetName The name of the dataset to create this index on.
     * @param indexName The name of index to create.
     * @param fields A map of fields that the index should contain.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    createIndex(datasetName: string, indexName: string, fields: {
        [key: string]: string;
    }, options?: CreateAnalyticsIndexOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Drops a previously created index.
     *
     * @param datasetName The name of the dataset containing the index to drop.
     * @param indexName The name of the index to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropIndex(datasetName: string, indexName: string, options?: DropAnalyticsIndexOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Returns a list of all existing indexes.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAllIndexes(options?: GetAllAnalyticsIndexesOptions, callback?: NodeCallback<AnalyticsIndex[]>): Promise<AnalyticsIndex[]>;
    /**
     * Connects a not yet connected link.
     *
     * @param linkStr The name of the link to connect.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     * @deprecated Use the other overload instead.
     */
    connectLink(linkStr: string, options?: ConnectAnalyticsLinkOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Connects a not yet connected link.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    connectLink(options?: ConnectAnalyticsLinkOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * @internal
     */
    _connectLinkDeprecated(linkStr: string, options?: ConnectAnalyticsLinkOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * @internal
     */
    _connectLink(options?: ConnectAnalyticsLinkOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Disconnects a previously connected link.
     *
     * @param linkStr The name of the link to disconnect.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     * @deprecated Use the other overload instead.
     */
    disconnectLink(linkStr: string, options?: DisconnectAnalyticsLinkOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Disconnects a previously connected link.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    disconnectLink(options?: DisconnectAnalyticsLinkOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * @internal
     */
    _disconnectLinkDeprecated(linkStr: string, options?: DisconnectAnalyticsLinkOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * @internal
     */
    _disconnectLink(options?: DisconnectAnalyticsLinkOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Returns a list of all pending mutations.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getPendingMutations(options?: GetPendingAnalyticsMutationsOptions, callback?: NodeCallback<{
        [k: string]: {
            [k: string]: number;
        };
    }>): Promise<{
        [k: string]: {
            [k: string]: number;
        };
    }>;
    /**
     * Creates a new analytics remote link.
     *
     * @param link The settings for the link to create.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    createLink(link: IAnalyticsLink, options?: CreateAnalyticsLinkOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Replaces an existing analytics remote link.
     *
     * @param link The settings for the updated link.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    replaceLink(link: IAnalyticsLink, options?: ReplaceAnalyticsLinkOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Drops an existing analytics remote link.
     *
     * @param linkName The name of the link to drop.
     * @param dataverseName The dataverse containing the link to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropLink(linkName: string, dataverseName: string, options?: DropAnalyticsLinkOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Returns a list of existing analytics remote links.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAllLinks(options?: GetAllAnalyticsLinksOptions, callback?: NodeCallback<AnalyticsLink[]>): Promise<AnalyticsLink[]>;
}
