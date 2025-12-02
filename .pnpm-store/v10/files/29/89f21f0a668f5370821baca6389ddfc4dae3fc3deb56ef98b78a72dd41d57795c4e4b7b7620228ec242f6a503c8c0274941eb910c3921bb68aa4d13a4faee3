import {
  AccountIdEndpointMode,
  AccountIdEndpointModeInputConfig,
  AccountIdEndpointModeResolvedConfig,
} from "@aws-sdk/core/account-id-endpoint";
import {
  EndpointDiscoveryInputConfig,
  EndpointDiscoveryResolvedConfig,
} from "@aws-sdk/middleware-endpoint-discovery";
import {
  HostHeaderInputConfig,
  HostHeaderResolvedConfig,
} from "@aws-sdk/middleware-host-header";
import {
  UserAgentInputConfig,
  UserAgentResolvedConfig,
} from "@aws-sdk/middleware-user-agent";
import {
  RegionInputConfig,
  RegionResolvedConfig,
} from "@smithy/config-resolver";
import {
  EndpointInputConfig,
  EndpointResolvedConfig,
} from "@smithy/middleware-endpoint";
import {
  RetryInputConfig,
  RetryResolvedConfig,
} from "@smithy/middleware-retry";
import { HttpHandlerUserInput as __HttpHandlerUserInput } from "@smithy/protocol-http";
import {
  Client as __Client,
  DefaultsMode as __DefaultsMode,
  SmithyConfiguration as __SmithyConfiguration,
  SmithyResolvedConfiguration as __SmithyResolvedConfiguration,
} from "@smithy/smithy-client";
import {
  AwsCredentialIdentityProvider,
  BodyLengthCalculator as __BodyLengthCalculator,
  CheckOptionalClientConfig as __CheckOptionalClientConfig,
  ChecksumConstructor as __ChecksumConstructor,
  Decoder as __Decoder,
  Encoder as __Encoder,
  HashConstructor as __HashConstructor,
  HttpHandlerOptions as __HttpHandlerOptions,
  Logger as __Logger,
  Provider as __Provider,
  Provider,
  StreamCollector as __StreamCollector,
  UrlParser as __UrlParser,
  UserAgent as __UserAgent,
} from "@smithy/types";
import {
  HttpAuthSchemeInputConfig,
  HttpAuthSchemeResolvedConfig,
} from "./auth/httpAuthSchemeProvider";
import {
  BatchExecuteStatementCommandInput,
  BatchExecuteStatementCommandOutput,
} from "./commands/BatchExecuteStatementCommand";
import {
  BatchGetItemCommandInput,
  BatchGetItemCommandOutput,
} from "./commands/BatchGetItemCommand";
import {
  BatchWriteItemCommandInput,
  BatchWriteItemCommandOutput,
} from "./commands/BatchWriteItemCommand";
import {
  CreateBackupCommandInput,
  CreateBackupCommandOutput,
} from "./commands/CreateBackupCommand";
import {
  CreateGlobalTableCommandInput,
  CreateGlobalTableCommandOutput,
} from "./commands/CreateGlobalTableCommand";
import {
  CreateTableCommandInput,
  CreateTableCommandOutput,
} from "./commands/CreateTableCommand";
import {
  DeleteBackupCommandInput,
  DeleteBackupCommandOutput,
} from "./commands/DeleteBackupCommand";
import {
  DeleteItemCommandInput,
  DeleteItemCommandOutput,
} from "./commands/DeleteItemCommand";
import {
  DeleteResourcePolicyCommandInput,
  DeleteResourcePolicyCommandOutput,
} from "./commands/DeleteResourcePolicyCommand";
import {
  DeleteTableCommandInput,
  DeleteTableCommandOutput,
} from "./commands/DeleteTableCommand";
import {
  DescribeBackupCommandInput,
  DescribeBackupCommandOutput,
} from "./commands/DescribeBackupCommand";
import {
  DescribeContinuousBackupsCommandInput,
  DescribeContinuousBackupsCommandOutput,
} from "./commands/DescribeContinuousBackupsCommand";
import {
  DescribeContributorInsightsCommandInput,
  DescribeContributorInsightsCommandOutput,
} from "./commands/DescribeContributorInsightsCommand";
import {
  DescribeEndpointsCommandInput,
  DescribeEndpointsCommandOutput,
} from "./commands/DescribeEndpointsCommand";
import {
  DescribeExportCommandInput,
  DescribeExportCommandOutput,
} from "./commands/DescribeExportCommand";
import {
  DescribeGlobalTableCommandInput,
  DescribeGlobalTableCommandOutput,
} from "./commands/DescribeGlobalTableCommand";
import {
  DescribeGlobalTableSettingsCommandInput,
  DescribeGlobalTableSettingsCommandOutput,
} from "./commands/DescribeGlobalTableSettingsCommand";
import {
  DescribeImportCommandInput,
  DescribeImportCommandOutput,
} from "./commands/DescribeImportCommand";
import {
  DescribeKinesisStreamingDestinationCommandInput,
  DescribeKinesisStreamingDestinationCommandOutput,
} from "./commands/DescribeKinesisStreamingDestinationCommand";
import {
  DescribeLimitsCommandInput,
  DescribeLimitsCommandOutput,
} from "./commands/DescribeLimitsCommand";
import {
  DescribeTableCommandInput,
  DescribeTableCommandOutput,
} from "./commands/DescribeTableCommand";
import {
  DescribeTableReplicaAutoScalingCommandInput,
  DescribeTableReplicaAutoScalingCommandOutput,
} from "./commands/DescribeTableReplicaAutoScalingCommand";
import {
  DescribeTimeToLiveCommandInput,
  DescribeTimeToLiveCommandOutput,
} from "./commands/DescribeTimeToLiveCommand";
import {
  DisableKinesisStreamingDestinationCommandInput,
  DisableKinesisStreamingDestinationCommandOutput,
} from "./commands/DisableKinesisStreamingDestinationCommand";
import {
  EnableKinesisStreamingDestinationCommandInput,
  EnableKinesisStreamingDestinationCommandOutput,
} from "./commands/EnableKinesisStreamingDestinationCommand";
import {
  ExecuteStatementCommandInput,
  ExecuteStatementCommandOutput,
} from "./commands/ExecuteStatementCommand";
import {
  ExecuteTransactionCommandInput,
  ExecuteTransactionCommandOutput,
} from "./commands/ExecuteTransactionCommand";
import {
  ExportTableToPointInTimeCommandInput,
  ExportTableToPointInTimeCommandOutput,
} from "./commands/ExportTableToPointInTimeCommand";
import {
  GetItemCommandInput,
  GetItemCommandOutput,
} from "./commands/GetItemCommand";
import {
  GetResourcePolicyCommandInput,
  GetResourcePolicyCommandOutput,
} from "./commands/GetResourcePolicyCommand";
import {
  ImportTableCommandInput,
  ImportTableCommandOutput,
} from "./commands/ImportTableCommand";
import {
  ListBackupsCommandInput,
  ListBackupsCommandOutput,
} from "./commands/ListBackupsCommand";
import {
  ListContributorInsightsCommandInput,
  ListContributorInsightsCommandOutput,
} from "./commands/ListContributorInsightsCommand";
import {
  ListExportsCommandInput,
  ListExportsCommandOutput,
} from "./commands/ListExportsCommand";
import {
  ListGlobalTablesCommandInput,
  ListGlobalTablesCommandOutput,
} from "./commands/ListGlobalTablesCommand";
import {
  ListImportsCommandInput,
  ListImportsCommandOutput,
} from "./commands/ListImportsCommand";
import {
  ListTablesCommandInput,
  ListTablesCommandOutput,
} from "./commands/ListTablesCommand";
import {
  ListTagsOfResourceCommandInput,
  ListTagsOfResourceCommandOutput,
} from "./commands/ListTagsOfResourceCommand";
import {
  PutItemCommandInput,
  PutItemCommandOutput,
} from "./commands/PutItemCommand";
import {
  PutResourcePolicyCommandInput,
  PutResourcePolicyCommandOutput,
} from "./commands/PutResourcePolicyCommand";
import { QueryCommandInput, QueryCommandOutput } from "./commands/QueryCommand";
import {
  RestoreTableFromBackupCommandInput,
  RestoreTableFromBackupCommandOutput,
} from "./commands/RestoreTableFromBackupCommand";
import {
  RestoreTableToPointInTimeCommandInput,
  RestoreTableToPointInTimeCommandOutput,
} from "./commands/RestoreTableToPointInTimeCommand";
import { ScanCommandInput, ScanCommandOutput } from "./commands/ScanCommand";
import {
  TagResourceCommandInput,
  TagResourceCommandOutput,
} from "./commands/TagResourceCommand";
import {
  TransactGetItemsCommandInput,
  TransactGetItemsCommandOutput,
} from "./commands/TransactGetItemsCommand";
import {
  TransactWriteItemsCommandInput,
  TransactWriteItemsCommandOutput,
} from "./commands/TransactWriteItemsCommand";
import {
  UntagResourceCommandInput,
  UntagResourceCommandOutput,
} from "./commands/UntagResourceCommand";
import {
  UpdateContinuousBackupsCommandInput,
  UpdateContinuousBackupsCommandOutput,
} from "./commands/UpdateContinuousBackupsCommand";
import {
  UpdateContributorInsightsCommandInput,
  UpdateContributorInsightsCommandOutput,
} from "./commands/UpdateContributorInsightsCommand";
import {
  UpdateGlobalTableCommandInput,
  UpdateGlobalTableCommandOutput,
} from "./commands/UpdateGlobalTableCommand";
import {
  UpdateGlobalTableSettingsCommandInput,
  UpdateGlobalTableSettingsCommandOutput,
} from "./commands/UpdateGlobalTableSettingsCommand";
import {
  UpdateItemCommandInput,
  UpdateItemCommandOutput,
} from "./commands/UpdateItemCommand";
import {
  UpdateKinesisStreamingDestinationCommandInput,
  UpdateKinesisStreamingDestinationCommandOutput,
} from "./commands/UpdateKinesisStreamingDestinationCommand";
import {
  UpdateTableCommandInput,
  UpdateTableCommandOutput,
} from "./commands/UpdateTableCommand";
import {
  UpdateTableReplicaAutoScalingCommandInput,
  UpdateTableReplicaAutoScalingCommandOutput,
} from "./commands/UpdateTableReplicaAutoScalingCommand";
import {
  UpdateTimeToLiveCommandInput,
  UpdateTimeToLiveCommandOutput,
} from "./commands/UpdateTimeToLiveCommand";
import {
  ClientInputEndpointParameters,
  ClientResolvedEndpointParameters,
  EndpointParameters,
} from "./endpoint/EndpointParameters";
import { RuntimeExtension, RuntimeExtensionsConfig } from "./runtimeExtensions";
export { __Client };
export type ServiceInputTypes =
  | BatchExecuteStatementCommandInput
  | BatchGetItemCommandInput
  | BatchWriteItemCommandInput
  | CreateBackupCommandInput
  | CreateGlobalTableCommandInput
  | CreateTableCommandInput
  | DeleteBackupCommandInput
  | DeleteItemCommandInput
  | DeleteResourcePolicyCommandInput
  | DeleteTableCommandInput
  | DescribeBackupCommandInput
  | DescribeContinuousBackupsCommandInput
  | DescribeContributorInsightsCommandInput
  | DescribeEndpointsCommandInput
  | DescribeExportCommandInput
  | DescribeGlobalTableCommandInput
  | DescribeGlobalTableSettingsCommandInput
  | DescribeImportCommandInput
  | DescribeKinesisStreamingDestinationCommandInput
  | DescribeLimitsCommandInput
  | DescribeTableCommandInput
  | DescribeTableReplicaAutoScalingCommandInput
  | DescribeTimeToLiveCommandInput
  | DisableKinesisStreamingDestinationCommandInput
  | EnableKinesisStreamingDestinationCommandInput
  | ExecuteStatementCommandInput
  | ExecuteTransactionCommandInput
  | ExportTableToPointInTimeCommandInput
  | GetItemCommandInput
  | GetResourcePolicyCommandInput
  | ImportTableCommandInput
  | ListBackupsCommandInput
  | ListContributorInsightsCommandInput
  | ListExportsCommandInput
  | ListGlobalTablesCommandInput
  | ListImportsCommandInput
  | ListTablesCommandInput
  | ListTagsOfResourceCommandInput
  | PutItemCommandInput
  | PutResourcePolicyCommandInput
  | QueryCommandInput
  | RestoreTableFromBackupCommandInput
  | RestoreTableToPointInTimeCommandInput
  | ScanCommandInput
  | TagResourceCommandInput
  | TransactGetItemsCommandInput
  | TransactWriteItemsCommandInput
  | UntagResourceCommandInput
  | UpdateContinuousBackupsCommandInput
  | UpdateContributorInsightsCommandInput
  | UpdateGlobalTableCommandInput
  | UpdateGlobalTableSettingsCommandInput
  | UpdateItemCommandInput
  | UpdateKinesisStreamingDestinationCommandInput
  | UpdateTableCommandInput
  | UpdateTableReplicaAutoScalingCommandInput
  | UpdateTimeToLiveCommandInput;
