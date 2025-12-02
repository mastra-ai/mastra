import { ExceptionOptionType as __ExceptionOptionType } from "@smithy/smithy-client";
import { DynamoDBServiceException as __BaseException } from "./DynamoDBServiceException";
export declare const ApproximateCreationDateTimePrecision: {
  readonly MICROSECOND: "MICROSECOND";
  readonly MILLISECOND: "MILLISECOND";
};
export type ApproximateCreationDateTimePrecision =
  (typeof ApproximateCreationDateTimePrecision)[keyof typeof ApproximateCreationDateTimePrecision];
export interface ArchivalSummary {
  ArchivalDateTime?: Date | undefined;
  ArchivalReason?: string | undefined;
  ArchivalBackupArn?: string | undefined;
}
export declare const AttributeAction: {
  readonly ADD: "ADD";
  readonly DELETE: "DELETE";
  readonly PUT: "PUT";
};
export type AttributeAction =
  (typeof AttributeAction)[keyof typeof AttributeAction];
export declare const ScalarAttributeType: {
  readonly B: "B";
  readonly N: "N";
  readonly S: "S";
};
export type ScalarAttributeType =
  (typeof ScalarAttributeType)[keyof typeof ScalarAttributeType];
export interface AttributeDefinition {
  AttributeName: string | undefined;
  AttributeType: ScalarAttributeType | undefined;
}
export interface AutoScalingTargetTrackingScalingPolicyConfigurationDescription {
  DisableScaleIn?: boolean | undefined;
  ScaleInCooldown?: number | undefined;
  ScaleOutCooldown?: number | undefined;
  TargetValue: number | undefined;
}
export interface AutoScalingPolicyDescription {
  PolicyName?: string | undefined;
  TargetTrackingScalingPolicyConfiguration?:
    | AutoScalingTargetTrackingScalingPolicyConfigurationDescription
    | undefined;
}
export interface AutoScalingTargetTrackingScalingPolicyConfigurationUpdate {
  DisableScaleIn?: boolean | undefined;
  ScaleInCooldown?: number | undefined;
  ScaleOutCooldown?: number | undefined;
  TargetValue: number | undefined;
}
export interface AutoScalingPolicyUpdate {
  PolicyName?: string | undefined;
  TargetTrackingScalingPolicyConfiguration:
    | AutoScalingTargetTrackingScalingPolicyConfigurationUpdate
    | undefined;
}
export interface AutoScalingSettingsDescription {
  MinimumUnits?: number | undefined;
  MaximumUnits?: number | undefined;
  AutoScalingDisabled?: boolean | undefined;
  AutoScalingRoleArn?: string | undefined;
  ScalingPolicies?: AutoScalingPolicyDescription[] | undefined;
}
export interface AutoScalingSettingsUpdate {
  MinimumUnits?: number | undefined;
  MaximumUnits?: number | undefined;
  AutoScalingDisabled?: boolean | undefined;
  AutoScalingRoleArn?: string | undefined;
  ScalingPolicyUpdate?: AutoScalingPolicyUpdate | undefined;
}
export declare const BackupStatus: {
  readonly AVAILABLE: "AVAILABLE";
  readonly CREATING: "CREATING";
  readonly DELETED: "DELETED";
};
export type BackupStatus = (typeof BackupStatus)[keyof typeof BackupStatus];
export declare const BackupType: {
  readonly AWS_BACKUP: "AWS_BACKUP";
  readonly SYSTEM: "SYSTEM";
  readonly USER: "USER";
};
export type BackupType = (typeof BackupType)[keyof typeof BackupType];
export interface BackupDetails {
  BackupArn: string | undefined;
  BackupName: string | undefined;
  BackupSizeBytes?: number | undefined;
  BackupStatus: BackupStatus | undefined;
  BackupType: BackupType | undefined;
  BackupCreationDateTime: Date | undefined;
  BackupExpiryDateTime?: Date | undefined;
}
export declare const BillingMode: {
  readonly PAY_PER_REQUEST: "PAY_PER_REQUEST";
  readonly PROVISIONED: "PROVISIONED";
};
export type BillingMode = (typeof BillingMode)[keyof typeof BillingMode];
export declare const KeyType: {
  readonly HASH: "HASH";
  readonly RANGE: "RANGE";
};
export type KeyType = (typeof KeyType)[keyof typeof KeyType];
export interface KeySchemaElement {
  AttributeName: string | undefined;
  KeyType: KeyType | undefined;
}
export interface OnDemandThroughput {
  MaxReadRequestUnits?: number | undefined;
  MaxWriteRequestUnits?: number | undefined;
}
export interface ProvisionedThroughput {
  ReadCapacityUnits: number | undefined;
  WriteCapacityUnits: number | undefined;
}
export interface SourceTableDetails {
  TableName: string | undefined;
  TableId: string | undefined;
  TableArn?: string | undefined;
  TableSizeBytes?: number | undefined;
  KeySchema: KeySchemaElement[] | undefined;
  TableCreationDateTime: Date | undefined;
  ProvisionedThroughput: ProvisionedThroughput | undefined;
  OnDemandThroughput?: OnDemandThroughput | undefined;
  ItemCount?: number | undefined;
  BillingMode?: BillingMode | undefined;
}
export declare const ProjectionType: {
  readonly ALL: "ALL";
  readonly INCLUDE: "INCLUDE";
  readonly KEYS_ONLY: "KEYS_ONLY";
};
export type ProjectionType =
  (typeof ProjectionType)[keyof typeof ProjectionType];
export interface Projection {
  ProjectionType?: ProjectionType | undefined;
  NonKeyAttributes?: string[] | undefined;
}
export interface GlobalSecondaryIndexInfo {
  IndexName?: string | undefined;
  KeySchema?: KeySchemaElement[] | undefined;
  Projection?: Projection | undefined;
  ProvisionedThroughput?: ProvisionedThroughput | undefined;
  OnDemandThroughput?: OnDemandThroughput | undefined;
}
export interface LocalSecondaryIndexInfo {
  IndexName?: string | undefined;
  KeySchema?: KeySchemaElement[] | undefined;
  Projection?: Projection | undefined;
}
export declare const SSEType: {
  readonly AES256: "AES256";
  readonly KMS: "KMS";
};
export type SSEType = (typeof SSEType)[keyof typeof SSEType];
export declare const SSEStatus: {
  readonly DISABLED: "DISABLED";
  readonly DISABLING: "DISABLING";
  readonly ENABLED: "ENABLED";
  readonly ENABLING: "ENABLING";
  readonly UPDATING: "UPDATING";
};
export type SSEStatus = (typeof SSEStatus)[keyof typeof SSEStatus];
export interface SSEDescription {
  Status?: SSEStatus | undefined;
  SSEType?: SSEType | undefined;
  KMSMasterKeyArn?: string | undefined;
  InaccessibleEncryptionDateTime?: Date | undefined;
}
export declare const StreamViewType: {
  readonly KEYS_ONLY: "KEYS_ONLY";
  readonly NEW_AND_OLD_IMAGES: "NEW_AND_OLD_IMAGES";
  readonly NEW_IMAGE: "NEW_IMAGE";
  readonly OLD_IMAGE: "OLD_IMAGE";
};
export type StreamViewType =
  (typeof StreamViewType)[keyof typeof StreamViewType];
export interface StreamSpecification {
  StreamEnabled: boolean | undefined;
  StreamViewType?: StreamViewType | undefined;
}
export declare const TimeToLiveStatus: {
  readonly DISABLED: "DISABLED";
  readonly DISABLING: "DISABLING";
  readonly ENABLED: "ENABLED";
  readonly ENABLING: "ENABLING";
};
export type TimeToLiveStatus =
  (typeof TimeToLiveStatus)[keyof typeof TimeToLiveStatus];
export interface TimeToLiveDescription {
  TimeToLiveStatus?: TimeToLiveStatus | undefined;
  AttributeName?: string | undefined;
}
export interface SourceTableFeatureDetails {
  LocalSecondaryIndexes?: LocalSecondaryIndexInfo[] | undefined;
  GlobalSecondaryIndexes?: GlobalSecondaryIndexInfo[] | undefined;
  StreamDescription?: StreamSpecification | undefined;
  TimeToLiveDescription?: TimeToLiveDescription | undefined;
  SSEDescription?: SSEDescription | undefined;
}
export interface BackupDescription {
  BackupDetails?: BackupDetails | undefined;
  SourceTableDetails?: SourceTableDetails | undefined;
  SourceTableFeatureDetails?: SourceTableFeatureDetails | undefined;
}
export declare class BackupInUseException extends __BaseException {
  readonly name: "BackupInUseException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<BackupInUseException, __BaseException>
  );
}
export declare class BackupNotFoundException extends __BaseException {
  readonly name: "BackupNotFoundException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<BackupNotFoundException, __BaseException>
  );
}
export interface BackupSummary {
  TableName?: string | undefined;
  TableId?: string | undefined;
  TableArn?: string | undefined;
  BackupArn?: string | undefined;
  BackupName?: string | undefined;
  BackupCreationDateTime?: Date | undefined;
  BackupExpiryDateTime?: Date | undefined;
  BackupStatus?: BackupStatus | undefined;
  BackupType?: BackupType | undefined;
  BackupSizeBytes?: number | undefined;
}
export declare const BackupTypeFilter: {
  readonly ALL: "ALL";
  readonly AWS_BACKUP: "AWS_BACKUP";
  readonly SYSTEM: "SYSTEM";
  readonly USER: "USER";
};
export type BackupTypeFilter =
  (typeof BackupTypeFilter)[keyof typeof BackupTypeFilter];
