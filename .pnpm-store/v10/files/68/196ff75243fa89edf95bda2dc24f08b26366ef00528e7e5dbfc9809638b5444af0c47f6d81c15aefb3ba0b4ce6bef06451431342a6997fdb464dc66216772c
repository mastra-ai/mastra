import { AccountIdEndpointMode, AccountIdEndpointModeInputConfig, AccountIdEndpointModeResolvedConfig } from "@aws-sdk/core/account-id-endpoint";
import { EndpointDiscoveryInputConfig, EndpointDiscoveryResolvedConfig } from "@aws-sdk/middleware-endpoint-discovery";
import { HostHeaderInputConfig, HostHeaderResolvedConfig } from "@aws-sdk/middleware-host-header";
import { UserAgentInputConfig, UserAgentResolvedConfig } from "@aws-sdk/middleware-user-agent";
import { RegionInputConfig, RegionResolvedConfig } from "@smithy/config-resolver";
import { EndpointInputConfig, EndpointResolvedConfig } from "@smithy/middleware-endpoint";
import { RetryInputConfig, RetryResolvedConfig } from "@smithy/middleware-retry";
import { HttpHandlerUserInput as __HttpHandlerUserInput } from "@smithy/protocol-http";
import { Client as __Client, DefaultsMode as __DefaultsMode, SmithyConfiguration as __SmithyConfiguration, SmithyResolvedConfiguration as __SmithyResolvedConfiguration } from "@smithy/smithy-client";
import { AwsCredentialIdentityProvider, BodyLengthCalculator as __BodyLengthCalculator, CheckOptionalClientConfig as __CheckOptionalClientConfig, ChecksumConstructor as __ChecksumConstructor, Decoder as __Decoder, Encoder as __Encoder, HashConstructor as __HashConstructor, HttpHandlerOptions as __HttpHandlerOptions, Logger as __Logger, Provider as __Provider, Provider, StreamCollector as __StreamCollector, UrlParser as __UrlParser, UserAgent as __UserAgent } from "@smithy/types";
import { HttpAuthSchemeInputConfig, HttpAuthSchemeResolvedConfig } from "./auth/httpAuthSchemeProvider";
import { BatchExecuteStatementCommandInput, BatchExecuteStatementCommandOutput } from "./commands/BatchExecuteStatementCommand";
import { BatchGetItemCommandInput, BatchGetItemCommandOutput } from "./commands/BatchGetItemCommand";
import { BatchWriteItemCommandInput, BatchWriteItemCommandOutput } from "./commands/BatchWriteItemCommand";
import { CreateBackupCommandInput, CreateBackupCommandOutput } from "./commands/CreateBackupCommand";
import { CreateGlobalTableCommandInput, CreateGlobalTableCommandOutput } from "./commands/CreateGlobalTableCommand";
import { CreateTableCommandInput, CreateTableCommandOutput } from "./commands/CreateTableCommand";
import { DeleteBackupCommandInput, DeleteBackupCommandOutput } from "./commands/DeleteBackupCommand";
import { DeleteItemCommandInput, DeleteItemCommandOutput } from "./commands/DeleteItemCommand";
import { DeleteResourcePolicyCommandInput, DeleteResourcePolicyCommandOutput } from "./commands/DeleteResourcePolicyCommand";
import { DeleteTableCommandInput, DeleteTableCommandOutput } from "./commands/DeleteTableCommand";
import { DescribeBackupCommandInput, DescribeBackupCommandOutput } from "./commands/DescribeBackupCommand";
import { DescribeContinuousBackupsCommandInput, DescribeContinuousBackupsCommandOutput } from "./commands/DescribeContinuousBackupsCommand";
import { DescribeContributorInsightsCommandInput, DescribeContributorInsightsCommandOutput } from "./commands/DescribeContributorInsightsCommand";
import { DescribeEndpointsCommandInput, DescribeEndpointsCommandOutput } from "./commands/DescribeEndpointsCommand";
import { DescribeExportCommandInput, DescribeExportCommandOutput } from "./commands/DescribeExportCommand";
import { DescribeGlobalTableCommandInput, DescribeGlobalTableCommandOutput } from "./commands/DescribeGlobalTableCommand";
import { DescribeGlobalTableSettingsCommandInput, DescribeGlobalTableSettingsCommandOutput } from "./commands/DescribeGlobalTableSettingsCommand";
import { DescribeImportCommandInput, DescribeImportCommandOutput } from "./commands/DescribeImportCommand";
import { DescribeKinesisStreamingDestinationCommandInput, DescribeKinesisStreamingDestinationCommandOutput } from "./commands/DescribeKinesisStreamingDestinationCommand";
import { DescribeLimitsCommandInput, DescribeLimitsCommandOutput } from "./commands/DescribeLimitsCommand";
import { DescribeTableCommandInput, DescribeTableCommandOutput } from "./commands/DescribeTableCommand";
import { DescribeTableReplicaAutoScalingCommandInput, DescribeTableReplicaAutoScalingCommandOutput } from "./commands/DescribeTableReplicaAutoScalingCommand";
import { DescribeTimeToLiveCommandInput, DescribeTimeToLiveCommandOutput } from "./commands/DescribeTimeToLiveCommand";
import { DisableKinesisStreamingDestinationCommandInput, DisableKinesisStreamingDestinationCommandOutput } from "./commands/DisableKinesisStreamingDestinationCommand";
import { EnableKinesisStreamingDestinationCommandInput, EnableKinesisStreamingDestinationCommandOutput } from "./commands/EnableKinesisStreamingDestinationCommand";
import { ExecuteStatementCommandInput, ExecuteStatementCommandOutput } from "./commands/ExecuteStatementCommand";
import { ExecuteTransactionCommandInput, ExecuteTransactionCommandOutput } from "./commands/ExecuteTransactionCommand";
import { ExportTableToPointInTimeCommandInput, ExportTableToPointInTimeCommandOutput } from "./commands/ExportTableToPointInTimeCommand";
import { GetItemCommandInput, GetItemCommandOutput } from "./commands/GetItemCommand";
import { GetResourcePolicyCommandInput, GetResourcePolicyCommandOutput } from "./commands/GetResourcePolicyCommand";
import { ImportTableCommandInput, ImportTableCommandOutput } from "./commands/ImportTableCommand";
import { ListBackupsCommandInput, ListBackupsCommandOutput } from "./commands/ListBackupsCommand";
import { ListContributorInsightsCommandInput, ListContributorInsightsCommandOutput } from "./commands/ListContributorInsightsCommand";
import { ListExportsCommandInput, ListExportsCommandOutput } from "./commands/ListExportsCommand";
import { ListGlobalTablesCommandInput, ListGlobalTablesCommandOutput } from "./commands/ListGlobalTablesCommand";
import { ListImportsCommandInput, ListImportsCommandOutput } from "./commands/ListImportsCommand";
import { ListTablesCommandInput, ListTablesCommandOutput } from "./commands/ListTablesCommand";
import { ListTagsOfResourceCommandInput, ListTagsOfResourceCommandOutput } from "./commands/ListTagsOfResourceCommand";
import { PutItemCommandInput, PutItemCommandOutput } from "./commands/PutItemCommand";
import { PutResourcePolicyCommandInput, PutResourcePolicyCommandOutput } from "./commands/PutResourcePolicyCommand";
import { QueryCommandInput, QueryCommandOutput } from "./commands/QueryCommand";
import { RestoreTableFromBackupCommandInput, RestoreTableFromBackupCommandOutput } from "./commands/RestoreTableFromBackupCommand";
import { RestoreTableToPointInTimeCommandInput, RestoreTableToPointInTimeCommandOutput } from "./commands/RestoreTableToPointInTimeCommand";
import { ScanCommandInput, ScanCommandOutput } from "./commands/ScanCommand";
import { TagResourceCommandInput, TagResourceCommandOutput } from "./commands/TagResourceCommand";
import { TransactGetItemsCommandInput, TransactGetItemsCommandOutput } from "./commands/TransactGetItemsCommand";
import { TransactWriteItemsCommandInput, TransactWriteItemsCommandOutput } from "./commands/TransactWriteItemsCommand";
import { UntagResourceCommandInput, UntagResourceCommandOutput } from "./commands/UntagResourceCommand";
import { UpdateContinuousBackupsCommandInput, UpdateContinuousBackupsCommandOutput } from "./commands/UpdateContinuousBackupsCommand";
import { UpdateContributorInsightsCommandInput, UpdateContributorInsightsCommandOutput } from "./commands/UpdateContributorInsightsCommand";
import { UpdateGlobalTableCommandInput, UpdateGlobalTableCommandOutput } from "./commands/UpdateGlobalTableCommand";
import { UpdateGlobalTableSettingsCommandInput, UpdateGlobalTableSettingsCommandOutput } from "./commands/UpdateGlobalTableSettingsCommand";
import { UpdateItemCommandInput, UpdateItemCommandOutput } from "./commands/UpdateItemCommand";
import { UpdateKinesisStreamingDestinationCommandInput, UpdateKinesisStreamingDestinationCommandOutput } from "./commands/UpdateKinesisStreamingDestinationCommand";
import { UpdateTableCommandInput, UpdateTableCommandOutput } from "./commands/UpdateTableCommand";
import { UpdateTableReplicaAutoScalingCommandInput, UpdateTableReplicaAutoScalingCommandOutput } from "./commands/UpdateTableReplicaAutoScalingCommand";
import { UpdateTimeToLiveCommandInput, UpdateTimeToLiveCommandOutput } from "./commands/UpdateTimeToLiveCommand";
import { ClientInputEndpointParameters, ClientResolvedEndpointParameters, EndpointParameters } from "./endpoint/EndpointParameters";
import { RuntimeExtension, RuntimeExtensionsConfig } from "./runtimeExtensions";
export { __Client };
/**
 * @public
 */