export type ServiceOutputTypes =
  | BatchExecuteStatementCommandOutput
  | BatchGetItemCommandOutput
  | BatchWriteItemCommandOutput
  | CreateBackupCommandOutput
  | CreateGlobalTableCommandOutput
  | CreateTableCommandOutput
  | DeleteBackupCommandOutput
  | DeleteItemCommandOutput
  | DeleteResourcePolicyCommandOutput
  | DeleteTableCommandOutput
  | DescribeBackupCommandOutput
  | DescribeContinuousBackupsCommandOutput
  | DescribeContributorInsightsCommandOutput
  | DescribeEndpointsCommandOutput
  | DescribeExportCommandOutput
  | DescribeGlobalTableCommandOutput
  | DescribeGlobalTableSettingsCommandOutput
  | DescribeImportCommandOutput
  | DescribeKinesisStreamingDestinationCommandOutput
  | DescribeLimitsCommandOutput
  | DescribeTableCommandOutput
  | DescribeTableReplicaAutoScalingCommandOutput
  | DescribeTimeToLiveCommandOutput
  | DisableKinesisStreamingDestinationCommandOutput
  | EnableKinesisStreamingDestinationCommandOutput
  | ExecuteStatementCommandOutput
  | ExecuteTransactionCommandOutput
  | ExportTableToPointInTimeCommandOutput
  | GetItemCommandOutput
  | GetResourcePolicyCommandOutput
  | ImportTableCommandOutput
  | ListBackupsCommandOutput
  | ListContributorInsightsCommandOutput
  | ListExportsCommandOutput
  | ListGlobalTablesCommandOutput
  | ListImportsCommandOutput
  | ListTablesCommandOutput
  | ListTagsOfResourceCommandOutput
  | PutItemCommandOutput
  | PutResourcePolicyCommandOutput
  | QueryCommandOutput
  | RestoreTableFromBackupCommandOutput
  | RestoreTableToPointInTimeCommandOutput
  | ScanCommandOutput
  | TagResourceCommandOutput
  | TransactGetItemsCommandOutput
  | TransactWriteItemsCommandOutput
  | UntagResourceCommandOutput
  | UpdateContinuousBackupsCommandOutput
  | UpdateContributorInsightsCommandOutput
  | UpdateGlobalTableCommandOutput
  | UpdateGlobalTableSettingsCommandOutput
  | UpdateItemCommandOutput
  | UpdateKinesisStreamingDestinationCommandOutput
  | UpdateTableCommandOutput
  | UpdateTableReplicaAutoScalingCommandOutput
  | UpdateTimeToLiveCommandOutput;