export declare const ReturnConsumedCapacity: {
  readonly INDEXES: "INDEXES";
  readonly NONE: "NONE";
  readonly TOTAL: "TOTAL";
};
export type ReturnConsumedCapacity =
  (typeof ReturnConsumedCapacity)[keyof typeof ReturnConsumedCapacity];
export declare const ReturnValuesOnConditionCheckFailure: {
  readonly ALL_OLD: "ALL_OLD";
  readonly NONE: "NONE";
};
export type ReturnValuesOnConditionCheckFailure =
  (typeof ReturnValuesOnConditionCheckFailure)[keyof typeof ReturnValuesOnConditionCheckFailure];
export interface Capacity {
  ReadCapacityUnits?: number | undefined;
  WriteCapacityUnits?: number | undefined;
  CapacityUnits?: number | undefined;
}
export interface ConsumedCapacity {
  TableName?: string | undefined;
  CapacityUnits?: number | undefined;
  ReadCapacityUnits?: number | undefined;
  WriteCapacityUnits?: number | undefined;
  Table?: Capacity | undefined;
  LocalSecondaryIndexes?: Record<string, Capacity> | undefined;
  GlobalSecondaryIndexes?: Record<string, Capacity> | undefined;
}
export declare const BatchStatementErrorCodeEnum: {
  readonly AccessDenied: "AccessDenied";
  readonly ConditionalCheckFailed: "ConditionalCheckFailed";
  readonly DuplicateItem: "DuplicateItem";
  readonly InternalServerError: "InternalServerError";
  readonly ItemCollectionSizeLimitExceeded: "ItemCollectionSizeLimitExceeded";
  readonly ProvisionedThroughputExceeded: "ProvisionedThroughputExceeded";
  readonly RequestLimitExceeded: "RequestLimitExceeded";
  readonly ResourceNotFound: "ResourceNotFound";
  readonly ThrottlingError: "ThrottlingError";
  readonly TransactionConflict: "TransactionConflict";
  readonly ValidationError: "ValidationError";
};
export type BatchStatementErrorCodeEnum =
  (typeof BatchStatementErrorCodeEnum)[keyof typeof BatchStatementErrorCodeEnum];
export declare class InternalServerError extends __BaseException {
  readonly name: "InternalServerError";
  readonly $fault: "server";
  constructor(
    opts: __ExceptionOptionType<InternalServerError, __BaseException>
  );
}
export interface ThrottlingReason {
  reason?: string | undefined;
  resource?: string | undefined;
}
export declare class RequestLimitExceeded extends __BaseException {
  readonly name: "RequestLimitExceeded";
  readonly $fault: "client";
  ThrottlingReasons?: ThrottlingReason[] | undefined;
  constructor(
    opts: __ExceptionOptionType<RequestLimitExceeded, __BaseException>
  );
}
export declare class ThrottlingException extends __BaseException {
  readonly name: "ThrottlingException";
  readonly $fault: "client";
  throttlingReasons?: ThrottlingReason[] | undefined;
  constructor(
    opts: __ExceptionOptionType<ThrottlingException, __BaseException>
  );
}
export declare class InvalidEndpointException extends __BaseException {
  readonly name: "InvalidEndpointException";
  readonly $fault: "client";
  Message?: string | undefined;
  constructor(
    opts: __ExceptionOptionType<InvalidEndpointException, __BaseException>
  );
}
export declare class ProvisionedThroughputExceededException extends __BaseException {
  readonly name: "ProvisionedThroughputExceededException";
  readonly $fault: "client";
  ThrottlingReasons?: ThrottlingReason[] | undefined;
  constructor(
    opts: __ExceptionOptionType<
      ProvisionedThroughputExceededException,
      __BaseException
    >
  );
}
export declare class ResourceNotFoundException extends __BaseException {
  readonly name: "ResourceNotFoundException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ResourceNotFoundException, __BaseException>
  );
}
export declare const ReturnItemCollectionMetrics: {
  readonly NONE: "NONE";
  readonly SIZE: "SIZE";
};
export type ReturnItemCollectionMetrics =
  (typeof ReturnItemCollectionMetrics)[keyof typeof ReturnItemCollectionMetrics];
export declare class ItemCollectionSizeLimitExceededException extends __BaseException {
  readonly name: "ItemCollectionSizeLimitExceededException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<
      ItemCollectionSizeLimitExceededException,
      __BaseException
    >
  );
}
export declare class ReplicatedWriteConflictException extends __BaseException {
  readonly name: "ReplicatedWriteConflictException";
  readonly $fault: "client";
  $retryable: {};
  constructor(
    opts: __ExceptionOptionType<
      ReplicatedWriteConflictException,
      __BaseException
    >
  );
}
export interface BillingModeSummary {
  BillingMode?: BillingMode | undefined;
  LastUpdateToPayPerRequestDateTime?: Date | undefined;
}
export declare const ComparisonOperator: {
  readonly BEGINS_WITH: "BEGINS_WITH";
  readonly BETWEEN: "BETWEEN";
  readonly CONTAINS: "CONTAINS";
  readonly EQ: "EQ";
  readonly GE: "GE";
  readonly GT: "GT";
  readonly IN: "IN";
  readonly LE: "LE";
  readonly LT: "LT";
  readonly NE: "NE";
  readonly NOT_CONTAINS: "NOT_CONTAINS";
  readonly NOT_NULL: "NOT_NULL";
  readonly NULL: "NULL";
};
export type ComparisonOperator =
  (typeof ComparisonOperator)[keyof typeof ComparisonOperator];
export declare const ConditionalOperator: {
  readonly AND: "AND";
  readonly OR: "OR";
};
export type ConditionalOperator =
  (typeof ConditionalOperator)[keyof typeof ConditionalOperator];
export declare const ContinuousBackupsStatus: {
  readonly DISABLED: "DISABLED";
  readonly ENABLED: "ENABLED";
};
export type ContinuousBackupsStatus =
  (typeof ContinuousBackupsStatus)[keyof typeof ContinuousBackupsStatus];
export declare const PointInTimeRecoveryStatus: {
  readonly DISABLED: "DISABLED";
  readonly ENABLED: "ENABLED";
};
export type PointInTimeRecoveryStatus =
  (typeof PointInTimeRecoveryStatus)[keyof typeof PointInTimeRecoveryStatus];
export interface PointInTimeRecoveryDescription {
  PointInTimeRecoveryStatus?: PointInTimeRecoveryStatus | undefined;
  RecoveryPeriodInDays?: number | undefined;
  EarliestRestorableDateTime?: Date | undefined;
  LatestRestorableDateTime?: Date | undefined;
}
export interface ContinuousBackupsDescription {
  ContinuousBackupsStatus: ContinuousBackupsStatus | undefined;
  PointInTimeRecoveryDescription?: PointInTimeRecoveryDescription | undefined;
}
export declare class ContinuousBackupsUnavailableException extends __BaseException {
  readonly name: "ContinuousBackupsUnavailableException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<
      ContinuousBackupsUnavailableException,
      __BaseException
    >
  );
}
export declare const ContributorInsightsAction: {
  readonly DISABLE: "DISABLE";
  readonly ENABLE: "ENABLE";
};
export type ContributorInsightsAction =
  (typeof ContributorInsightsAction)[keyof typeof ContributorInsightsAction];
export declare const ContributorInsightsMode: {
  readonly ACCESSED_AND_THROTTLED_KEYS: "ACCESSED_AND_THROTTLED_KEYS";
  readonly THROTTLED_KEYS: "THROTTLED_KEYS";
};
export type ContributorInsightsMode =
  (typeof ContributorInsightsMode)[keyof typeof ContributorInsightsMode];
export declare const ContributorInsightsStatus: {
  readonly DISABLED: "DISABLED";
  readonly DISABLING: "DISABLING";
  readonly ENABLED: "ENABLED";
  readonly ENABLING: "ENABLING";
  readonly FAILED: "FAILED";
};
export type ContributorInsightsStatus =
  (typeof ContributorInsightsStatus)[keyof typeof ContributorInsightsStatus];
export interface ContributorInsightsSummary {
  TableName?: string | undefined;
  IndexName?: string | undefined;
  ContributorInsightsStatus?: ContributorInsightsStatus | undefined;
  ContributorInsightsMode?: ContributorInsightsMode | undefined;
}
export interface CreateBackupInput {
  TableName: string | undefined;
  BackupName: string | undefined;
}
export interface CreateBackupOutput {
  BackupDetails?: BackupDetails | undefined;
}
export declare class LimitExceededException extends __BaseException {
  readonly name: "LimitExceededException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<LimitExceededException, __BaseException>
  );
}
export declare class TableInUseException extends __BaseException {
  readonly name: "TableInUseException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<TableInUseException, __BaseException>
  );
}
export declare class TableNotFoundException extends __BaseException {
  readonly name: "TableNotFoundException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<TableNotFoundException, __BaseException>
  );
}
export interface WarmThroughput {
  ReadUnitsPerSecond?: number | undefined;
  WriteUnitsPerSecond?: number | undefined;
}
export interface CreateGlobalSecondaryIndexAction {
  IndexName: string | undefined;
  KeySchema: KeySchemaElement[] | undefined;
  Projection: Projection | undefined;
  ProvisionedThroughput?: ProvisionedThroughput | undefined;
  OnDemandThroughput?: OnDemandThroughput | undefined;
  WarmThroughput?: WarmThroughput | undefined;
}
export interface Replica {
  RegionName?: string | undefined;
}
export interface CreateGlobalTableInput {
  GlobalTableName: string | undefined;
  ReplicationGroup: Replica[] | undefined;
}
export declare const GlobalTableStatus: {
  readonly ACTIVE: "ACTIVE";
  readonly CREATING: "CREATING";
  readonly DELETING: "DELETING";
  readonly UPDATING: "UPDATING";
};
export type GlobalTableStatus =
  (typeof GlobalTableStatus)[keyof typeof GlobalTableStatus];