export type ServiceInputTypes = BatchExecuteStatementCommandInput | BatchGetItemCommandInput | BatchWriteItemCommandInput | CreateBackupCommandInput | CreateGlobalTableCommandInput | CreateTableCommandInput | DeleteBackupCommandInput | DeleteItemCommandInput | DeleteResourcePolicyCommandInput | DeleteTableCommandInput | DescribeBackupCommandInput | DescribeContinuousBackupsCommandInput | DescribeContributorInsightsCommandInput | DescribeEndpointsCommandInput | DescribeExportCommandInput | DescribeGlobalTableCommandInput | DescribeGlobalTableSettingsCommandInput | DescribeImportCommandInput | DescribeKinesisStreamingDestinationCommandInput | DescribeLimitsCommandInput | DescribeTableCommandInput | DescribeTableReplicaAutoScalingCommandInput | DescribeTimeToLiveCommandInput | DisableKinesisStreamingDestinationCommandInput | EnableKinesisStreamingDestinationCommandInput | ExecuteStatementCommandInput | ExecuteTransactionCommandInput | ExportTableToPointInTimeCommandInput | GetItemCommandInput | GetResourcePolicyCommandInput | ImportTableCommandInput | ListBackupsCommandInput | ListContributorInsightsCommandInput | ListExportsCommandInput | ListGlobalTablesCommandInput | ListImportsCommandInput | ListTablesCommandInput | ListTagsOfResourceCommandInput | PutItemCommandInput | PutResourcePolicyCommandInput | QueryCommandInput | RestoreTableFromBackupCommandInput | RestoreTableToPointInTimeCommandInput | ScanCommandInput | TagResourceCommandInput | TransactGetItemsCommandInput | TransactWriteItemsCommandInput | UntagResourceCommandInput | UpdateContinuousBackupsCommandInput | UpdateContributorInsightsCommandInput | UpdateGlobalTableCommandInput | UpdateGlobalTableSettingsCommandInput | UpdateItemCommandInput | UpdateKinesisStreamingDestinationCommandInput | UpdateTableCommandInput | UpdateTableReplicaAutoScalingCommandInput | UpdateTimeToLiveCommandInput;
/**
 * @public
 */