export interface ClientDefaults
  extends Partial<__SmithyConfiguration<__HttpHandlerOptions>> {
  requestHandler?: __HttpHandlerUserInput;
  sha256?: __ChecksumConstructor | __HashConstructor;
  urlParser?: __UrlParser;
  bodyLengthChecker?: __BodyLengthCalculator;
  streamCollector?: __StreamCollector;
  base64Decoder?: __Decoder;
  base64Encoder?: __Encoder;
  utf8Decoder?: __Decoder;
  utf8Encoder?: __Encoder;
  runtime?: string;
  disableHostPrefix?: boolean;
  serviceId?: string;
  useDualstackEndpoint?: boolean | __Provider<boolean>;
  useFipsEndpoint?: boolean | __Provider<boolean>;
  region?: string | __Provider<string>;
  profile?: string;
  accountIdEndpointMode?:
    | AccountIdEndpointMode
    | __Provider<AccountIdEndpointMode>;
  defaultUserAgentProvider?: Provider<__UserAgent>;
  credentialDefaultProvider?: (input: any) => AwsCredentialIdentityProvider;
  maxAttempts?: number | __Provider<number>;
  retryMode?: string | __Provider<string>;
  logger?: __Logger;
  extensions?: RuntimeExtension[];
  defaultsMode?: __DefaultsMode | __Provider<__DefaultsMode>;
  endpointDiscoveryEnabledProvider?: __Provider<boolean | undefined>;
}
export type DynamoDBClientConfigType = Partial<
  __SmithyConfiguration<__HttpHandlerOptions>