export interface OnDemandThroughputOverride {
  MaxReadRequestUnits?: number | undefined;
}
export interface ProvisionedThroughputOverride {
  ReadCapacityUnits?: number | undefined;
}
export declare const IndexStatus: {
  readonly ACTIVE: "ACTIVE";
  readonly CREATING: "CREATING";
  readonly DELETING: "DELETING";
  readonly UPDATING: "UPDATING";
};
export type IndexStatus = (typeof IndexStatus)[keyof typeof IndexStatus];
export interface GlobalSecondaryIndexWarmThroughputDescription {
  ReadUnitsPerSecond?: number | undefined;
  WriteUnitsPerSecond?: number | undefined;
  Status?: IndexStatus | undefined;
}
export interface ReplicaGlobalSecondaryIndexDescription {
  IndexName?: string | undefined;
  ProvisionedThroughputOverride?: ProvisionedThroughputOverride | undefined;
  OnDemandThroughputOverride?: OnDemandThroughputOverride | undefined;
  WarmThroughput?: GlobalSecondaryIndexWarmThroughputDescription | undefined;
}
export declare const ReplicaStatus: {
  readonly ACTIVE: "ACTIVE";
  readonly ARCHIVED: "ARCHIVED";
  readonly ARCHIVING: "ARCHIVING";
  readonly CREATING: "CREATING";
  readonly CREATION_FAILED: "CREATION_FAILED";
  readonly DELETING: "DELETING";
  readonly INACCESSIBLE_ENCRYPTION_CREDENTIALS: "INACCESSIBLE_ENCRYPTION_CREDENTIALS";
  readonly REGION_DISABLED: "REGION_DISABLED";
  readonly REPLICATION_NOT_AUTHORIZED: "REPLICATION_NOT_AUTHORIZED";
  readonly UPDATING: "UPDATING";
};
export type ReplicaStatus = (typeof ReplicaStatus)[keyof typeof ReplicaStatus];
export declare const TableClass: {
  readonly STANDARD: "STANDARD";
  readonly STANDARD_INFREQUENT_ACCESS: "STANDARD_INFREQUENT_ACCESS";
};
export type TableClass = (typeof TableClass)[keyof typeof TableClass];
export interface TableClassSummary {
  TableClass?: TableClass | undefined;
  LastUpdateDateTime?: Date | undefined;
}
export declare const TableStatus: {
  readonly ACTIVE: "ACTIVE";
  readonly ARCHIVED: "ARCHIVED";
  readonly ARCHIVING: "ARCHIVING";
  readonly CREATING: "CREATING";
  readonly DELETING: "DELETING";
  readonly INACCESSIBLE_ENCRYPTION_CREDENTIALS: "INACCESSIBLE_ENCRYPTION_CREDENTIALS";
  readonly REPLICATION_NOT_AUTHORIZED: "REPLICATION_NOT_AUTHORIZED";
  readonly UPDATING: "UPDATING";
};
export type TableStatus = (typeof TableStatus)[keyof typeof TableStatus];
export interface TableWarmThroughputDescription {
  ReadUnitsPerSecond?: number | undefined;
  WriteUnitsPerSecond?: number | undefined;
  Status?: TableStatus | undefined;
}
export interface ReplicaDescription {
  RegionName?: string | undefined;
  ReplicaStatus?: ReplicaStatus | undefined;
  ReplicaStatusDescription?: string | undefined;
  ReplicaStatusPercentProgress?: string | undefined;
  KMSMasterKeyId?: string | undefined;
  ProvisionedThroughputOverride?: ProvisionedThroughputOverride | undefined;
  OnDemandThroughputOverride?: OnDemandThroughputOverride | undefined;
  WarmThroughput?: TableWarmThroughputDescription | undefined;
  GlobalSecondaryIndexes?: ReplicaGlobalSecondaryIndexDescription[] | undefined;
  ReplicaInaccessibleDateTime?: Date | undefined;
  ReplicaTableClassSummary?: TableClassSummary | undefined;
}
export interface GlobalTableDescription {
  ReplicationGroup?: ReplicaDescription[] | undefined;
  GlobalTableArn?: string | undefined;
  CreationDateTime?: Date | undefined;
  GlobalTableStatus?: GlobalTableStatus | undefined;
  GlobalTableName?: string | undefined;
}
export interface CreateGlobalTableOutput {
  GlobalTableDescription?: GlobalTableDescription | undefined;
}
export declare class GlobalTableAlreadyExistsException extends __BaseException {
  readonly name: "GlobalTableAlreadyExistsException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<
      GlobalTableAlreadyExistsException,
      __BaseException
    >
  );
}
export interface CreateGlobalTableWitnessGroupMemberAction {
  RegionName: string | undefined;
}
export interface CreateReplicaAction {
  RegionName: string | undefined;
}
export interface ReplicaGlobalSecondaryIndex {
  IndexName: string | undefined;
  ProvisionedThroughputOverride?: ProvisionedThroughputOverride | undefined;
  OnDemandThroughputOverride?: OnDemandThroughputOverride | undefined;
}
export interface CreateReplicationGroupMemberAction {
  RegionName: string | undefined;
  KMSMasterKeyId?: string | undefined;
  ProvisionedThroughputOverride?: ProvisionedThroughputOverride | undefined;
  OnDemandThroughputOverride?: OnDemandThroughputOverride | undefined;
  GlobalSecondaryIndexes?: ReplicaGlobalSecondaryIndex[] | undefined;
  TableClassOverride?: TableClass | undefined;
}
export interface GlobalSecondaryIndex {
  IndexName: string | undefined;
  KeySchema: KeySchemaElement[] | undefined;
  Projection: Projection | undefined;
  ProvisionedThroughput?: ProvisionedThroughput | undefined;
  OnDemandThroughput?: OnDemandThroughput | undefined;
  WarmThroughput?: WarmThroughput | undefined;
}
export interface LocalSecondaryIndex {
  IndexName: string | undefined;
  KeySchema: KeySchemaElement[] | undefined;
  Projection: Projection | undefined;
}
export interface SSESpecification {
  Enabled?: boolean | undefined;
  SSEType?: SSEType | undefined;
  KMSMasterKeyId?: string | undefined;
}
export interface Tag {
  Key: string | undefined;
  Value: string | undefined;
}
export interface CreateTableInput {
  AttributeDefinitions: AttributeDefinition[] | undefined;
  TableName: string | undefined;
  KeySchema: KeySchemaElement[] | undefined;
  LocalSecondaryIndexes?: LocalSecondaryIndex[] | undefined;
  GlobalSecondaryIndexes?: GlobalSecondaryIndex[] | undefined;
  BillingMode?: BillingMode | undefined;
  ProvisionedThroughput?: ProvisionedThroughput | undefined;
  StreamSpecification?: StreamSpecification | undefined;
  SSESpecification?: SSESpecification | undefined;
  Tags?: Tag[] | undefined;
  TableClass?: TableClass | undefined;
  DeletionProtectionEnabled?: boolean | undefined;
  WarmThroughput?: WarmThroughput | undefined;
  ResourcePolicy?: string | undefined;
  OnDemandThroughput?: OnDemandThroughput | undefined;
}
export interface ProvisionedThroughputDescription {
  LastIncreaseDateTime?: Date | undefined;
  LastDecreaseDateTime?: Date | undefined;
  NumberOfDecreasesToday?: number | undefined;
  ReadCapacityUnits?: number | undefined;
  WriteCapacityUnits?: number | undefined;
}
export interface GlobalSecondaryIndexDescription {
  IndexName?: string | undefined;
  KeySchema?: KeySchemaElement[] | undefined;
  Projection?: Projection | undefined;
  IndexStatus?: IndexStatus | undefined;
  Backfilling?: boolean | undefined;
  ProvisionedThroughput?: ProvisionedThroughputDescription | undefined;
  IndexSizeBytes?: number | undefined;
  ItemCount?: number | undefined;
  IndexArn?: string | undefined;
  OnDemandThroughput?: OnDemandThroughput | undefined;
  WarmThroughput?: GlobalSecondaryIndexWarmThroughputDescription | undefined;
}
export declare const WitnessStatus: {
  readonly ACTIVE: "ACTIVE";
  readonly CREATING: "CREATING";
  readonly DELETING: "DELETING";
};
export type WitnessStatus = (typeof WitnessStatus)[keyof typeof WitnessStatus];
export interface GlobalTableWitnessDescription {
  RegionName?: string | undefined;
  WitnessStatus?: WitnessStatus | undefined;
}
export interface LocalSecondaryIndexDescription {
  IndexName?: string | undefined;
  KeySchema?: KeySchemaElement[] | undefined;
  Projection?: Projection | undefined;
  IndexSizeBytes?: number | undefined;
  ItemCount?: number | undefined;
  IndexArn?: string | undefined;
}
export declare const MultiRegionConsistency: {
  readonly EVENTUAL: "EVENTUAL";
  readonly STRONG: "STRONG";
};
export type MultiRegionConsistency =
  (typeof MultiRegionConsistency)[keyof typeof MultiRegionConsistency];