export type ServiceOutputTypes = BatchExecuteStatementCommandOutput | BatchGetItemCommandOutput | BatchWriteItemCommandOutput | CreateBackupCommandOutput | CreateGlobalTableCommandOutput | CreateTableCommandOutput | DeleteBackupCommandOutput | DeleteItemCommandOutput | DeleteResourcePolicyCommandOutput | DeleteTableCommandOutput | DescribeBackupCommandOutput | DescribeContinuousBackupsCommandOutput | DescribeContributorInsightsCommandOutput | DescribeEndpointsCommandOutput | DescribeExportCommandOutput | DescribeGlobalTableCommandOutput | DescribeGlobalTableSettingsCommandOutput | DescribeImportCommandOutput | DescribeKinesisStreamingDestinationCommandOutput | DescribeLimitsCommandOutput | DescribeTableCommandOutput | DescribeTableReplicaAutoScalingCommandOutput | DescribeTimeToLiveCommandOutput | DisableKinesisStreamingDestinationCommandOutput | EnableKinesisStreamingDestinationCommandOutput | ExecuteStatementCommandOutput | ExecuteTransactionCommandOutput | ExportTableToPointInTimeCommandOutput | GetItemCommandOutput | GetResourcePolicyCommandOutput | ImportTableCommandOutput | ListBackupsCommandOutput | ListContributorInsightsCommandOutput | ListExportsCommandOutput | ListGlobalTablesCommandOutput | ListImportsCommandOutput | ListTablesCommandOutput | ListTagsOfResourceCommandOutput | PutItemCommandOutput | PutResourcePolicyCommandOutput | QueryCommandOutput | RestoreTableFromBackupCommandOutput | RestoreTableToPointInTimeCommandOutput | ScanCommandOutput | TagResourceCommandOutput | TransactGetItemsCommandOutput | TransactWriteItemsCommandOutput | UntagResourceCommandOutput | UpdateContinuousBackupsCommandOutput | UpdateContributorInsightsCommandOutput | UpdateGlobalTableCommandOutput | UpdateGlobalTableSettingsCommandOutput | UpdateItemCommandOutput | UpdateKinesisStreamingDestinationCommandOutput | UpdateTableCommandOutput | UpdateTableReplicaAutoScalingCommandOutput | UpdateTimeToLiveCommandOutput;
/**
 * @public
 */