> &
  ClientDefaults &
  AccountIdEndpointModeInputConfig &
  UserAgentInputConfig &
  RetryInputConfig &
  RegionInputConfig &
  HostHeaderInputConfig &
  EndpointInputConfig<EndpointParameters> &
  HttpAuthSchemeInputConfig &
  EndpointDiscoveryInputConfig &
  ClientInputEndpointParameters;
export interface DynamoDBClientConfig extends DynamoDBClientConfigType {}
export type DynamoDBClientResolvedConfigType =
  __SmithyResolvedConfiguration<__HttpHandlerOptions> &
    Required<ClientDefaults> &
    RuntimeExtensionsConfig &
    AccountIdEndpointModeResolvedConfig &
    UserAgentResolvedConfig &
    RetryResolvedConfig &
    RegionResolvedConfig &
    HostHeaderResolvedConfig &
    EndpointResolvedConfig<EndpointParameters> &
    HttpAuthSchemeResolvedConfig &
    EndpointDiscoveryResolvedConfig &
    ClientResolvedEndpointParameters;
export interface DynamoDBClientResolvedConfig
  extends DynamoDBClientResolvedConfigType {}
export declare class DynamoDBClient extends __Client<
  __HttpHandlerOptions,
  ServiceInputTypes,
  ServiceOutputTypes,
  DynamoDBClientResolvedConfig
> {
  readonly config: DynamoDBClientResolvedConfig;
  constructor(
    ...[configuration]: __CheckOptionalClientConfig<DynamoDBClientConfig>
  );
  destroy(): void;
}