export interface RestoreSummary {
  SourceBackupArn?: string | undefined;
  SourceTableArn?: string | undefined;
  RestoreDateTime: Date | undefined;
  RestoreInProgress: boolean | undefined;
}
export interface TableDescription {
  AttributeDefinitions?: AttributeDefinition[] | undefined;
  TableName?: string | undefined;
  KeySchema?: KeySchemaElement[] | undefined;
  TableStatus?: TableStatus | undefined;
  CreationDateTime?: Date | undefined;
  ProvisionedThroughput?: ProvisionedThroughputDescription | undefined;
  TableSizeBytes?: number | undefined;
  ItemCount?: number | undefined;
  TableArn?: string | undefined;
  TableId?: string | undefined;
  BillingModeSummary?: BillingModeSummary | undefined;
  LocalSecondaryIndexes?: LocalSecondaryIndexDescription[] | undefined;
  GlobalSecondaryIndexes?: GlobalSecondaryIndexDescription[] | undefined;
  StreamSpecification?: StreamSpecification | undefined;
  LatestStreamLabel?: string | undefined;
  LatestStreamArn?: string | undefined;
  GlobalTableVersion?: string | undefined;
  Replicas?: ReplicaDescription[] | undefined;
  GlobalTableWitnesses?: GlobalTableWitnessDescription[] | undefined;
  RestoreSummary?: RestoreSummary | undefined;
  SSEDescription?: SSEDescription | undefined;
  ArchivalSummary?: ArchivalSummary | undefined;
  TableClassSummary?: TableClassSummary | undefined;
  DeletionProtectionEnabled?: boolean | undefined;
  OnDemandThroughput?: OnDemandThroughput | undefined;
  WarmThroughput?: TableWarmThroughputDescription | undefined;
  MultiRegionConsistency?: MultiRegionConsistency | undefined;
}
export interface CreateTableOutput {
  TableDescription?: TableDescription | undefined;
}
export declare class ResourceInUseException extends __BaseException {
  readonly name: "ResourceInUseException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ResourceInUseException, __BaseException>
  );
}
export interface CsvOptions {
  Delimiter?: string | undefined;
  HeaderList?: string[] | undefined;
}
export interface DeleteBackupInput {
  BackupArn: string | undefined;
}
export interface DeleteBackupOutput {
  BackupDescription?: BackupDescription | undefined;
}
export interface DeleteGlobalSecondaryIndexAction {
  IndexName: string | undefined;
}
export interface DeleteGlobalTableWitnessGroupMemberAction {
  RegionName: string | undefined;
}
export declare const ReturnValue: {
  readonly ALL_NEW: "ALL_NEW";
  readonly ALL_OLD: "ALL_OLD";
  readonly NONE: "NONE";
  readonly UPDATED_NEW: "UPDATED_NEW";
  readonly UPDATED_OLD: "UPDATED_OLD";
};
export type ReturnValue = (typeof ReturnValue)[keyof typeof ReturnValue];
export declare class TransactionConflictException extends __BaseException {
  readonly name: "TransactionConflictException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<TransactionConflictException, __BaseException>
  );
}
export interface DeleteReplicaAction {
  RegionName: string | undefined;
}
export interface DeleteReplicationGroupMemberAction {
  RegionName: string | undefined;
}
export interface DeleteResourcePolicyInput {
  ResourceArn: string | undefined;
  ExpectedRevisionId?: string | undefined;
}
export interface DeleteResourcePolicyOutput {
  RevisionId?: string | undefined;
}
export declare class PolicyNotFoundException extends __BaseException {
  readonly name: "PolicyNotFoundException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<PolicyNotFoundException, __BaseException>
  );
}
export interface DeleteTableInput {
  TableName: string | undefined;
}
export interface DeleteTableOutput {
  TableDescription?: TableDescription | undefined;
}
export interface DescribeBackupInput {
  BackupArn: string | undefined;
}
export interface DescribeBackupOutput {
  BackupDescription?: BackupDescription | undefined;
}
export interface DescribeContinuousBackupsInput {
  TableName: string | undefined;
}
export interface DescribeContinuousBackupsOutput {
  ContinuousBackupsDescription?: ContinuousBackupsDescription | undefined;
}
export interface DescribeContributorInsightsInput {
  TableName: string | undefined;
  IndexName?: string | undefined;
}
export interface FailureException {
  ExceptionName?: string | undefined;
  ExceptionDescription?: string | undefined;
}
export interface DescribeContributorInsightsOutput {
  TableName?: string | undefined;
  IndexName?: string | undefined;
  ContributorInsightsRuleList?: string[] | undefined;
  ContributorInsightsStatus?: ContributorInsightsStatus | undefined;
  LastUpdateDateTime?: Date | undefined;
  FailureException?: FailureException | undefined;
  ContributorInsightsMode?: ContributorInsightsMode | undefined;
}
export interface DescribeEndpointsRequest {}
export interface Endpoint {
  Address: string | undefined;
  CachePeriodInMinutes: number | undefined;
}
export interface DescribeEndpointsResponse {
  Endpoints: Endpoint[] | undefined;
}
export interface DescribeExportInput {
  ExportArn: string | undefined;
}
export declare const ExportFormat: {
  readonly DYNAMODB_JSON: "DYNAMODB_JSON";
  readonly ION: "ION";
};
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];
export declare const ExportStatus: {
  readonly COMPLETED: "COMPLETED";
  readonly FAILED: "FAILED";
  readonly IN_PROGRESS: "IN_PROGRESS";
};
export type ExportStatus = (typeof ExportStatus)[keyof typeof ExportStatus];
export declare const ExportType: {
  readonly FULL_EXPORT: "FULL_EXPORT";
  readonly INCREMENTAL_EXPORT: "INCREMENTAL_EXPORT";
};
export type ExportType = (typeof ExportType)[keyof typeof ExportType];
export declare const ExportViewType: {
  readonly NEW_AND_OLD_IMAGES: "NEW_AND_OLD_IMAGES";
  readonly NEW_IMAGE: "NEW_IMAGE";
};
export type ExportViewType =
  (typeof ExportViewType)[keyof typeof ExportViewType];
export interface IncrementalExportSpecification {
  ExportFromTime?: Date | undefined;
  ExportToTime?: Date | undefined;
  ExportViewType?: ExportViewType | undefined;
}
export declare const S3SseAlgorithm: {
  readonly AES256: "AES256";
  readonly KMS: "KMS";
};
export type S3SseAlgorithm =
  (typeof S3SseAlgorithm)[keyof typeof S3SseAlgorithm];
export interface ExportDescription {
  ExportArn?: string | undefined;
  ExportStatus?: ExportStatus | undefined;
  StartTime?: Date | undefined;
  EndTime?: Date | undefined;
  ExportManifest?: string | undefined;
  TableArn?: string | undefined;
  TableId?: string | undefined;
  ExportTime?: Date | undefined;
  ClientToken?: string | undefined;
  S3Bucket?: string | undefined;
  S3BucketOwner?: string | undefined;
  S3Prefix?: string | undefined;
  S3SseAlgorithm?: S3SseAlgorithm | undefined;
  S3SseKmsKeyId?: string | undefined;
  FailureCode?: string | undefined;
  FailureMessage?: string | undefined;
  ExportFormat?: ExportFormat | undefined;
  BilledSizeBytes?: number | undefined;
  ItemCount?: number | undefined;
  ExportType?: ExportType | undefined;
  IncrementalExportSpecification?: IncrementalExportSpecification | undefined;
}
export interface DescribeExportOutput {
  ExportDescription?: ExportDescription | undefined;
}
export declare class ExportNotFoundException extends __BaseException {
  readonly name: "ExportNotFoundException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ExportNotFoundException, __BaseException>
  );
}
export interface DescribeGlobalTableInput {
  GlobalTableName: string | undefined;
}
export interface DescribeGlobalTableOutput {
  GlobalTableDescription?: GlobalTableDescription | undefined;
}
export declare class GlobalTableNotFoundException extends __BaseException {
  readonly name: "GlobalTableNotFoundException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<GlobalTableNotFoundException, __BaseException>
  );
}
export interface DescribeGlobalTableSettingsInput {
  GlobalTableName: string | undefined;
}
export interface ReplicaGlobalSecondaryIndexSettingsDescription {
  IndexName: string | undefined;
  IndexStatus?: IndexStatus | undefined;
  ProvisionedReadCapacityUnits?: number | undefined;
  ProvisionedReadCapacityAutoScalingSettings?:
    | AutoScalingSettingsDescription
    | undefined;
  ProvisionedWriteCapacityUnits?: number | undefined;
  ProvisionedWriteCapacityAutoScalingSettings?:
    | AutoScalingSettingsDescription
    | undefined;
}
export interface ReplicaSettingsDescription {
  RegionName: string | undefined;
  ReplicaStatus?: ReplicaStatus | undefined;
  ReplicaBillingModeSummary?: BillingModeSummary | undefined;
  ReplicaProvisionedReadCapacityUnits?: number | undefined;
  ReplicaProvisionedReadCapacityAutoScalingSettings?:
    | AutoScalingSettingsDescription
    | undefined;
  ReplicaProvisionedWriteCapacityUnits?: number | undefined;
  ReplicaProvisionedWriteCapacityAutoScalingSettings?:
    | AutoScalingSettingsDescription
    | undefined;
  ReplicaGlobalSecondaryIndexSettings?:
    | ReplicaGlobalSecondaryIndexSettingsDescription[]
    | undefined;
  ReplicaTableClassSummary?: TableClassSummary | undefined;
}
export interface DescribeGlobalTableSettingsOutput {
  GlobalTableName?: string | undefined;
  ReplicaSettings?: ReplicaSettingsDescription[] | undefined;
}
export interface DescribeImportInput {
  ImportArn: string | undefined;
}
export declare const ImportStatus: {
  readonly CANCELLED: "CANCELLED";
  readonly CANCELLING: "CANCELLING";
  readonly COMPLETED: "COMPLETED";
  readonly FAILED: "FAILED";
  readonly IN_PROGRESS: "IN_PROGRESS";
};
export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];
export declare const InputCompressionType: {
  readonly GZIP: "GZIP";
  readonly NONE: "NONE";
  readonly ZSTD: "ZSTD";
};
export type InputCompressionType =
  (typeof InputCompressionType)[keyof typeof InputCompressionType];