export interface ClientDefaults extends Partial<__SmithyConfiguration<__HttpHandlerOptions>> {
    /**
     * The HTTP handler to use or its constructor options. Fetch in browser and Https in Nodejs.
     */
    requestHandler?: __HttpHandlerUserInput;
    /**
     * A constructor for a class implementing the {@link @smithy/types#ChecksumConstructor} interface
     * that computes the SHA-256 HMAC or checksum of a string or binary buffer.
     * @internal
     */
    sha256?: __ChecksumConstructor | __HashConstructor;
    /**
     * The function that will be used to convert strings into HTTP endpoints.
     * @internal
     */
    urlParser?: __UrlParser;
    /**
     * A function that can calculate the length of a request body.
     * @internal
     */
    bodyLengthChecker?: __BodyLengthCalculator;
    /**
     * A function that converts a stream into an array of bytes.
     * @internal
     */
    streamCollector?: __StreamCollector;
    /**
     * The function that will be used to convert a base64-encoded string to a byte array.
     * @internal
     */
    base64Decoder?: __Decoder;
    /**
     * The function that will be used to convert binary data to a base64-encoded string.
     * @internal
     */
    base64Encoder?: __Encoder;
    /**
     * The function that will be used to convert a UTF8-encoded string to a byte array.
     * @internal
     */
    utf8Decoder?: __Decoder;
    /**
     * The function that will be used to convert binary data to a UTF-8 encoded string.
     * @internal
     */
    utf8Encoder?: __Encoder;
    /**
     * The runtime environment.
     * @internal
     */
    runtime?: string;
    /**
     * Disable dynamically changing the endpoint of the client based on the hostPrefix
     * trait of an operation.
     */
    disableHostPrefix?: boolean;
    /**
     * Unique service identifier.
     * @internal
     */
    serviceId?: string;
    /**
     * Enables IPv6/IPv4 dualstack endpoint.
     */
    useDualstackEndpoint?: boolean | __Provider<boolean>;
    /**
     * Enables FIPS compatible endpoints.
     */
    useFipsEndpoint?: boolean | __Provider<boolean>;
    /**
     * The AWS region to which this client will send requests
     */
    region?: string | __Provider<string>;
    /**
     * Setting a client profile is similar to setting a value for the
     * AWS_PROFILE environment variable. Setting a profile on a client
     * in code only affects the single client instance, unlike AWS_PROFILE.
     *
     * When set, and only for environments where an AWS configuration
     * file exists, fields configurable by this file will be retrieved
     * from the specified profile within that file.
     * Conflicting code configuration and environment variables will
     * still have higher priority.
     *
     * For client credential resolution that involves checking the AWS
     * configuration file, the client's profile (this value) will be
     * used unless a different profile is set in the credential
     * provider options.
     *
     */
    profile?: string;
    /**
     * Defines if the AWS AccountId will be used for endpoint routing.
     */
    accountIdEndpointMode?: AccountIdEndpointMode | __Provider<AccountIdEndpointMode>;
    /**
     * The provider populating default tracking information to be sent with `user-agent`, `x-amz-user-agent` header
     * @internal
     */
    defaultUserAgentProvider?: Provider<__UserAgent>;
    /**
     * Default credentials provider; Not available in browser runtime.
     * @deprecated
     * @internal
     */
    credentialDefaultProvider?: (input: any) => AwsCredentialIdentityProvider;
    /**
     * Value for how many times a request will be made at most in case of retry.
     */
    maxAttempts?: number | __Provider<number>;
    /**
     * Specifies which retry algorithm to use.
     * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-smithy-util-retry/Enum/RETRY_MODES/
     *
     */
    retryMode?: string | __Provider<string>;
    /**
     * Optional logger for logging debug/info/warn/error.
     */
    logger?: __Logger;
    /**
     * Optional extensions
     */
    extensions?: RuntimeExtension[];
    /**
     * The {@link @smithy/smithy-client#DefaultsMode} that will be used to determine how certain default configuration options are resolved in the SDK.
     */
    defaultsMode?: __DefaultsMode | __Provider<__DefaultsMode>;
    /**
     * The provider which populates default for endpointDiscoveryEnabled configuration, if it's
     * not passed during client creation.
     * @internal
     */
    endpointDiscoveryEnabledProvider?: __Provider<boolean | undefined>;
}
/**
 * @public
 */