export declare const InputFormat: {
  readonly CSV: "CSV";
  readonly DYNAMODB_JSON: "DYNAMODB_JSON";
  readonly ION: "ION";
};
export type InputFormat = (typeof InputFormat)[keyof typeof InputFormat];
export interface InputFormatOptions {
  Csv?: CsvOptions | undefined;
}
export interface S3BucketSource {
  S3BucketOwner?: string | undefined;
  S3Bucket: string | undefined;
  S3KeyPrefix?: string | undefined;
}
export interface TableCreationParameters {
  TableName: string | undefined;
  AttributeDefinitions: AttributeDefinition[] | undefined;
  KeySchema: KeySchemaElement[] | undefined;
  BillingMode?: BillingMode | undefined;
  ProvisionedThroughput?: ProvisionedThroughput | undefined;
  OnDemandThroughput?: OnDemandThroughput | undefined;
  SSESpecification?: SSESpecification | undefined;
  GlobalSecondaryIndexes?: GlobalSecondaryIndex[] | undefined;
}
export interface ImportTableDescription {
  ImportArn?: string | undefined;
  ImportStatus?: ImportStatus | undefined;
  TableArn?: string | undefined;
  TableId?: string | undefined;
  ClientToken?: string | undefined;
  S3BucketSource?: S3BucketSource | undefined;
  ErrorCount?: number | undefined;
  CloudWatchLogGroupArn?: string | undefined;
  InputFormat?: InputFormat | undefined;
  InputFormatOptions?: InputFormatOptions | undefined;
  InputCompressionType?: InputCompressionType | undefined;
  TableCreationParameters?: TableCreationParameters | undefined;
  StartTime?: Date | undefined;
  EndTime?: Date | undefined;
  ProcessedSizeBytes?: number | undefined;
  ProcessedItemCount?: number | undefined;
  ImportedItemCount?: number | undefined;
  FailureCode?: string | undefined;
  FailureMessage?: string | undefined;
}
export interface DescribeImportOutput {
  ImportTableDescription: ImportTableDescription | undefined;
}
export declare class ImportNotFoundException extends __BaseException {
  readonly name: "ImportNotFoundException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ImportNotFoundException, __BaseException>
  );
}
export interface DescribeKinesisStreamingDestinationInput {
  TableName: string | undefined;
}
export declare const DestinationStatus: {
  readonly ACTIVE: "ACTIVE";
  readonly DISABLED: "DISABLED";
  readonly DISABLING: "DISABLING";
  readonly ENABLE_FAILED: "ENABLE_FAILED";
  readonly ENABLING: "ENABLING";
  readonly UPDATING: "UPDATING";
};
export type DestinationStatus =
  (typeof DestinationStatus)[keyof typeof DestinationStatus];
export interface KinesisDataStreamDestination {
  StreamArn?: string | undefined;
  DestinationStatus?: DestinationStatus | undefined;
  DestinationStatusDescription?: string | undefined;
  ApproximateCreationDateTimePrecision?:
    | ApproximateCreationDateTimePrecision
    | undefined;
}
export interface DescribeKinesisStreamingDestinationOutput {
  TableName?: string | undefined;
  KinesisDataStreamDestinations?: KinesisDataStreamDestination[] | undefined;
}
export interface DescribeLimitsInput {}
export interface DescribeLimitsOutput {
  AccountMaxReadCapacityUnits?: number | undefined;
  AccountMaxWriteCapacityUnits?: number | undefined;
  TableMaxReadCapacityUnits?: number | undefined;
  TableMaxWriteCapacityUnits?: number | undefined;
}
export interface DescribeTableInput {
  TableName: string | undefined;
}
export interface DescribeTableOutput {
  Table?: TableDescription | undefined;
}
export interface DescribeTableReplicaAutoScalingInput {
  TableName: string | undefined;
}
export interface ReplicaGlobalSecondaryIndexAutoScalingDescription {
  IndexName?: string | undefined;
  IndexStatus?: IndexStatus | undefined;
  ProvisionedReadCapacityAutoScalingSettings?:
    | AutoScalingSettingsDescription
    | undefined;
  ProvisionedWriteCapacityAutoScalingSettings?:
    | AutoScalingSettingsDescription
    | undefined;
}
export interface ReplicaAutoScalingDescription {
  RegionName?: string | undefined;
  GlobalSecondaryIndexes?:
    | ReplicaGlobalSecondaryIndexAutoScalingDescription[]
    | undefined;
  ReplicaProvisionedReadCapacityAutoScalingSettings?:
    | AutoScalingSettingsDescription
    | undefined;
  ReplicaProvisionedWriteCapacityAutoScalingSettings?:
    | AutoScalingSettingsDescription
    | undefined;
  ReplicaStatus?: ReplicaStatus | undefined;
}
export interface TableAutoScalingDescription {
  TableName?: string | undefined;
  TableStatus?: TableStatus | undefined;
  Replicas?: ReplicaAutoScalingDescription[] | undefined;
}
export interface DescribeTableReplicaAutoScalingOutput {
  TableAutoScalingDescription?: TableAutoScalingDescription | undefined;
}
export interface DescribeTimeToLiveInput {
  TableName: string | undefined;
}
export interface DescribeTimeToLiveOutput {
  TimeToLiveDescription?: TimeToLiveDescription | undefined;
}
export interface EnableKinesisStreamingConfiguration {
  ApproximateCreationDateTimePrecision?:
    | ApproximateCreationDateTimePrecision
    | undefined;
}
export interface KinesisStreamingDestinationInput {
  TableName: string | undefined;
  StreamArn: string | undefined;
  EnableKinesisStreamingConfiguration?:
    | EnableKinesisStreamingConfiguration
    | undefined;
}
export interface KinesisStreamingDestinationOutput {
  TableName?: string | undefined;
  StreamArn?: string | undefined;
  DestinationStatus?: DestinationStatus | undefined;
  EnableKinesisStreamingConfiguration?:
    | EnableKinesisStreamingConfiguration
    | undefined;
}
export declare class DuplicateItemException extends __BaseException {
  readonly name: "DuplicateItemException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<DuplicateItemException, __BaseException>
  );
}
export declare class IdempotentParameterMismatchException extends __BaseException {
  readonly name: "IdempotentParameterMismatchException";
  readonly $fault: "client";
  Message?: string | undefined;
  constructor(
    opts: __ExceptionOptionType<
      IdempotentParameterMismatchException,
      __BaseException
    >
  );
}
export declare class TransactionInProgressException extends __BaseException {
  readonly name: "TransactionInProgressException";
  readonly $fault: "client";
  Message?: string | undefined;
  constructor(
    opts: __ExceptionOptionType<TransactionInProgressException, __BaseException>
  );
}
export declare class ExportConflictException extends __BaseException {
  readonly name: "ExportConflictException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ExportConflictException, __BaseException>
  );
}
export interface ExportTableToPointInTimeInput {
  TableArn: string | undefined;
  ExportTime?: Date | undefined;
  ClientToken?: string | undefined;
  S3Bucket: string | undefined;
  S3BucketOwner?: string | undefined;
  S3Prefix?: string | undefined;
  S3SseAlgorithm?: S3SseAlgorithm | undefined;
  S3SseKmsKeyId?: string | undefined;
  ExportFormat?: ExportFormat | undefined;
  ExportType?: ExportType | undefined;
  IncrementalExportSpecification?: IncrementalExportSpecification | undefined;
}
export interface ExportTableToPointInTimeOutput {
  ExportDescription?: ExportDescription | undefined;
}
export declare class InvalidExportTimeException extends __BaseException {
  readonly name: "InvalidExportTimeException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<InvalidExportTimeException, __BaseException>
  );
}
export declare class PointInTimeRecoveryUnavailableException extends __BaseException {
  readonly name: "PointInTimeRecoveryUnavailableException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<
      PointInTimeRecoveryUnavailableException,
      __BaseException
    >
  );
}
export interface GetResourcePolicyInput {
  ResourceArn: string | undefined;
}
export interface GetResourcePolicyOutput {
  Policy?: string | undefined;
  RevisionId?: string | undefined;
}
export declare class ImportConflictException extends __BaseException {
  readonly name: "ImportConflictException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ImportConflictException, __BaseException>
  );
}
export interface ImportTableInput {
  ClientToken?: string | undefined;
  S3BucketSource: S3BucketSource | undefined;
  InputFormat: InputFormat | undefined;
  InputFormatOptions?: InputFormatOptions | undefined;
  InputCompressionType?: InputCompressionType | undefined;
  TableCreationParameters: TableCreationParameters | undefined;
}
export interface ImportTableOutput {
  ImportTableDescription: ImportTableDescription | undefined;
}
export interface ListBackupsInput {
  TableName?: string | undefined;
  Limit?: number | undefined;
  TimeRangeLowerBound?: Date | undefined;
  TimeRangeUpperBound?: Date | undefined;
  ExclusiveStartBackupArn?: string | undefined;
  BackupType?: BackupTypeFilter | undefined;
}
export interface ListBackupsOutput {
  BackupSummaries?: BackupSummary[] | undefined;
  LastEvaluatedBackupArn?: string | undefined;
}
export interface ListContributorInsightsInput {
  TableName?: string | undefined;
  NextToken?: string | undefined;
  MaxResults?: number | undefined;
}
export interface ListContributorInsightsOutput {
  ContributorInsightsSummaries?: ContributorInsightsSummary[] | undefined;
  NextToken?: string | undefined;
}
export interface ListExportsInput {
  TableArn?: string | undefined;
  MaxResults?: number | undefined;
  NextToken?: string | undefined;
}
export interface ExportSummary {
  ExportArn?: string | undefined;
  ExportStatus?: ExportStatus | undefined;
  ExportType?: ExportType | undefined;
}
export interface ListExportsOutput {
  ExportSummaries?: ExportSummary[] | undefined;
  NextToken?: string | undefined;
}
export interface ListGlobalTablesInput {
  ExclusiveStartGlobalTableName?: string | undefined;
  Limit?: number | undefined;
  RegionName?: string | undefined;
}
export interface GlobalTable {
  GlobalTableName?: string | undefined;
  ReplicationGroup?: Replica[] | undefined;
}
export interface ListGlobalTablesOutput {
  GlobalTables?: GlobalTable[] | undefined;
  LastEvaluatedGlobalTableName?: string | undefined;
}
export interface ListImportsInput {
  TableArn?: string | undefined;
  PageSize?: number | undefined;
  NextToken?: string | undefined;
}
export interface ImportSummary {
  ImportArn?: string | undefined;
  ImportStatus?: ImportStatus | undefined;
  TableArn?: string | undefined;
  S3BucketSource?: S3BucketSource | undefined;
  CloudWatchLogGroupArn?: string | undefined;
  InputFormat?: InputFormat | undefined;
  StartTime?: Date | undefined;
  EndTime?: Date | undefined;
}
export interface ListImportsOutput {
  ImportSummaryList?: ImportSummary[] | undefined;
  NextToken?: string | undefined;
}
export interface ListTablesInput {
  ExclusiveStartTableName?: string | undefined;
  Limit?: number | undefined;
}
export interface ListTablesOutput {
  TableNames?: string[] | undefined;
  LastEvaluatedTableName?: string | undefined;
}
export interface ListTagsOfResourceInput {
  ResourceArn: string | undefined;
  NextToken?: string | undefined;
}
export interface ListTagsOfResourceOutput {
  Tags?: Tag[] | undefined;
  NextToken?: string | undefined;
}
export interface PutResourcePolicyInput {
  ResourceArn: string | undefined;
  Policy: string | undefined;
  ExpectedRevisionId?: string | undefined;
  ConfirmRemoveSelfResourceAccess?: boolean | undefined;
}
export interface PutResourcePolicyOutput {
  RevisionId?: string | undefined;
}
export declare const Select: {
  readonly ALL_ATTRIBUTES: "ALL_ATTRIBUTES";
  readonly ALL_PROJECTED_ATTRIBUTES: "ALL_PROJECTED_ATTRIBUTES";
  readonly COUNT: "COUNT";
  readonly SPECIFIC_ATTRIBUTES: "SPECIFIC_ATTRIBUTES";
};
export type Select = (typeof Select)[keyof typeof Select];
export interface RestoreTableFromBackupInput {
  TargetTableName: string | undefined;
  BackupArn: string | undefined;
  BillingModeOverride?: BillingMode | undefined;
  GlobalSecondaryIndexOverride?: GlobalSecondaryIndex[] | undefined;
  LocalSecondaryIndexOverride?: LocalSecondaryIndex[] | undefined;
  ProvisionedThroughputOverride?: ProvisionedThroughput | undefined;
  OnDemandThroughputOverride?: OnDemandThroughput | undefined;
  SSESpecificationOverride?: SSESpecification | undefined;
}
export interface RestoreTableFromBackupOutput {
  TableDescription?: TableDescription | undefined;
}
export declare class TableAlreadyExistsException extends __BaseException {
  readonly name: "TableAlreadyExistsException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<TableAlreadyExistsException, __BaseException>
  );
}
export declare class InvalidRestoreTimeException extends __BaseException {
  readonly name: "InvalidRestoreTimeException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<InvalidRestoreTimeException, __BaseException>
  );
}
export interface RestoreTableToPointInTimeInput {
  SourceTableArn?: string | undefined;
  SourceTableName?: string | undefined;
  TargetTableName: string | undefined;
  UseLatestRestorableTime?: boolean | undefined;
  RestoreDateTime?: Date | undefined;
  BillingModeOverride?: BillingMode | undefined;
  GlobalSecondaryIndexOverride?: GlobalSecondaryIndex[] | undefined;
  LocalSecondaryIndexOverride?: LocalSecondaryIndex[] | undefined;
  ProvisionedThroughputOverride?: ProvisionedThroughput | undefined;
  OnDemandThroughputOverride?: OnDemandThroughput | undefined;
  SSESpecificationOverride?: SSESpecification | undefined;
}
export interface RestoreTableToPointInTimeOutput {
  TableDescription?: TableDescription | undefined;
}
export interface TagResourceInput {
  ResourceArn: string | undefined;
  Tags: Tag[] | undefined;
}
export interface UntagResourceInput {
  ResourceArn: string | undefined;
  TagKeys: string[] | undefined;
}
export interface PointInTimeRecoverySpecification {
  PointInTimeRecoveryEnabled: boolean | undefined;
  RecoveryPeriodInDays?: number | undefined;
}
export interface UpdateContinuousBackupsInput {
  TableName: string | undefined;
  PointInTimeRecoverySpecification:
    | PointInTimeRecoverySpecification
    | undefined;
}
export interface UpdateContinuousBackupsOutput {
  ContinuousBackupsDescription?: ContinuousBackupsDescription | undefined;
}
export interface UpdateContributorInsightsInput {
  TableName: string | undefined;
  IndexName?: string | undefined;
  ContributorInsightsAction: ContributorInsightsAction | undefined;
  ContributorInsightsMode?: ContributorInsightsMode | undefined;
}
export interface UpdateContributorInsightsOutput {
  TableName?: string | undefined;
  IndexName?: string | undefined;
  ContributorInsightsStatus?: ContributorInsightsStatus | undefined;
  ContributorInsightsMode?: ContributorInsightsMode | undefined;
}
export declare class ReplicaAlreadyExistsException extends __BaseException {
  readonly name: "ReplicaAlreadyExistsException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ReplicaAlreadyExistsException, __BaseException>
  );
}
export declare class ReplicaNotFoundException extends __BaseException {
  readonly name: "ReplicaNotFoundException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ReplicaNotFoundException, __BaseException>
  );
}
export interface ReplicaUpdate {
  Create?: CreateReplicaAction | undefined;
  Delete?: DeleteReplicaAction | undefined;
}
export interface UpdateGlobalTableInput {
  GlobalTableName: string | undefined;
  ReplicaUpdates: ReplicaUpdate[] | undefined;
}
export interface UpdateGlobalTableOutput {
  GlobalTableDescription?: GlobalTableDescription | undefined;
}
export declare class IndexNotFoundException extends __BaseException {
  readonly name: "IndexNotFoundException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<IndexNotFoundException, __BaseException>
  );
}
export interface GlobalTableGlobalSecondaryIndexSettingsUpdate {
  IndexName: string | undefined;
  ProvisionedWriteCapacityUnits?: number | undefined;
  ProvisionedWriteCapacityAutoScalingSettingsUpdate?:
    | AutoScalingSettingsUpdate
    | undefined;
}
export interface ReplicaGlobalSecondaryIndexSettingsUpdate {
  IndexName: string | undefined;
  ProvisionedReadCapacityUnits?: number | undefined;
  ProvisionedReadCapacityAutoScalingSettingsUpdate?:
    | AutoScalingSettingsUpdate
    | undefined;
}
export interface ReplicaSettingsUpdate {
  RegionName: string | undefined;
  ReplicaProvisionedReadCapacityUnits?: number | undefined;
  ReplicaProvisionedReadCapacityAutoScalingSettingsUpdate?:
    | AutoScalingSettingsUpdate
    | undefined;
  ReplicaGlobalSecondaryIndexSettingsUpdate?:
    | ReplicaGlobalSecondaryIndexSettingsUpdate[]
    | undefined;
  ReplicaTableClass?: TableClass | undefined;
}
export interface UpdateGlobalTableSettingsInput {
  GlobalTableName: string | undefined;
  GlobalTableBillingMode?: BillingMode | undefined;
  GlobalTableProvisionedWriteCapacityUnits?: number | undefined;
  GlobalTableProvisionedWriteCapacityAutoScalingSettingsUpdate?:
    | AutoScalingSettingsUpdate
    | undefined;
  GlobalTableGlobalSecondaryIndexSettingsUpdate?:
    | GlobalTableGlobalSecondaryIndexSettingsUpdate[]
    | undefined;
  ReplicaSettingsUpdate?: ReplicaSettingsUpdate[] | undefined;
}
export interface UpdateGlobalTableSettingsOutput {
  GlobalTableName?: string | undefined;
  ReplicaSettings?: ReplicaSettingsDescription[] | undefined;
}
export interface UpdateKinesisStreamingConfiguration {
  ApproximateCreationDateTimePrecision?:
    | ApproximateCreationDateTimePrecision
    | undefined;
}
export interface UpdateKinesisStreamingDestinationInput {
  TableName: string | undefined;
  StreamArn: string | undefined;
  UpdateKinesisStreamingConfiguration?:
    | UpdateKinesisStreamingConfiguration
    | undefined;
}
export interface UpdateKinesisStreamingDestinationOutput {
  TableName?: string | undefined;
  StreamArn?: string | undefined;
  DestinationStatus?: DestinationStatus | undefined;
  UpdateKinesisStreamingConfiguration?:
    | UpdateKinesisStreamingConfiguration
    | undefined;
}
export interface UpdateGlobalSecondaryIndexAction {
  IndexName: string | undefined;
  ProvisionedThroughput?: ProvisionedThroughput | undefined;
  OnDemandThroughput?: OnDemandThroughput | undefined;
  WarmThroughput?: WarmThroughput | undefined;
}
export interface GlobalSecondaryIndexUpdate {
  Update?: UpdateGlobalSecondaryIndexAction | undefined;
  Create?: CreateGlobalSecondaryIndexAction | undefined;
  Delete?: DeleteGlobalSecondaryIndexAction | undefined;
}
export interface GlobalTableWitnessGroupUpdate {
  Create?: CreateGlobalTableWitnessGroupMemberAction | undefined;
  Delete?: DeleteGlobalTableWitnessGroupMemberAction | undefined;
}
export interface UpdateReplicationGroupMemberAction {
  RegionName: string | undefined;
  KMSMasterKeyId?: string | undefined;
  ProvisionedThroughputOverride?: ProvisionedThroughputOverride | undefined;
  OnDemandThroughputOverride?: OnDemandThroughputOverride | undefined;
  GlobalSecondaryIndexes?: ReplicaGlobalSecondaryIndex[] | undefined;
  TableClassOverride?: TableClass | undefined;
}
export interface ReplicationGroupUpdate {
  Create?: CreateReplicationGroupMemberAction | undefined;
  Update?: UpdateReplicationGroupMemberAction | undefined;
  Delete?: DeleteReplicationGroupMemberAction | undefined;
}
export interface UpdateTableInput {
  AttributeDefinitions?: AttributeDefinition[] | undefined;
  TableName: string | undefined;
  BillingMode?: BillingMode | undefined;
  ProvisionedThroughput?: ProvisionedThroughput | undefined;
  GlobalSecondaryIndexUpdates?: GlobalSecondaryIndexUpdate[] | undefined;
  StreamSpecification?: StreamSpecification | undefined;
  SSESpecification?: SSESpecification | undefined;
  ReplicaUpdates?: ReplicationGroupUpdate[] | undefined;
  TableClass?: TableClass | undefined;
  DeletionProtectionEnabled?: boolean | undefined;
  MultiRegionConsistency?: MultiRegionConsistency | undefined;
  GlobalTableWitnessUpdates?: GlobalTableWitnessGroupUpdate[] | undefined;
  OnDemandThroughput?: OnDemandThroughput | undefined;
  WarmThroughput?: WarmThroughput | undefined;
}
export interface UpdateTableOutput {
  TableDescription?: TableDescription | undefined;
}
export interface GlobalSecondaryIndexAutoScalingUpdate {
  IndexName?: string | undefined;
  ProvisionedWriteCapacityAutoScalingUpdate?:
    | AutoScalingSettingsUpdate
    | undefined;
}
export interface ReplicaGlobalSecondaryIndexAutoScalingUpdate {
  IndexName?: string | undefined;
  ProvisionedReadCapacityAutoScalingUpdate?:
    | AutoScalingSettingsUpdate
    | undefined;
}
export interface ReplicaAutoScalingUpdate {
  RegionName: string | undefined;
  ReplicaGlobalSecondaryIndexUpdates?:
    | ReplicaGlobalSecondaryIndexAutoScalingUpdate[]
    | undefined;
  ReplicaProvisionedReadCapacityAutoScalingUpdate?:
    | AutoScalingSettingsUpdate
    | undefined;
}
export interface UpdateTableReplicaAutoScalingInput {
  GlobalSecondaryIndexUpdates?:
    | GlobalSecondaryIndexAutoScalingUpdate[]
    | undefined;
  TableName: string | undefined;
  ProvisionedWriteCapacityAutoScalingUpdate?:
    | AutoScalingSettingsUpdate
    | undefined;
  ReplicaUpdates?: ReplicaAutoScalingUpdate[] | undefined;
}
export interface UpdateTableReplicaAutoScalingOutput {
  TableAutoScalingDescription?: TableAutoScalingDescription | undefined;
}
export interface TimeToLiveSpecification {
  Enabled: boolean | undefined;
  AttributeName: string | undefined;
}
export interface UpdateTimeToLiveInput {
  TableName: string | undefined;
  TimeToLiveSpecification: TimeToLiveSpecification | undefined;
}
export interface UpdateTimeToLiveOutput {
  TimeToLiveSpecification?: TimeToLiveSpecification | undefined;
}
export type AttributeValue =
  | AttributeValue.BMember
  | AttributeValue.BOOLMember
  | AttributeValue.BSMember
  | AttributeValue.LMember
  | AttributeValue.MMember
  | AttributeValue.NMember
  | AttributeValue.NSMember
  | AttributeValue.NULLMember
  | AttributeValue.SMember
  | AttributeValue.SSMember
  | AttributeValue.$UnknownMember;