export type DynamoDBClientConfigType = Partial<__SmithyConfiguration<__HttpHandlerOptions>> & ClientDefaults & AccountIdEndpointModeInputConfig & UserAgentInputConfig & RetryInputConfig & RegionInputConfig & HostHeaderInputConfig & EndpointInputConfig<EndpointParameters> & HttpAuthSchemeInputConfig & EndpointDiscoveryInputConfig & ClientInputEndpointParameters;
/**
 * @public
 *
 *  The configuration interface of DynamoDBClient class constructor that set the region, credentials and other options.
 */
export interface DynamoDBClientConfig extends DynamoDBClientConfigType {
}
/**
 * @public
 */
export type DynamoDBClientResolvedConfigType = __SmithyResolvedConfiguration<__HttpHandlerOptions> & Required<ClientDefaults> & RuntimeExtensionsConfig & AccountIdEndpointModeResolvedConfig & UserAgentResolvedConfig & RetryResolvedConfig & RegionResolvedConfig & HostHeaderResolvedConfig & EndpointResolvedConfig<EndpointParameters> & HttpAuthSchemeResolvedConfig & EndpointDiscoveryResolvedConfig & ClientResolvedEndpointParameters;
/**
 * @public
 *
 *  The resolved configuration interface of DynamoDBClient class. This is resolved and normalized from the {@link DynamoDBClientConfig | constructor configuration interface}.
 */
export interface DynamoDBClientResolvedConfig extends DynamoDBClientResolvedConfigType {
}
/**
 * <fullname>Amazon DynamoDB</fullname>
 *          <p>Amazon DynamoDB is a fully managed NoSQL database service that provides fast
 *             and predictable performance with seamless scalability. DynamoDB lets you
 *             offload the administrative burdens of operating and scaling a distributed database, so
 *             that you don't have to worry about hardware provisioning, setup and configuration,
 *             replication, software patching, or cluster scaling.</p>
 *          <p>With DynamoDB, you can create database tables that can store and retrieve
 *             any amount of data, and serve any level of request traffic. You can scale up or scale
 *             down your tables' throughput capacity without downtime or performance degradation, and
 *             use the Amazon Web Services Management Console to monitor resource utilization and performance
 *             metrics.</p>
 *          <p>DynamoDB automatically spreads the data and traffic for your tables over
 *             a sufficient number of servers to handle your throughput and storage requirements, while
 *             maintaining consistent and fast performance. All of your data is stored on solid state
 *             disks (SSDs) and automatically replicated across multiple Availability Zones in an
 *                 Amazon Web Services Region, providing built-in high availability and data
 *             durability.</p>
 * @public
 */
export declare class DynamoDBClient extends __Client<__HttpHandlerOptions, ServiceInputTypes, ServiceOutputTypes, DynamoDBClientResolvedConfig> {
    /**
     * The resolved configuration of DynamoDBClient class. This is resolved and normalized from the {@link DynamoDBClientConfig | constructor configuration interface}.
     */
    readonly config: DynamoDBClientResolvedConfig;
    constructor(...[configuration]: __CheckOptionalClientConfig<DynamoDBClientConfig>);
    /**
     * Destroy underlying resources, like sockets. It's usually not necessary to do this.
     * However in Node.js, it's best to explicitly shut down the client's agent when it is no longer needed.
     * Otherwise, sockets might stay open for quite a long time before the server terminates them.
     */
    destroy(): void;
}