export declare namespace AttributeValue {
  interface SMember {
    S: string;
    N?: never;
    B?: never;
    SS?: never;
    NS?: never;
    BS?: never;
    M?: never;
    L?: never;
    NULL?: never;
    BOOL?: never;
    $unknown?: never;
  }
  interface NMember {
    S?: never;
    N: string;
    B?: never;
    SS?: never;
    NS?: never;
    BS?: never;
    M?: never;
    L?: never;
    NULL?: never;
    BOOL?: never;
    $unknown?: never;
  }
  interface BMember {
    S?: never;
    N?: never;
    B: Uint8Array;
    SS?: never;
    NS?: never;
    BS?: never;
    M?: never;
    L?: never;
    NULL?: never;
    BOOL?: never;
    $unknown?: never;
  }
  interface SSMember {
    S?: never;
    N?: never;
    B?: never;
    SS: string[];
    NS?: never;
    BS?: never;
    M?: never;
    L?: never;
    NULL?: never;
    BOOL?: never;
    $unknown?: never;
  }
  interface NSMember {
    S?: never;
    N?: never;
    B?: never;
    SS?: never;
    NS: string[];
    BS?: never;
    M?: never;
    L?: never;
    NULL?: never;
    BOOL?: never;
    $unknown?: never;
  }
  interface BSMember {
    S?: never;
    N?: never;
    B?: never;
    SS?: never;
    NS?: never;
    BS: Uint8Array[];
    M?: never;
    L?: never;
    NULL?: never;
    BOOL?: never;
    $unknown?: never;
  }
  interface MMember {
    S?: never;
    N?: never;
    B?: never;
    SS?: never;
    NS?: never;
    BS?: never;
    M: Record<string, AttributeValue>;
    L?: never;
    NULL?: never;
    BOOL?: never;
    $unknown?: never;
  }
  interface LMember {
    S?: never;
    N?: never;
    B?: never;
    SS?: never;
    NS?: never;
    BS?: never;
    M?: never;
    L: AttributeValue[];
    NULL?: never;
    BOOL?: never;
    $unknown?: never;
  }
  interface NULLMember {
    S?: never;
    N?: never;
    B?: never;
    SS?: never;
    NS?: never;
    BS?: never;
    M?: never;
    L?: never;
    NULL: boolean;
    BOOL?: never;
    $unknown?: never;
  }
  interface BOOLMember {
    S?: never;
    N?: never;
    B?: never;
    SS?: never;
    NS?: never;
    BS?: never;
    M?: never;
    L?: never;
    NULL?: never;
    BOOL: boolean;
    $unknown?: never;
  }
  interface $UnknownMember {
    S?: never;
    N?: never;
    B?: never;
    SS?: never;
    NS?: never;
    BS?: never;
    M?: never;
    L?: never;
    NULL?: never;
    BOOL?: never;
    $unknown: [string, any];
  }
  interface Visitor<T> {
    S: (value: string) => T;
    N: (value: string) => T;
    B: (value: Uint8Array) => T;
    SS: (value: string[]) => T;
    NS: (value: string[]) => T;
    BS: (value: Uint8Array[]) => T;
    M: (value: Record<string, AttributeValue>) => T;
    L: (value: AttributeValue[]) => T;
    NULL: (value: boolean) => T;
    BOOL: (value: boolean) => T;
    _: (name: string, value: any) => T;
  }
  const visit: <T>(value: AttributeValue, visitor: Visitor<T>) => T;
}
export interface AttributeValueUpdate {
  Value?: AttributeValue | undefined;
  Action?: AttributeAction | undefined;
}
export interface BatchStatementError {
  Code?: BatchStatementErrorCodeEnum | undefined;
  Message?: string | undefined;
  Item?: Record<string, AttributeValue> | undefined;
}
export interface BatchStatementRequest {
  Statement: string | undefined;
  Parameters?: AttributeValue[] | undefined;
  ConsistentRead?: boolean | undefined;
  ReturnValuesOnConditionCheckFailure?:
    | ReturnValuesOnConditionCheckFailure
    | undefined;
}
export interface CancellationReason {
  Item?: Record<string, AttributeValue> | undefined;
  Code?: string | undefined;
  Message?: string | undefined;
}
export interface Condition {
  AttributeValueList?: AttributeValue[] | undefined;
  ComparisonOperator: ComparisonOperator | undefined;
}
export declare class ConditionalCheckFailedException extends __BaseException {
  readonly name: "ConditionalCheckFailedException";
  readonly $fault: "client";
  Item?: Record<string, AttributeValue> | undefined;
  constructor(
    opts: __ExceptionOptionType<
      ConditionalCheckFailedException,
      __BaseException
    >
  );
}
export interface DeleteRequest {
  Key: Record<string, AttributeValue> | undefined;
}
export interface ExecuteStatementInput {
  Statement: string | undefined;
  Parameters?: AttributeValue[] | undefined;
  ConsistentRead?: boolean | undefined;
  NextToken?: string | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
  Limit?: number | undefined;
  ReturnValuesOnConditionCheckFailure?:
    | ReturnValuesOnConditionCheckFailure
    | undefined;
}
export interface Get {
  Key: Record<string, AttributeValue> | undefined;
  TableName: string | undefined;
  ProjectionExpression?: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
}
export interface GetItemInput {
  TableName: string | undefined;
  Key: Record<string, AttributeValue> | undefined;
  AttributesToGet?: string[] | undefined;
  ConsistentRead?: boolean | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
  ProjectionExpression?: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
}
export interface GetItemOutput {
  Item?: Record<string, AttributeValue> | undefined;
  ConsumedCapacity?: ConsumedCapacity | undefined;
}
export interface ItemCollectionMetrics {
  ItemCollectionKey?: Record<string, AttributeValue> | undefined;
  SizeEstimateRangeGB?: number[] | undefined;
}
export interface ItemResponse {
  Item?: Record<string, AttributeValue> | undefined;
}
export interface ParameterizedStatement {
  Statement: string | undefined;
  Parameters?: AttributeValue[] | undefined;
  ReturnValuesOnConditionCheckFailure?:
    | ReturnValuesOnConditionCheckFailure
    | undefined;
}
export interface PutRequest {
  Item: Record<string, AttributeValue> | undefined;
}
export interface KeysAndAttributes {
  Keys: Record<string, AttributeValue>[] | undefined;
  AttributesToGet?: string[] | undefined;
  ConsistentRead?: boolean | undefined;
  ProjectionExpression?: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
}
export interface TransactGetItem {
  Get: Get | undefined;
}
export interface BatchExecuteStatementInput {
  Statements: BatchStatementRequest[] | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
}
export interface ExecuteTransactionInput {
  TransactStatements: ParameterizedStatement[] | undefined;
  ClientRequestToken?: string | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
}
export interface ExecuteTransactionOutput {
  Responses?: ItemResponse[] | undefined;
  ConsumedCapacity?: ConsumedCapacity[] | undefined;
}
export interface TransactGetItemsOutput {
  ConsumedCapacity?: ConsumedCapacity[] | undefined;
  Responses?: ItemResponse[] | undefined;
}
export declare class TransactionCanceledException extends __BaseException {
  readonly name: "TransactionCanceledException";
  readonly $fault: "client";
  Message?: string | undefined;
  CancellationReasons?: CancellationReason[] | undefined;
  constructor(
    opts: __ExceptionOptionType<TransactionCanceledException, __BaseException>
  );
}
export interface BatchGetItemInput {
  RequestItems: Record<string, KeysAndAttributes> | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
}
export interface ExpectedAttributeValue {
  Value?: AttributeValue | undefined;
  Exists?: boolean | undefined;
  ComparisonOperator?: ComparisonOperator | undefined;
  AttributeValueList?: AttributeValue[] | undefined;
}
export interface TransactGetItemsInput {
  TransactItems: TransactGetItem[] | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
}
export interface TransactWriteItemsOutput {
  ConsumedCapacity?: ConsumedCapacity[] | undefined;
  ItemCollectionMetrics?: Record<string, ItemCollectionMetrics[]> | undefined;
}
export interface ConditionCheck {
  Key: Record<string, AttributeValue> | undefined;
  TableName: string | undefined;
  ConditionExpression: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
  ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
  ReturnValuesOnConditionCheckFailure?:
    | ReturnValuesOnConditionCheckFailure
    | undefined;
}
export interface Delete {
  Key: Record<string, AttributeValue> | undefined;
  TableName: string | undefined;
  ConditionExpression?: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
  ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
  ReturnValuesOnConditionCheckFailure?:
    | ReturnValuesOnConditionCheckFailure
    | undefined;
}
export interface Put {
  Item: Record<string, AttributeValue> | undefined;
  TableName: string | undefined;
  ConditionExpression?: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
  ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
  ReturnValuesOnConditionCheckFailure?:
    | ReturnValuesOnConditionCheckFailure
    | undefined;
}
export interface Update {
  Key: Record<string, AttributeValue> | undefined;
  UpdateExpression: string | undefined;
  TableName: string | undefined;
  ConditionExpression?: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
  ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
  ReturnValuesOnConditionCheckFailure?:
    | ReturnValuesOnConditionCheckFailure
    | undefined;
}
export interface BatchStatementResponse {
  Error?: BatchStatementError | undefined;
  TableName?: string | undefined;
  Item?: Record<string, AttributeValue> | undefined;
}
export interface DeleteItemOutput {
  Attributes?: Record<string, AttributeValue> | undefined;
  ConsumedCapacity?: ConsumedCapacity | undefined;
  ItemCollectionMetrics?: ItemCollectionMetrics | undefined;
}
export interface ExecuteStatementOutput {
  Items?: Record<string, AttributeValue>[] | undefined;
  NextToken?: string | undefined;
  ConsumedCapacity?: ConsumedCapacity | undefined;
  LastEvaluatedKey?: Record<string, AttributeValue> | undefined;
}
export interface PutItemOutput {
  Attributes?: Record<string, AttributeValue> | undefined;
  ConsumedCapacity?: ConsumedCapacity | undefined;
  ItemCollectionMetrics?: ItemCollectionMetrics | undefined;
}
export interface QueryOutput {
  Items?: Record<string, AttributeValue>[] | undefined;
  Count?: number | undefined;
  ScannedCount?: number | undefined;
  LastEvaluatedKey?: Record<string, AttributeValue> | undefined;
  ConsumedCapacity?: ConsumedCapacity | undefined;
}
export interface ScanOutput {
  Items?: Record<string, AttributeValue>[] | undefined;
  Count?: number | undefined;
  ScannedCount?: number | undefined;
  LastEvaluatedKey?: Record<string, AttributeValue> | undefined;
  ConsumedCapacity?: ConsumedCapacity | undefined;
}
export interface UpdateItemOutput {
  Attributes?: Record<string, AttributeValue> | undefined;
  ConsumedCapacity?: ConsumedCapacity | undefined;
  ItemCollectionMetrics?: ItemCollectionMetrics | undefined;
}
export interface WriteRequest {
  PutRequest?: PutRequest | undefined;
  DeleteRequest?: DeleteRequest | undefined;
}
export interface BatchExecuteStatementOutput {
  Responses?: BatchStatementResponse[] | undefined;
  ConsumedCapacity?: ConsumedCapacity[] | undefined;
}
export interface BatchGetItemOutput {
  Responses?: Record<string, Record<string, AttributeValue>[]> | undefined;
  UnprocessedKeys?: Record<string, KeysAndAttributes> | undefined;
  ConsumedCapacity?: ConsumedCapacity[] | undefined;
}
export interface ScanInput {
  TableName: string | undefined;
  IndexName?: string | undefined;
  AttributesToGet?: string[] | undefined;
  Limit?: number | undefined;
  Select?: Select | undefined;
  ScanFilter?: Record<string, Condition> | undefined;
  ConditionalOperator?: ConditionalOperator | undefined;
  ExclusiveStartKey?: Record<string, AttributeValue> | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
  TotalSegments?: number | undefined;
  Segment?: number | undefined;
  ProjectionExpression?: string | undefined;
  FilterExpression?: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
  ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
  ConsistentRead?: boolean | undefined;
}
export interface BatchWriteItemInput {
  RequestItems: Record<string, WriteRequest[]> | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
  ReturnItemCollectionMetrics?: ReturnItemCollectionMetrics | undefined;
}
export interface DeleteItemInput {
  TableName: string | undefined;
  Key: Record<string, AttributeValue> | undefined;
  Expected?: Record<string, ExpectedAttributeValue> | undefined;
  ConditionalOperator?: ConditionalOperator | undefined;
  ReturnValues?: ReturnValue | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
  ReturnItemCollectionMetrics?: ReturnItemCollectionMetrics | undefined;
  ConditionExpression?: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
  ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
  ReturnValuesOnConditionCheckFailure?:
    | ReturnValuesOnConditionCheckFailure
    | undefined;
}
export interface PutItemInput {
  TableName: string | undefined;
  Item: Record<string, AttributeValue> | undefined;
  Expected?: Record<string, ExpectedAttributeValue> | undefined;
  ReturnValues?: ReturnValue | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
  ReturnItemCollectionMetrics?: ReturnItemCollectionMetrics | undefined;
  ConditionalOperator?: ConditionalOperator | undefined;
  ConditionExpression?: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
  ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
  ReturnValuesOnConditionCheckFailure?:
    | ReturnValuesOnConditionCheckFailure
    | undefined;
}
export interface QueryInput {
  TableName: string | undefined;
  IndexName?: string | undefined;
  Select?: Select | undefined;
  AttributesToGet?: string[] | undefined;
  Limit?: number | undefined;
  ConsistentRead?: boolean | undefined;
  KeyConditions?: Record<string, Condition> | undefined;
  QueryFilter?: Record<string, Condition> | undefined;
  ConditionalOperator?: ConditionalOperator | undefined;
  ScanIndexForward?: boolean | undefined;
  ExclusiveStartKey?: Record<string, AttributeValue> | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
  ProjectionExpression?: string | undefined;
  FilterExpression?: string | undefined;
  KeyConditionExpression?: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
  ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
}
export interface BatchWriteItemOutput {
  UnprocessedItems?: Record<string, WriteRequest[]> | undefined;
  ItemCollectionMetrics?: Record<string, ItemCollectionMetrics[]> | undefined;
  ConsumedCapacity?: ConsumedCapacity[] | undefined;
}
export interface UpdateItemInput {
  TableName: string | undefined;
  Key: Record<string, AttributeValue> | undefined;
  AttributeUpdates?: Record<string, AttributeValueUpdate> | undefined;
  Expected?: Record<string, ExpectedAttributeValue> | undefined;
  ConditionalOperator?: ConditionalOperator | undefined;
  ReturnValues?: ReturnValue | undefined;
  ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
  ReturnItemCollectionMetrics?: ReturnItemCollectionMetrics | undefined;
  UpdateExpression?: string | undefined;
  ConditionExpression?: string | undefined;
  ExpressionAttributeNames?: Record<string, string> | undefined;
  ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
  ReturnValuesOnConditionCheckFailure?:
    | ReturnValuesOnConditionCheckFailure
    | undefined;
}
export interface TransactWriteItem {
  ConditionCheck?: ConditionCheck | undefined;
  Put?: Put | undefined;
  Delete?: Delete | undefined;
  Update?: Update | undefined;
}
