import { ExceptionOptionType as __ExceptionOptionType } from "@smithy/smithy-client";
import { DynamoDBServiceException as __BaseException } from "./DynamoDBServiceException";
/**
 * @public
 * @enum
 */
export declare const ApproximateCreationDateTimePrecision: {
    readonly MICROSECOND: "MICROSECOND";
    readonly MILLISECOND: "MILLISECOND";
};
/**
 * @public
 */
export type ApproximateCreationDateTimePrecision = (typeof ApproximateCreationDateTimePrecision)[keyof typeof ApproximateCreationDateTimePrecision];
/**
 * <p>Contains details of a table archival operation.</p>
 * @public
 */
export interface ArchivalSummary {
    /**
     * <p>The date and time when table archival was initiated by DynamoDB, in UNIX epoch time
     *             format.</p>
     * @public
     */
    ArchivalDateTime?: Date | undefined;
    /**
     * <p>The reason DynamoDB archived the table. Currently, the only possible value is:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INACCESSIBLE_ENCRYPTION_CREDENTIALS</code> - The table was archived due
     *                     to the table's KMS key being inaccessible for more than seven
     *                     days. An On-Demand backup was created at the archival time.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ArchivalReason?: string | undefined;
    /**
     * <p>The Amazon Resource Name (ARN) of the backup the table was archived to, when
     *             applicable in the archival reason. If you wish to restore this backup to the same table
     *             name, you will need to delete the original table.</p>
     * @public
     */
    ArchivalBackupArn?: string | undefined;
}
/**
 * @public
 * @enum
 */
export declare const AttributeAction: {
    readonly ADD: "ADD";
    readonly DELETE: "DELETE";
    readonly PUT: "PUT";
};
/**
 * @public
 */
export type AttributeAction = (typeof AttributeAction)[keyof typeof AttributeAction];
/**
 * @public
 * @enum
 */
export declare const ScalarAttributeType: {
    readonly B: "B";
    readonly N: "N";
    readonly S: "S";
};
/**
 * @public
 */
export type ScalarAttributeType = (typeof ScalarAttributeType)[keyof typeof ScalarAttributeType];
/**
 * <p>Represents an attribute for describing the schema for the table and indexes.</p>
 * @public
 */
export interface AttributeDefinition {
    /**
     * <p>A name for the attribute.</p>
     * @public
     */
    AttributeName: string | undefined;
    /**
     * <p>The data type for the attribute, where:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>S</code> - the attribute is of type String</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>N</code> - the attribute is of type Number</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>B</code> - the attribute is of type Binary</p>
     *             </li>
     *          </ul>
     * @public
     */
    AttributeType: ScalarAttributeType | undefined;
}
/**
 * <p>Represents the properties of a target tracking scaling policy.</p>
 * @public
 */
export interface AutoScalingTargetTrackingScalingPolicyConfigurationDescription {
    /**
     * <p>Indicates whether scale in by the target tracking policy is disabled. If the value is
     *             true, scale in is disabled and the target tracking policy won't remove capacity from the
     *             scalable resource. Otherwise, scale in is enabled and the target tracking policy can
     *             remove capacity from the scalable resource. The default value is false.</p>
     * @public
     */
    DisableScaleIn?: boolean | undefined;
    /**
     * <p>The amount of time, in seconds, after a scale in activity completes before another
     *             scale in activity can start. The cooldown period is used to block subsequent scale in
     *             requests until it has expired. You should scale in conservatively to protect your
     *             application's availability. However, if another alarm triggers a scale out policy during
     *             the cooldown period after a scale-in, application auto scaling scales out your scalable
     *             target immediately. </p>
     * @public
     */
    ScaleInCooldown?: number | undefined;
    /**
     * <p>The amount of time, in seconds, after a scale out activity completes before another
     *             scale out activity can start. While the cooldown period is in effect, the capacity that
     *             has been added by the previous scale out event that initiated the cooldown is calculated
     *             as part of the desired capacity for the next scale out. You should continuously (but not
     *             excessively) scale out.</p>
     * @public
     */
    ScaleOutCooldown?: number | undefined;
    /**
     * <p>The target value for the metric. The range is 8.515920e-109 to 1.174271e+108 (Base 10)
     *             or 2e-360 to 2e360 (Base 2).</p>
     * @public
     */
    TargetValue: number | undefined;
}
/**
 * <p>Represents the properties of the scaling policy.</p>
 * @public
 */
export interface AutoScalingPolicyDescription {
    /**
     * <p>The name of the scaling policy.</p>
     * @public
     */
    PolicyName?: string | undefined;
    /**
     * <p>Represents a target tracking scaling policy configuration.</p>
     * @public
     */
    TargetTrackingScalingPolicyConfiguration?: AutoScalingTargetTrackingScalingPolicyConfigurationDescription | undefined;
}
/**
 * <p>Represents the settings of a target tracking scaling policy that will be
 *             modified.</p>
 * @public
 */
export interface AutoScalingTargetTrackingScalingPolicyConfigurationUpdate {
    /**
     * <p>Indicates whether scale in by the target tracking policy is disabled. If the value is
     *             true, scale in is disabled and the target tracking policy won't remove capacity from the
     *             scalable resource. Otherwise, scale in is enabled and the target tracking policy can
     *             remove capacity from the scalable resource. The default value is false.</p>
     * @public
     */
    DisableScaleIn?: boolean | undefined;
    /**
     * <p>The amount of time, in seconds, after a scale in activity completes before another
     *             scale in activity can start. The cooldown period is used to block subsequent scale in
     *             requests until it has expired. You should scale in conservatively to protect your
     *             application's availability. However, if another alarm triggers a scale out policy during
     *             the cooldown period after a scale-in, application auto scaling scales out your scalable
     *             target immediately. </p>
     * @public
     */
    ScaleInCooldown?: number | undefined;
    /**
     * <p>The amount of time, in seconds, after a scale out activity completes before another
     *             scale out activity can start. While the cooldown period is in effect, the capacity that
     *             has been added by the previous scale out event that initiated the cooldown is calculated
     *             as part of the desired capacity for the next scale out. You should continuously (but not
     *             excessively) scale out.</p>
     * @public
     */
    ScaleOutCooldown?: number | undefined;
    /**
     * <p>The target value for the metric. The range is 8.515920e-109 to 1.174271e+108 (Base 10)
     *             or 2e-360 to 2e360 (Base 2).</p>
     * @public
     */
    TargetValue: number | undefined;
}
/**
 * <p>Represents the auto scaling policy to be modified.</p>
 * @public
 */
export interface AutoScalingPolicyUpdate {
    /**
     * <p>The name of the scaling policy.</p>
     * @public
     */
    PolicyName?: string | undefined;
    /**
     * <p>Represents a target tracking scaling policy configuration.</p>
     * @public
     */
    TargetTrackingScalingPolicyConfiguration: AutoScalingTargetTrackingScalingPolicyConfigurationUpdate | undefined;
}
/**
 * <p>Represents the auto scaling settings for a global table or global secondary
 *             index.</p>
 * @public
 */
export interface AutoScalingSettingsDescription {
    /**
     * <p>The minimum capacity units that a global table or global secondary index should be
     *             scaled down to.</p>
     * @public
     */
    MinimumUnits?: number | undefined;
    /**
     * <p>The maximum capacity units that a global table or global secondary index should be
     *             scaled up to.</p>
     * @public
     */
    MaximumUnits?: number | undefined;
    /**
     * <p>Disabled auto scaling for this global table or global secondary index.</p>
     * @public
     */
    AutoScalingDisabled?: boolean | undefined;
    /**
     * <p>Role ARN used for configuring the auto scaling policy.</p>
     * @public
     */
    AutoScalingRoleArn?: string | undefined;
    /**
     * <p>Information about the scaling policies.</p>
     * @public
     */
    ScalingPolicies?: AutoScalingPolicyDescription[] | undefined;
}
/**
 * <p>Represents the auto scaling settings to be modified for a global table or global
 *             secondary index.</p>
 * @public
 */
export interface AutoScalingSettingsUpdate {
    /**
     * <p>The minimum capacity units that a global table or global secondary index should be
     *             scaled down to.</p>
     * @public
     */
    MinimumUnits?: number | undefined;
    /**
     * <p>The maximum capacity units that a global table or global secondary index should be
     *             scaled up to.</p>
     * @public
     */
    MaximumUnits?: number | undefined;
    /**
     * <p>Disabled auto scaling for this global table or global secondary index.</p>
     * @public
     */
    AutoScalingDisabled?: boolean | undefined;
    /**
     * <p>Role ARN used for configuring auto scaling policy.</p>
     * @public
     */
    AutoScalingRoleArn?: string | undefined;
    /**
     * <p>The scaling policy to apply for scaling target global table or global secondary index
     *             capacity units.</p>
     * @public
     */
    ScalingPolicyUpdate?: AutoScalingPolicyUpdate | undefined;
}
/**
 * @public
 * @enum
 */
export declare const BackupStatus: {
    readonly AVAILABLE: "AVAILABLE";
    readonly CREATING: "CREATING";
    readonly DELETED: "DELETED";
};
/**
 * @public
 */
export type BackupStatus = (typeof BackupStatus)[keyof typeof BackupStatus];
/**
 * @public
 * @enum
 */
export declare const BackupType: {
    readonly AWS_BACKUP: "AWS_BACKUP";
    readonly SYSTEM: "SYSTEM";
    readonly USER: "USER";
};
/**
 * @public
 */
export type BackupType = (typeof BackupType)[keyof typeof BackupType];
/**
 * <p>Contains the details of the backup created for the table.</p>
 * @public
 */
export interface BackupDetails {
    /**
     * <p>ARN associated with the backup.</p>
     * @public
     */
    BackupArn: string | undefined;
    /**
     * <p>Name of the requested backup.</p>
     * @public
     */
    BackupName: string | undefined;
    /**
     * <p>Size of the backup in bytes. DynamoDB updates this value approximately every six
     *             hours. Recent changes might not be reflected in this value.</p>
     * @public
     */
    BackupSizeBytes?: number | undefined;
    /**
     * <p>Backup can be in one of the following states: CREATING, ACTIVE, DELETED. </p>
     * @public
     */
    BackupStatus: BackupStatus | undefined;
    /**
     * <p>BackupType:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>USER</code> - You create and manage these using the on-demand backup
     *                     feature.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>SYSTEM</code> - If you delete a table with point-in-time recovery enabled,
     *                     a <code>SYSTEM</code> backup is automatically created and is retained for 35
     *                     days (at no additional cost). System backups allow you to restore the deleted
     *                     table to the state it was in just before the point of deletion. </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>AWS_BACKUP</code> - On-demand backup created by you from Backup service.</p>
     *             </li>
     *          </ul>
     * @public
     */
    BackupType: BackupType | undefined;
    /**
     * <p>Time at which the backup was created. This is the request time of the backup. </p>
     * @public
     */
    BackupCreationDateTime: Date | undefined;
    /**
     * <p>Time at which the automatic on-demand backup created by DynamoDB will
     *             expire. This <code>SYSTEM</code> on-demand backup expires automatically 35 days after
     *             its creation.</p>
     * @public
     */
    BackupExpiryDateTime?: Date | undefined;
}
/**
 * @public
 * @enum
 */
export declare const BillingMode: {
    readonly PAY_PER_REQUEST: "PAY_PER_REQUEST";
    readonly PROVISIONED: "PROVISIONED";
};
/**
 * @public
 */
export type BillingMode = (typeof BillingMode)[keyof typeof BillingMode];
/**
 * @public
 * @enum
 */
export declare const KeyType: {
    readonly HASH: "HASH";
    readonly RANGE: "RANGE";
};
/**
 * @public
 */
export type KeyType = (typeof KeyType)[keyof typeof KeyType];
/**
 * <p>Represents <i>a single element</i> of a key schema. A key schema
 *             specifies the attributes that make up the primary key of a table, or the key attributes
 *             of an index.</p>
 *          <p>A <code>KeySchemaElement</code> represents exactly one attribute of the primary key.
 *             For example, a simple primary key would be represented by one
 *                 <code>KeySchemaElement</code> (for the partition key). A composite primary key would
 *             require one <code>KeySchemaElement</code> for the partition key, and another
 *                 <code>KeySchemaElement</code> for the sort key.</p>
 *          <p>A <code>KeySchemaElement</code> must be a scalar, top-level attribute (not a nested
 *             attribute). The data type must be one of String, Number, or Binary. The attribute cannot
 *             be nested within a List or a Map.</p>
 * @public
 */
export interface KeySchemaElement {
    /**
     * <p>The name of a key attribute.</p>
     * @public
     */
    AttributeName: string | undefined;
    /**
     * <p>The role that this key attribute will assume:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>HASH</code> - partition key</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>RANGE</code> - sort key</p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>The partition key of an item is also known as its <i>hash
     *                     attribute</i>. The term "hash attribute" derives from DynamoDB's usage of an internal hash function to evenly distribute data items across
     *                 partitions, based on their partition key values.</p>
     *             <p>The sort key of an item is also known as its <i>range attribute</i>.
     *                 The term "range attribute" derives from the way DynamoDB stores items with
     *                 the same partition key physically close together, in sorted order by the sort key
     *                 value.</p>
     *          </note>
     * @public
     */
    KeyType: KeyType | undefined;
}
/**
 * <p>Sets the maximum number of read and write units for the specified on-demand table. If
 *             you use this parameter, you must specify <code>MaxReadRequestUnits</code>,
 *                 <code>MaxWriteRequestUnits</code>, or both.</p>
 * @public
 */
export interface OnDemandThroughput {
    /**
     * <p>Maximum number of read request units for the specified table.</p>
     *          <p>To specify a maximum <code>OnDemandThroughput</code> on your table, set the value of
     *                 <code>MaxReadRequestUnits</code> as greater than or equal to 1. To remove the
     *             maximum <code>OnDemandThroughput</code> that is currently set on your table, set the
     *             value of <code>MaxReadRequestUnits</code> to -1.</p>
     * @public
     */
    MaxReadRequestUnits?: number | undefined;
    /**
     * <p>Maximum number of write request units for the specified table.</p>
     *          <p>To specify a maximum <code>OnDemandThroughput</code> on your table, set the value of
     *                 <code>MaxWriteRequestUnits</code> as greater than or equal to 1. To remove the
     *             maximum <code>OnDemandThroughput</code> that is currently set on your table, set the
     *             value of <code>MaxWriteRequestUnits</code> to -1.</p>
     * @public
     */
    MaxWriteRequestUnits?: number | undefined;
}
/**
 * <p>Represents the provisioned throughput settings for the specified global secondary
 *             index. You must use <code>ProvisionedThroughput</code> or
 *                 <code>OnDemandThroughput</code> based on your table’s capacity mode.</p>
 *          <p>For current minimum and maximum provisioned throughput values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html">Service,
 *                 Account, and Table Quotas</a> in the <i>Amazon DynamoDB Developer
 *                 Guide</i>.</p>
 * @public
 */
export interface ProvisionedThroughput {
    /**
     * <p>The maximum number of strongly consistent reads consumed per second before DynamoDB
     *             returns a <code>ThrottlingException</code>. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ProvisionedThroughput.html">Specifying
     *                 Read and Write Requirements</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     *          <p>If read/write capacity mode is <code>PAY_PER_REQUEST</code> the value is set to
     *             0.</p>
     * @public
     */
    ReadCapacityUnits: number | undefined;
    /**
     * <p>The maximum number of writes consumed per second before DynamoDB returns a
     *                 <code>ThrottlingException</code>. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ProvisionedThroughput.html">Specifying
     *                 Read and Write Requirements</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     *          <p>If read/write capacity mode is <code>PAY_PER_REQUEST</code> the value is set to
     *             0.</p>
     * @public
     */
    WriteCapacityUnits: number | undefined;
}
/**
 * <p>Contains the details of the table when the backup was created. </p>
 * @public
 */
export interface SourceTableDetails {
    /**
     * <p>The name of the table for which the backup was created. </p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>Unique identifier for the table for which the backup was created. </p>
     * @public
     */
    TableId: string | undefined;
    /**
     * <p>ARN of the table for which backup was created. </p>
     * @public
     */
    TableArn?: string | undefined;
    /**
     * <p>Size of the table in bytes. Note that this is an approximate value.</p>
     * @public
     */
    TableSizeBytes?: number | undefined;
    /**
     * <p>Schema of the table. </p>
     * @public
     */
    KeySchema: KeySchemaElement[] | undefined;
    /**
     * <p>Time when the source table was created. </p>
     * @public
     */
    TableCreationDateTime: Date | undefined;
    /**
     * <p>Read IOPs and Write IOPS on the table when the backup was created.</p>
     * @public
     */
    ProvisionedThroughput: ProvisionedThroughput | undefined;
    /**
     * <p>Sets the maximum number of read and write units for the specified on-demand table. If
     *             you use this parameter, you must specify <code>MaxReadRequestUnits</code>,
     *                 <code>MaxWriteRequestUnits</code>, or both.</p>
     * @public
     */
    OnDemandThroughput?: OnDemandThroughput | undefined;
    /**
     * <p>Number of items in the table. Note that this is an approximate value. </p>
     * @public
     */
    ItemCount?: number | undefined;
    /**
     * <p>Controls how you are charged for read and write throughput and how you manage
     *             capacity. This setting can be changed later.</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>PROVISIONED</code> - Sets the read/write capacity mode to
     *                         <code>PROVISIONED</code>. We recommend using <code>PROVISIONED</code> for
     *                     predictable workloads.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>PAY_PER_REQUEST</code> - Sets the read/write capacity mode to
     *                         <code>PAY_PER_REQUEST</code>. We recommend using
     *                         <code>PAY_PER_REQUEST</code> for unpredictable workloads. </p>
     *             </li>
     *          </ul>
     * @public
     */
    BillingMode?: BillingMode | undefined;
}
/**
 * @public
 * @enum
 */
export declare const ProjectionType: {
    readonly ALL: "ALL";
    readonly INCLUDE: "INCLUDE";
    readonly KEYS_ONLY: "KEYS_ONLY";
};
/**
 * @public
 */
export type ProjectionType = (typeof ProjectionType)[keyof typeof ProjectionType];
/**
 * <p>Represents attributes that are copied (projected) from the table into an index. These
 *             are in addition to the primary key attributes and index key attributes, which are
 *             automatically projected.</p>
 * @public
 */
export interface Projection {
    /**
     * <p>The set of attributes that are projected into the index:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>KEYS_ONLY</code> - Only the index and primary keys are projected into the
     *                     index.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>INCLUDE</code> - In addition to the attributes described in
     *                         <code>KEYS_ONLY</code>, the secondary index will include other non-key
     *                     attributes that you specify.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ALL</code> - All of the table attributes are projected into the
     *                     index.</p>
     *             </li>
     *          </ul>
     *          <p>When using the DynamoDB console, <code>ALL</code> is selected by default.</p>
     * @public
     */
    ProjectionType?: ProjectionType | undefined;
    /**
     * <p>Represents the non-key attribute names which will be projected into the index.</p>
     *          <p>For global and local secondary indexes, the total count of
     *                 <code>NonKeyAttributes</code> summed across all of the secondary indexes, must not
     *             exceed 100. If you project the same attribute into two different indexes, this counts as
     *             two distinct attributes when determining the total. This limit only applies when you
     *             specify the ProjectionType of <code>INCLUDE</code>. You still can specify the
     *             ProjectionType of <code>ALL</code> to project all attributes from the source table, even
     *             if the table has more than 100 attributes.</p>
     * @public
     */
    NonKeyAttributes?: string[] | undefined;
}
/**
 * <p>Represents the properties of a global secondary index for the table when the backup
 *             was created.</p>
 * @public
 */
export interface GlobalSecondaryIndexInfo {
    /**
     * <p>The name of the global secondary index.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>The complete key schema for a global secondary index, which consists of one or more
     *             pairs of attribute names and key types:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>HASH</code> - partition key</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>RANGE</code> - sort key</p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>The partition key of an item is also known as its <i>hash
     *                     attribute</i>. The term "hash attribute" derives from DynamoDB's usage of an internal hash function to evenly distribute data items across
     *                 partitions, based on their partition key values.</p>
     *             <p>The sort key of an item is also known as its <i>range attribute</i>.
     *                 The term "range attribute" derives from the way DynamoDB stores items with
     *                 the same partition key physically close together, in sorted order by the sort key
     *                 value.</p>
     *          </note>
     * @public
     */
    KeySchema?: KeySchemaElement[] | undefined;
    /**
     * <p>Represents attributes that are copied (projected) from the table into the global
     *             secondary index. These are in addition to the primary key attributes and index key
     *             attributes, which are automatically projected. </p>
     * @public
     */
    Projection?: Projection | undefined;
    /**
     * <p>Represents the provisioned throughput settings for the specified global secondary
     *             index. </p>
     * @public
     */
    ProvisionedThroughput?: ProvisionedThroughput | undefined;
    /**
     * <p>Sets the maximum number of read and write units for the specified on-demand table. If
     *             you use this parameter, you must specify <code>MaxReadRequestUnits</code>,
     *                 <code>MaxWriteRequestUnits</code>, or both.</p>
     * @public
     */
    OnDemandThroughput?: OnDemandThroughput | undefined;
}
/**
 * <p>Represents the properties of a local secondary index for the table when the backup was
 *             created.</p>
 * @public
 */
export interface LocalSecondaryIndexInfo {
    /**
     * <p>Represents the name of the local secondary index.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>The complete key schema for a local secondary index, which consists of one or more
     *             pairs of attribute names and key types:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>HASH</code> - partition key</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>RANGE</code> - sort key</p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>The partition key of an item is also known as its <i>hash
     *                     attribute</i>. The term "hash attribute" derives from DynamoDB's usage of
     *                 an internal hash function to evenly distribute data items across partitions, based
     *                 on their partition key values.</p>
     *             <p>The sort key of an item is also known as its <i>range attribute</i>.
     *                 The term "range attribute" derives from the way DynamoDB stores items with the same
     *                 partition key physically close together, in sorted order by the sort key
     *                 value.</p>
     *          </note>
     * @public
     */
    KeySchema?: KeySchemaElement[] | undefined;
    /**
     * <p>Represents attributes that are copied (projected) from the table into the global
     *             secondary index. These are in addition to the primary key attributes and index key
     *             attributes, which are automatically projected. </p>
     * @public
     */
    Projection?: Projection | undefined;
}
/**
 * @public
 * @enum
 */
export declare const SSEType: {
    readonly AES256: "AES256";
    readonly KMS: "KMS";
};
/**
 * @public
 */
export type SSEType = (typeof SSEType)[keyof typeof SSEType];
/**
 * @public
 * @enum
 */
export declare const SSEStatus: {
    readonly DISABLED: "DISABLED";
    readonly DISABLING: "DISABLING";
    readonly ENABLED: "ENABLED";
    readonly ENABLING: "ENABLING";
    readonly UPDATING: "UPDATING";
};
/**
 * @public
 */
export type SSEStatus = (typeof SSEStatus)[keyof typeof SSEStatus];
/**
 * <p>The description of the server-side encryption status on the specified table.</p>
 * @public
 */
export interface SSEDescription {
    /**
     * <p>Represents the current state of server-side encryption. The only supported values
     *             are:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>ENABLED</code> - Server-side encryption is enabled.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATING</code> - Server-side encryption is being updated.</p>
     *             </li>
     *          </ul>
     * @public
     */
    Status?: SSEStatus | undefined;
    /**
     * <p>Server-side encryption type. The only supported value is:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>KMS</code> - Server-side encryption that uses Key Management Service. The
     *                     key is stored in your account and is managed by KMS (KMS charges apply).</p>
     *             </li>
     *          </ul>
     * @public
     */
    SSEType?: SSEType | undefined;
    /**
     * <p>The KMS key ARN used for the KMS encryption.</p>
     * @public
     */
    KMSMasterKeyArn?: string | undefined;
    /**
     * <p>Indicates the time, in UNIX epoch date format, when DynamoDB detected that
     *             the table's KMS key was inaccessible. This attribute will automatically
     *             be cleared when DynamoDB detects that the table's KMS key is accessible
     *             again. DynamoDB will initiate the table archival process when table's KMS key remains inaccessible for more than seven days from this date.</p>
     * @public
     */
    InaccessibleEncryptionDateTime?: Date | undefined;
}
/**
 * @public
 * @enum
 */
export declare const StreamViewType: {
    readonly KEYS_ONLY: "KEYS_ONLY";
    readonly NEW_AND_OLD_IMAGES: "NEW_AND_OLD_IMAGES";
    readonly NEW_IMAGE: "NEW_IMAGE";
    readonly OLD_IMAGE: "OLD_IMAGE";
};
/**
 * @public
 */
export type StreamViewType = (typeof StreamViewType)[keyof typeof StreamViewType];
/**
 * <p>Represents the DynamoDB Streams configuration for a table in DynamoDB.</p>
 * @public
 */
export interface StreamSpecification {
    /**
     * <p>Indicates whether DynamoDB Streams is enabled (true) or disabled (false) on the
     *             table.</p>
     * @public
     */
    StreamEnabled: boolean | undefined;
    /**
     * <p> When an item in the table is modified, <code>StreamViewType</code> determines what
     *             information is written to the stream for this table. Valid values for
     *                 <code>StreamViewType</code> are:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>KEYS_ONLY</code> - Only the key attributes of the modified item are
     *                     written to the stream.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NEW_IMAGE</code> - The entire item, as it appears after it was modified,
     *                     is written to the stream.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>OLD_IMAGE</code> - The entire item, as it appeared before it was modified,
     *                     is written to the stream.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NEW_AND_OLD_IMAGES</code> - Both the new and the old item images of the
     *                     item are written to the stream.</p>
     *             </li>
     *          </ul>
     * @public
     */
    StreamViewType?: StreamViewType | undefined;
}
/**
 * @public
 * @enum
 */
export declare const TimeToLiveStatus: {
    readonly DISABLED: "DISABLED";
    readonly DISABLING: "DISABLING";
    readonly ENABLED: "ENABLED";
    readonly ENABLING: "ENABLING";
};
/**
 * @public
 */
export type TimeToLiveStatus = (typeof TimeToLiveStatus)[keyof typeof TimeToLiveStatus];
/**
 * <p>The description of the Time to Live (TTL) status on the specified table. </p>
 * @public
 */
export interface TimeToLiveDescription {
    /**
     * <p> The TTL status for the table.</p>
     * @public
     */
    TimeToLiveStatus?: TimeToLiveStatus | undefined;
    /**
     * <p> The name of the TTL attribute for items in the table.</p>
     * @public
     */
    AttributeName?: string | undefined;
}
/**
 * <p>Contains the details of the features enabled on the table when the backup was created.
 *             For example, LSIs, GSIs, streams, TTL. </p>
 * @public
 */
export interface SourceTableFeatureDetails {
    /**
     * <p>Represents the LSI properties for the table when the backup was created. It includes
     *             the IndexName, KeySchema and Projection for the LSIs on the table at the time of backup.
     *         </p>
     * @public
     */
    LocalSecondaryIndexes?: LocalSecondaryIndexInfo[] | undefined;
    /**
     * <p>Represents the GSI properties for the table when the backup was created. It includes
     *             the IndexName, KeySchema, Projection, and ProvisionedThroughput for the GSIs on the
     *             table at the time of backup. </p>
     * @public
     */
    GlobalSecondaryIndexes?: GlobalSecondaryIndexInfo[] | undefined;
    /**
     * <p>Stream settings on the table when the backup was created.</p>
     * @public
     */
    StreamDescription?: StreamSpecification | undefined;
    /**
     * <p>Time to Live settings on the table when the backup was created.</p>
     * @public
     */
    TimeToLiveDescription?: TimeToLiveDescription | undefined;
    /**
     * <p>The description of the server-side encryption status on the table when the backup was
     *             created.</p>
     * @public
     */
    SSEDescription?: SSEDescription | undefined;
}
/**
 * <p>Contains the description of the backup created for the table.</p>
 * @public
 */
export interface BackupDescription {
    /**
     * <p>Contains the details of the backup created for the table. </p>
     * @public
     */
    BackupDetails?: BackupDetails | undefined;
    /**
     * <p>Contains the details of the table when the backup was created. </p>
     * @public
     */
    SourceTableDetails?: SourceTableDetails | undefined;
    /**
     * <p>Contains the details of the features enabled on the table when the backup was created.
     *             For example, LSIs, GSIs, streams, TTL.</p>
     * @public
     */
    SourceTableFeatureDetails?: SourceTableFeatureDetails | undefined;
}
/**
 * <p>There is another ongoing conflicting backup control plane operation on the table.
 *             The backup is either being created, deleted or restored to a table.</p>
 * @public
 */
export declare class BackupInUseException extends __BaseException {
    readonly name: "BackupInUseException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<BackupInUseException, __BaseException>);
}
/**
 * <p>Backup not found for the given BackupARN. </p>
 * @public
 */
export declare class BackupNotFoundException extends __BaseException {
    readonly name: "BackupNotFoundException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<BackupNotFoundException, __BaseException>);
}
/**
 * <p>Contains details for the backup.</p>
 * @public
 */
export interface BackupSummary {
    /**
     * <p>Name of the table.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>Unique identifier for the table.</p>
     * @public
     */
    TableId?: string | undefined;
    /**
     * <p>ARN associated with the table.</p>
     * @public
     */
    TableArn?: string | undefined;
    /**
     * <p>ARN associated with the backup.</p>
     * @public
     */
    BackupArn?: string | undefined;
    /**
     * <p>Name of the specified backup.</p>
     * @public
     */
    BackupName?: string | undefined;
    /**
     * <p>Time at which the backup was created.</p>
     * @public
     */
    BackupCreationDateTime?: Date | undefined;
    /**
     * <p>Time at which the automatic on-demand backup created by DynamoDB will
     *             expire. This <code>SYSTEM</code> on-demand backup expires automatically 35 days after
     *             its creation.</p>
     * @public
     */
    BackupExpiryDateTime?: Date | undefined;
    /**
     * <p>Backup can be in one of the following states: CREATING, ACTIVE, DELETED.</p>
     * @public
     */
    BackupStatus?: BackupStatus | undefined;
    /**
     * <p>BackupType:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>USER</code> - You create and manage these using the on-demand backup
     *                     feature.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>SYSTEM</code> - If you delete a table with point-in-time recovery enabled,
     *                     a <code>SYSTEM</code> backup is automatically created and is retained for 35
     *                     days (at no additional cost). System backups allow you to restore the deleted
     *                     table to the state it was in just before the point of deletion. </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>AWS_BACKUP</code> - On-demand backup created by you from Backup service.</p>
     *             </li>
     *          </ul>
     * @public
     */
    BackupType?: BackupType | undefined;
    /**
     * <p>Size of the backup in bytes.</p>
     * @public
     */
    BackupSizeBytes?: number | undefined;
}
/**
 * @public
 * @enum
 */
export declare const BackupTypeFilter: {
    readonly ALL: "ALL";
    readonly AWS_BACKUP: "AWS_BACKUP";
    readonly SYSTEM: "SYSTEM";
    readonly USER: "USER";
};
/**
 * @public
 */
export type BackupTypeFilter = (typeof BackupTypeFilter)[keyof typeof BackupTypeFilter];
/**
 * @public
 * @enum
 */
export declare const ReturnConsumedCapacity: {
    readonly INDEXES: "INDEXES";
    readonly NONE: "NONE";
    readonly TOTAL: "TOTAL";
};
/**
 * @public
 */
export type ReturnConsumedCapacity = (typeof ReturnConsumedCapacity)[keyof typeof ReturnConsumedCapacity];
/**
 * @public
 * @enum
 */
export declare const ReturnValuesOnConditionCheckFailure: {
    readonly ALL_OLD: "ALL_OLD";
    readonly NONE: "NONE";
};
/**
 * @public
 */
export type ReturnValuesOnConditionCheckFailure = (typeof ReturnValuesOnConditionCheckFailure)[keyof typeof ReturnValuesOnConditionCheckFailure];
/**
 * <p>Represents the amount of provisioned throughput capacity consumed on a table or an
 *             index.</p>
 * @public
 */
export interface Capacity {
    /**
     * <p>The total number of read capacity units consumed on a table or an index.</p>
     * @public
     */
    ReadCapacityUnits?: number | undefined;
    /**
     * <p>The total number of write capacity units consumed on a table or an index.</p>
     * @public
     */
    WriteCapacityUnits?: number | undefined;
    /**
     * <p>The total number of capacity units consumed on a table or an index.</p>
     * @public
     */
    CapacityUnits?: number | undefined;
}
/**
 * <p>The capacity units consumed by an operation. The data returned includes the total
 *             provisioned throughput consumed, along with statistics for the table and any indexes
 *             involved in the operation. <code>ConsumedCapacity</code> is only returned if the request
 *             asked for it. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/provisioned-capacity-mode.html">Provisioned capacity mode</a> in the <i>Amazon DynamoDB Developer
 *                 Guide</i>.</p>
 * @public
 */
export interface ConsumedCapacity {
    /**
     * <p>The name of the table that was affected by the operation. If you had specified the
     *             Amazon Resource Name (ARN) of a table in the input, you'll see the table ARN in the response.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>The total number of capacity units consumed by the operation.</p>
     * @public
     */
    CapacityUnits?: number | undefined;
    /**
     * <p>The total number of read capacity units consumed by the operation.</p>
     * @public
     */
    ReadCapacityUnits?: number | undefined;
    /**
     * <p>The total number of write capacity units consumed by the operation.</p>
     * @public
     */
    WriteCapacityUnits?: number | undefined;
    /**
     * <p>The amount of throughput consumed on the table affected by the operation.</p>
     * @public
     */
    Table?: Capacity | undefined;
    /**
     * <p>The amount of throughput consumed on each local index affected by the
     *             operation.</p>
     * @public
     */
    LocalSecondaryIndexes?: Record<string, Capacity> | undefined;
    /**
     * <p>The amount of throughput consumed on each global index affected by the
     *             operation.</p>
     * @public
     */
    GlobalSecondaryIndexes?: Record<string, Capacity> | undefined;
}
/**
 * @public
 * @enum
 */
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
/**
 * @public
 */
export type BatchStatementErrorCodeEnum = (typeof BatchStatementErrorCodeEnum)[keyof typeof BatchStatementErrorCodeEnum];
/**
 * <p>An error occurred on the server side.</p>
 * @public
 */
export declare class InternalServerError extends __BaseException {
    readonly name: "InternalServerError";
    readonly $fault: "server";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<InternalServerError, __BaseException>);
}
/**
 * <p>Represents the specific reason why a DynamoDB request was throttled and the
 *             ARN of the impacted resource. This helps identify exactly what resource is being throttled,
 *             what type of operation caused it, and why the throttling occurred.</p>
 * @public
 */
export interface ThrottlingReason {
    /**
     * <p>The reason for throttling. The throttling reason follows a specific format:
     *                 <code>ResourceType+OperationType+LimitType</code>:</p>
     *          <ul>
     *             <li>
     *                <p>Resource Type (What is being throttled): Table or Index</p>
     *             </li>
     *             <li>
     *                <p>Operation Type (What kind of operation): Read or Write</p>
     *             </li>
     *             <li>
     *                <p>Limit Type (Why the throttling occurred):</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>ProvisionedThroughputExceeded</code>: The request rate is
     *                             exceeding the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/provisioned-capacity-mode.html">provisioned throughput capacity</a> (read or write capacity
     *                             units) configured for a table or a global secondary index (GSI) in
     *                             provisioned capacity mode.</p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>AccountLimitExceeded</code>: The request rate has caused a table
     *                             or global secondary index (GSI) in on-demand mode to exceed the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ServiceQuotas.html#default-limits-throughput">per-table account-level service quotas</a> for read/write
     *                             throughput in the current Amazon Web Services Region. </p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>KeyRangeThroughputExceeded</code>: The request rate directed at
     *                             a specific partition key value has exceeded the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html">internal partition-level throughput limits</a>, indicating
     *                             uneven access patterns across the table's or GSI's key space.</p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>MaxOnDemandThroughputExceeded</code>: The request rate has
     *                             exceeded the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode-max-throughput.html">configured maximum throughput limits</a> set for a table or
     *                             index in on-demand capacity mode.</p>
     *                   </li>
     *                </ul>
     *             </li>
     *          </ul>
     *          <p>Examples of complete throttling reasons:</p>
     *          <ul>
     *             <li>
     *                <p>TableReadProvisionedThroughputExceeded</p>
     *             </li>
     *             <li>
     *                <p>IndexWriteAccountLimitExceeded</p>
     *             </li>
     *          </ul>
     *          <p>This helps identify exactly what resource is being throttled, what type of operation
     *             caused it, and why the throttling occurred.</p>
     * @public
     */
    reason?: string | undefined;
    /**
     * <p>The Amazon Resource Name (ARN) of the DynamoDB table or index that experienced the
     *             throttling event.</p>
     * @public
     */
    resource?: string | undefined;
}
/**
 * <p>Throughput exceeds the current throughput quota for your account. For detailed
 *             information about why the request was throttled and the ARN of the impacted resource,
 *             find the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ThrottlingReason.html">ThrottlingReason</a> field in the returned exception. Contact <a href="https://aws.amazon.com/support">Amazon Web Services Support</a> to request a quota
 *             increase.</p>
 * @public
 */
export declare class RequestLimitExceeded extends __BaseException {
    readonly name: "RequestLimitExceeded";
    readonly $fault: "client";
    /**
     * <p>A list of <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ThrottlingReason.html">ThrottlingReason</a> that
     *      provide detailed diagnostic information about why the request was throttled.
     *     </p>
     * @public
     */
    ThrottlingReasons?: ThrottlingReason[] | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<RequestLimitExceeded, __BaseException>);
}
/**
 * <p>The request was denied due to request throttling. For detailed information about why
 *             the request was throttled and the ARN of the impacted resource, find the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ThrottlingReason.html">ThrottlingReason</a> field in the returned exception.</p>
 * @public
 */
export declare class ThrottlingException extends __BaseException {
    readonly name: "ThrottlingException";
    readonly $fault: "client";
    /**
     * <p>A list of <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ThrottlingReason.html">ThrottlingReason</a> that
     *      provide detailed diagnostic information about why the request was throttled.
     *     </p>
     * @public
     */
    throttlingReasons?: ThrottlingReason[] | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ThrottlingException, __BaseException>);
}
/**
 * @public
 */
export declare class InvalidEndpointException extends __BaseException {
    readonly name: "InvalidEndpointException";
    readonly $fault: "client";
    Message?: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<InvalidEndpointException, __BaseException>);
}
/**
 * <p>The request was denied due to request throttling. For detailed information about
 *             why the request was throttled and the ARN of the impacted resource, find the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ThrottlingReason.html">ThrottlingReason</a> field in the returned exception. The Amazon Web Services
 *             SDKs for DynamoDB automatically retry requests that receive this exception.
 *             Your request is eventually successful, unless your retry queue is too large to finish.
 *             Reduce the frequency of requests and use exponential backoff. For more information, go
 *             to <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.Errors.html#Programming.Errors.RetryAndBackoff">Error Retries and Exponential Backoff</a> in the <i>Amazon DynamoDB Developer Guide</i>.</p>
 * @public
 */
export declare class ProvisionedThroughputExceededException extends __BaseException {
    readonly name: "ProvisionedThroughputExceededException";
    readonly $fault: "client";
    /**
     * <p>A list of <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ThrottlingReason.html">ThrottlingReason</a> that
     *      provide detailed diagnostic information about why the request was throttled.
     *     </p>
     * @public
     */
    ThrottlingReasons?: ThrottlingReason[] | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ProvisionedThroughputExceededException, __BaseException>);
}
/**
 * <p>The operation tried to access a nonexistent table or index. The resource might not
 *             be specified correctly, or its status might not be <code>ACTIVE</code>.</p>
 * @public
 */
export declare class ResourceNotFoundException extends __BaseException {
    readonly name: "ResourceNotFoundException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ResourceNotFoundException, __BaseException>);
}
/**
 * @public
 * @enum
 */
export declare const ReturnItemCollectionMetrics: {
    readonly NONE: "NONE";
    readonly SIZE: "SIZE";
};
/**
 * @public
 */
export type ReturnItemCollectionMetrics = (typeof ReturnItemCollectionMetrics)[keyof typeof ReturnItemCollectionMetrics];
/**
 * <p>An item collection is too large. This exception is only returned for tables that
 *             have one or more local secondary indexes.</p>
 * @public
 */
export declare class ItemCollectionSizeLimitExceededException extends __BaseException {
    readonly name: "ItemCollectionSizeLimitExceededException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ItemCollectionSizeLimitExceededException, __BaseException>);
}
/**
 * <p>The request was rejected because one or more items in the request are being modified
 *             by a request in another Region. </p>
 * @public
 */
export declare class ReplicatedWriteConflictException extends __BaseException {
    readonly name: "ReplicatedWriteConflictException";
    readonly $fault: "client";
    $retryable: {};
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ReplicatedWriteConflictException, __BaseException>);
}
/**
 * <p>Contains the details for the read/write capacity mode. This page talks about
 *                 <code>PROVISIONED</code> and <code>PAY_PER_REQUEST</code> billing modes. For more
 *             information about these modes, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadWriteCapacityMode.html">Read/write capacity mode</a>.</p>
 *          <note>
 *             <p>You may need to switch to on-demand mode at least once in order to return a
 *                     <code>BillingModeSummary</code> response.</p>
 *          </note>
 * @public
 */
export interface BillingModeSummary {
    /**
     * <p>Controls how you are charged for read and write throughput and how you manage
     *             capacity. This setting can be changed later.</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>PROVISIONED</code> - Sets the read/write capacity mode to
     *                         <code>PROVISIONED</code>. We recommend using <code>PROVISIONED</code> for
     *                     predictable workloads.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>PAY_PER_REQUEST</code> - Sets the read/write capacity mode to
     *                         <code>PAY_PER_REQUEST</code>. We recommend using
     *                         <code>PAY_PER_REQUEST</code> for unpredictable workloads. </p>
     *             </li>
     *          </ul>
     * @public
     */
    BillingMode?: BillingMode | undefined;
    /**
     * <p>Represents the time when <code>PAY_PER_REQUEST</code> was last set as the read/write
     *             capacity mode.</p>
     * @public
     */
    LastUpdateToPayPerRequestDateTime?: Date | undefined;
}
/**
 * @public
 * @enum
 */
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
/**
 * @public
 */
export type ComparisonOperator = (typeof ComparisonOperator)[keyof typeof ComparisonOperator];
/**
 * @public
 * @enum
 */
export declare const ConditionalOperator: {
    readonly AND: "AND";
    readonly OR: "OR";
};
/**
 * @public
 */
export type ConditionalOperator = (typeof ConditionalOperator)[keyof typeof ConditionalOperator];
/**
 * @public
 * @enum
 */
export declare const ContinuousBackupsStatus: {
    readonly DISABLED: "DISABLED";
    readonly ENABLED: "ENABLED";
};
/**
 * @public
 */
export type ContinuousBackupsStatus = (typeof ContinuousBackupsStatus)[keyof typeof ContinuousBackupsStatus];
/**
 * @public
 * @enum
 */
export declare const PointInTimeRecoveryStatus: {
    readonly DISABLED: "DISABLED";
    readonly ENABLED: "ENABLED";
};
/**
 * @public
 */
export type PointInTimeRecoveryStatus = (typeof PointInTimeRecoveryStatus)[keyof typeof PointInTimeRecoveryStatus];
/**
 * <p>The description of the point in time settings applied to the table.</p>
 * @public
 */
export interface PointInTimeRecoveryDescription {
    /**
     * <p>The current state of point in time recovery:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>ENABLED</code> - Point in time recovery is enabled.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DISABLED</code> - Point in time recovery is disabled.</p>
     *             </li>
     *          </ul>
     * @public
     */
    PointInTimeRecoveryStatus?: PointInTimeRecoveryStatus | undefined;
    /**
     * <p>The number of preceding days for which continuous backups are taken and maintained.
     *             Your table data is only recoverable to any point-in-time from within the configured
     *             recovery period. This parameter is optional.</p>
     * @public
     */
    RecoveryPeriodInDays?: number | undefined;
    /**
     * <p>Specifies the earliest point in time you can restore your table to. You can restore
     *             your table to any point in time during the last 35 days. </p>
     * @public
     */
    EarliestRestorableDateTime?: Date | undefined;
    /**
     * <p>
     *             <code>LatestRestorableDateTime</code> is typically 5 minutes before the current time.
     *         </p>
     * @public
     */
    LatestRestorableDateTime?: Date | undefined;
}
/**
 * <p>Represents the continuous backups and point in time recovery settings on the
 *             table.</p>
 * @public
 */
export interface ContinuousBackupsDescription {
    /**
     * <p>
     *             <code>ContinuousBackupsStatus</code> can be one of the following states: ENABLED,
     *             DISABLED</p>
     * @public
     */
    ContinuousBackupsStatus: ContinuousBackupsStatus | undefined;
    /**
     * <p>The description of the point in time recovery settings applied to the table.</p>
     * @public
     */
    PointInTimeRecoveryDescription?: PointInTimeRecoveryDescription | undefined;
}
/**
 * <p>Backups have not yet been enabled for this table.</p>
 * @public
 */
export declare class ContinuousBackupsUnavailableException extends __BaseException {
    readonly name: "ContinuousBackupsUnavailableException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ContinuousBackupsUnavailableException, __BaseException>);
}
/**
 * @public
 * @enum
 */
export declare const ContributorInsightsAction: {
    readonly DISABLE: "DISABLE";
    readonly ENABLE: "ENABLE";
};
/**
 * @public
 */
export type ContributorInsightsAction = (typeof ContributorInsightsAction)[keyof typeof ContributorInsightsAction];
/**
 * @public
 * @enum
 */
export declare const ContributorInsightsMode: {
    readonly ACCESSED_AND_THROTTLED_KEYS: "ACCESSED_AND_THROTTLED_KEYS";
    readonly THROTTLED_KEYS: "THROTTLED_KEYS";
};
/**
 * @public
 */
export type ContributorInsightsMode = (typeof ContributorInsightsMode)[keyof typeof ContributorInsightsMode];
/**
 * @public
 * @enum
 */
export declare const ContributorInsightsStatus: {
    readonly DISABLED: "DISABLED";
    readonly DISABLING: "DISABLING";
    readonly ENABLED: "ENABLED";
    readonly ENABLING: "ENABLING";
    readonly FAILED: "FAILED";
};
/**
 * @public
 */
export type ContributorInsightsStatus = (typeof ContributorInsightsStatus)[keyof typeof ContributorInsightsStatus];
/**
 * <p>Represents a Contributor Insights summary entry.</p>
 * @public
 */
export interface ContributorInsightsSummary {
    /**
     * <p>Name of the table associated with the summary.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>Name of the index associated with the summary, if any.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>Describes the current status for contributor insights for the given table and index,
     *             if applicable.</p>
     * @public
     */
    ContributorInsightsStatus?: ContributorInsightsStatus | undefined;
    /**
     * <p>Indicates the current mode of CloudWatch Contributor Insights, specifying whether it
     *             tracks all access and throttled events or throttled events only for the DynamoDB
     *             table or index.</p>
     * @public
     */
    ContributorInsightsMode?: ContributorInsightsMode | undefined;
}
/**
 * @public
 */
export interface CreateBackupInput {
    /**
     * <p>The name of the table. You can also provide the Amazon Resource Name (ARN) of the table in this
     *             parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>Specified name for the backup.</p>
     * @public
     */
    BackupName: string | undefined;
}
/**
 * @public
 */
export interface CreateBackupOutput {
    /**
     * <p>Contains the details of the backup created for the table.</p>
     * @public
     */
    BackupDetails?: BackupDetails | undefined;
}
/**
 * <p>There is no limit to the number of daily on-demand backups that can be taken. </p>
 *          <p>For most purposes, up to 500 simultaneous table operations are allowed per account.
 *             These operations include <code>CreateTable</code>, <code>UpdateTable</code>,
 *                 <code>DeleteTable</code>,<code>UpdateTimeToLive</code>,
 *                 <code>RestoreTableFromBackup</code>, and <code>RestoreTableToPointInTime</code>. </p>
 *          <p>When you are creating a table with one or more secondary indexes, you can have up
 *             to 250 such requests running at a time. However, if the table or index specifications
 *             are complex, then DynamoDB might temporarily reduce the number of concurrent
 *             operations.</p>
 *          <p>When importing into DynamoDB, up to 50 simultaneous import table operations are
 *             allowed per account.</p>
 *          <p>There is a soft account quota of 2,500 tables.</p>
 *          <p>GetRecords was called with a value of more than 1000 for the limit request
 *             parameter.</p>
 *          <p>More than 2 processes are reading from the same streams shard at the same time.
 *             Exceeding this limit may result in request throttling.</p>
 * @public
 */
export declare class LimitExceededException extends __BaseException {
    readonly name: "LimitExceededException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<LimitExceededException, __BaseException>);
}
/**
 * <p>A target table with the specified name is either being created or deleted.
 *         </p>
 * @public
 */
export declare class TableInUseException extends __BaseException {
    readonly name: "TableInUseException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<TableInUseException, __BaseException>);
}
/**
 * <p>A source table with the name <code>TableName</code> does not currently exist within
 *             the subscriber's account or the subscriber is operating in the wrong Amazon Web Services
 *             Region.</p>
 * @public
 */
export declare class TableNotFoundException extends __BaseException {
    readonly name: "TableNotFoundException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<TableNotFoundException, __BaseException>);
}
/**
 * <p>Provides visibility into the number of read and write operations your table or
 *             secondary index can instantaneously support. The settings can be modified using the
 *                 <code>UpdateTable</code> operation to meet the throughput requirements of an
 *             upcoming peak event.</p>
 * @public
 */
export interface WarmThroughput {
    /**
     * <p>Represents the number of read operations your base table can instantaneously
     *             support.</p>
     * @public
     */
    ReadUnitsPerSecond?: number | undefined;
    /**
     * <p>Represents the number of write operations your base table can instantaneously
     *             support.</p>
     * @public
     */
    WriteUnitsPerSecond?: number | undefined;
}
/**
 * <p>Represents a new global secondary index to be added to an existing table.</p>
 * @public
 */
export interface CreateGlobalSecondaryIndexAction {
    /**
     * <p>The name of the global secondary index to be created.</p>
     * @public
     */
    IndexName: string | undefined;
    /**
     * <p>The key schema for the global secondary index.</p>
     * @public
     */
    KeySchema: KeySchemaElement[] | undefined;
    /**
     * <p>Represents attributes that are copied (projected) from the table into an index. These
     *             are in addition to the primary key attributes and index key attributes, which are
     *             automatically projected.</p>
     * @public
     */
    Projection: Projection | undefined;
    /**
     * <p>Represents the provisioned throughput settings for the specified global secondary
     *             index.</p>
     *          <p>For current minimum and maximum provisioned throughput values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html">Service,
     *                 Account, and Table Quotas</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ProvisionedThroughput?: ProvisionedThroughput | undefined;
    /**
     * <p>The maximum number of read and write units for the global secondary index being
     *             created. If you use this parameter, you must specify <code>MaxReadRequestUnits</code>,
     *                 <code>MaxWriteRequestUnits</code>, or both. You must use either <code>OnDemand
     *                 Throughput</code> or <code>ProvisionedThroughput</code> based on your table's
     *             capacity mode.</p>
     * @public
     */
    OnDemandThroughput?: OnDemandThroughput | undefined;
    /**
     * <p>Represents the warm throughput value (in read units per second and write units per
     *             second) when creating a secondary index.</p>
     * @public
     */
    WarmThroughput?: WarmThroughput | undefined;
}
/**
 * <p>Represents the properties of a replica.</p>
 * @public
 */
export interface Replica {
    /**
     * <p>The Region where the replica needs to be created.</p>
     * @public
     */
    RegionName?: string | undefined;
}
/**
 * @public
 */
export interface CreateGlobalTableInput {
    /**
     * <p>The global table name.</p>
     * @public
     */
    GlobalTableName: string | undefined;
    /**
     * <p>The Regions where the global table needs to be created.</p>
     * @public
     */
    ReplicationGroup: Replica[] | undefined;
}
/**
 * @public
 * @enum
 */
export declare const GlobalTableStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly CREATING: "CREATING";
    readonly DELETING: "DELETING";
    readonly UPDATING: "UPDATING";
};
/**
 * @public
 */
export type GlobalTableStatus = (typeof GlobalTableStatus)[keyof typeof GlobalTableStatus];
/**
 * <p>Overrides the on-demand throughput settings for this replica table. If you don't
 *             specify a value for this parameter, it uses the source table's on-demand throughput
 *             settings.</p>
 * @public
 */
export interface OnDemandThroughputOverride {
    /**
     * <p>Maximum number of read request units for the specified replica table.</p>
     * @public
     */
    MaxReadRequestUnits?: number | undefined;
}
/**
 * <p>Replica-specific provisioned throughput settings. If not specified, uses the source
 *             table's provisioned throughput settings.</p>
 * @public
 */
export interface ProvisionedThroughputOverride {
    /**
     * <p>Replica-specific read capacity units. If not specified, uses the source table's read
     *             capacity settings.</p>
     * @public
     */
    ReadCapacityUnits?: number | undefined;
}
/**
 * @public
 * @enum
 */
export declare const IndexStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly CREATING: "CREATING";
    readonly DELETING: "DELETING";
    readonly UPDATING: "UPDATING";
};
/**
 * @public
 */
export type IndexStatus = (typeof IndexStatus)[keyof typeof IndexStatus];
/**
 * <p>The description of the warm throughput value on a global secondary index.</p>
 * @public
 */
export interface GlobalSecondaryIndexWarmThroughputDescription {
    /**
     * <p>Represents warm throughput read units per second value for a global secondary
     *             index.</p>
     * @public
     */
    ReadUnitsPerSecond?: number | undefined;
    /**
     * <p>Represents warm throughput write units per second value for a global secondary
     *             index.</p>
     * @public
     */
    WriteUnitsPerSecond?: number | undefined;
    /**
     * <p>Represents the warm throughput status being created or updated on a global secondary
     *             index. The status can only be <code>UPDATING</code> or <code>ACTIVE</code>.</p>
     * @public
     */
    Status?: IndexStatus | undefined;
}
/**
 * <p>Represents the properties of a replica global secondary index.</p>
 * @public
 */
export interface ReplicaGlobalSecondaryIndexDescription {
    /**
     * <p>The name of the global secondary index.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>If not described, uses the source table GSI's read capacity settings.</p>
     * @public
     */
    ProvisionedThroughputOverride?: ProvisionedThroughputOverride | undefined;
    /**
     * <p>Overrides the maximum on-demand throughput for the specified global secondary index in
     *             the specified replica table.</p>
     * @public
     */
    OnDemandThroughputOverride?: OnDemandThroughputOverride | undefined;
    /**
     * <p>Represents the warm throughput of the global secondary index for this replica.</p>
     * @public
     */
    WarmThroughput?: GlobalSecondaryIndexWarmThroughputDescription | undefined;
}
/**
 * @public
 * @enum
 */
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
/**
 * @public
 */
export type ReplicaStatus = (typeof ReplicaStatus)[keyof typeof ReplicaStatus];
/**
 * @public
 * @enum
 */
export declare const TableClass: {
    readonly STANDARD: "STANDARD";
    readonly STANDARD_INFREQUENT_ACCESS: "STANDARD_INFREQUENT_ACCESS";
};
/**
 * @public
 */
export type TableClass = (typeof TableClass)[keyof typeof TableClass];
/**
 * <p>Contains details of the table class.</p>
 * @public
 */
export interface TableClassSummary {
    /**
     * <p>The table class of the specified table. Valid values are <code>STANDARD</code> and
     *                 <code>STANDARD_INFREQUENT_ACCESS</code>.</p>
     * @public
     */
    TableClass?: TableClass | undefined;
    /**
     * <p>The date and time at which the table class was last updated.</p>
     * @public
     */
    LastUpdateDateTime?: Date | undefined;
}
/**
 * @public
 * @enum
 */
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
/**
 * @public
 */
export type TableStatus = (typeof TableStatus)[keyof typeof TableStatus];
/**
 * <p>Represents the warm throughput value (in read units per second and write units per
 *             second) of the table. Warm throughput is applicable for DynamoDB Standard-IA tables and
 *             specifies the minimum provisioned capacity maintained for immediate data access.</p>
 * @public
 */
export interface TableWarmThroughputDescription {
    /**
     * <p>Represents the base table's warm throughput value in read units per second.</p>
     * @public
     */
    ReadUnitsPerSecond?: number | undefined;
    /**
     * <p>Represents the base table's warm throughput value in write units per second.</p>
     * @public
     */
    WriteUnitsPerSecond?: number | undefined;
    /**
     * <p>Represents warm throughput value of the base table.</p>
     * @public
     */
    Status?: TableStatus | undefined;
}
/**
 * <p>Contains the details of the replica.</p>
 * @public
 */
export interface ReplicaDescription {
    /**
     * <p>The name of the Region.</p>
     * @public
     */
    RegionName?: string | undefined;
    /**
     * <p>The current state of the replica:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>CREATING</code> - The replica is being created.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATING</code> - The replica is being updated.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETING</code> - The replica is being deleted.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ACTIVE</code> - The replica is ready for use.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>REGION_DISABLED</code> - The replica is inaccessible because the Amazon Web Services Region has been disabled.</p>
     *                <note>
     *                   <p>If the Amazon Web Services Region remains inaccessible for more than 20
     *                         hours, DynamoDB will remove this replica from the replication
     *                         group. The replica will not be deleted and replication will stop from and to
     *                         this region.</p>
     *                </note>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>INACCESSIBLE_ENCRYPTION_CREDENTIALS </code> - The KMS key
     *                     used to encrypt the table is inaccessible.</p>
     *                <note>
     *                   <p>If the KMS key remains inaccessible for more than 20 hours,
     *                             DynamoDB will remove this replica from the replication group.
     *                         The replica will not be deleted and replication will stop from and to this
     *                         region.</p>
     *                </note>
     *             </li>
     *          </ul>
     * @public
     */
    ReplicaStatus?: ReplicaStatus | undefined;
    /**
     * <p>Detailed information about the replica status.</p>
     * @public
     */
    ReplicaStatusDescription?: string | undefined;
    /**
     * <p>Specifies the progress of a Create, Update, or Delete action on the replica as a
     *             percentage.</p>
     * @public
     */
    ReplicaStatusPercentProgress?: string | undefined;
    /**
     * <p>The KMS key of the replica that will be used for KMS
     *             encryption.</p>
     * @public
     */
    KMSMasterKeyId?: string | undefined;
    /**
     * <p>Replica-specific provisioned throughput. If not described, uses the source table's
     *             provisioned throughput settings.</p>
     * @public
     */
    ProvisionedThroughputOverride?: ProvisionedThroughputOverride | undefined;
    /**
     * <p>Overrides the maximum on-demand throughput settings for the specified replica
     *             table.</p>
     * @public
     */
    OnDemandThroughputOverride?: OnDemandThroughputOverride | undefined;
    /**
     * <p>Represents the warm throughput value for this replica.</p>
     * @public
     */
    WarmThroughput?: TableWarmThroughputDescription | undefined;
    /**
     * <p>Replica-specific global secondary index settings.</p>
     * @public
     */
    GlobalSecondaryIndexes?: ReplicaGlobalSecondaryIndexDescription[] | undefined;
    /**
     * <p>The time at which the replica was first detected as inaccessible. To determine cause
     *             of inaccessibility check the <code>ReplicaStatus</code> property.</p>
     * @public
     */
    ReplicaInaccessibleDateTime?: Date | undefined;
    /**
     * <p>Contains details of the table class.</p>
     * @public
     */
    ReplicaTableClassSummary?: TableClassSummary | undefined;
}
/**
 * <p>Contains details about the global table.</p>
 * @public
 */
export interface GlobalTableDescription {
    /**
     * <p>The Regions where the global table has replicas.</p>
     * @public
     */
    ReplicationGroup?: ReplicaDescription[] | undefined;
    /**
     * <p>The unique identifier of the global table.</p>
     * @public
     */
    GlobalTableArn?: string | undefined;
    /**
     * <p>The creation time of the global table.</p>
     * @public
     */
    CreationDateTime?: Date | undefined;
    /**
     * <p>The current state of the global table:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>CREATING</code> - The global table is being created.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATING</code> - The global table is being updated.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETING</code> - The global table is being deleted.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ACTIVE</code> - The global table is ready for use.</p>
     *             </li>
     *          </ul>
     * @public
     */
    GlobalTableStatus?: GlobalTableStatus | undefined;
    /**
     * <p>The global table name.</p>
     * @public
     */
    GlobalTableName?: string | undefined;
}
/**
 * @public
 */
export interface CreateGlobalTableOutput {
    /**
     * <p>Contains the details of the global table.</p>
     * @public
     */
    GlobalTableDescription?: GlobalTableDescription | undefined;
}
/**
 * <p>The specified global table already exists.</p>
 * @public
 */
export declare class GlobalTableAlreadyExistsException extends __BaseException {
    readonly name: "GlobalTableAlreadyExistsException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<GlobalTableAlreadyExistsException, __BaseException>);
}
/**
 * <p>Specifies the action to add a new witness Region to a MRSC global table. A MRSC global
 *             table can be configured with either three replicas, or with two replicas and one
 *             witness.</p>
 * @public
 */
export interface CreateGlobalTableWitnessGroupMemberAction {
    /**
     * <p>The Amazon Web Services Region name to be added as a witness Region for the MRSC global
     *             table. The witness must be in a different Region than the replicas and within the same
     *             Region set:</p>
     *          <ul>
     *             <li>
     *                <p>US Region set: US East (N. Virginia), US East (Ohio), US West (Oregon)</p>
     *             </li>
     *             <li>
     *                <p>EU Region set: Europe (Ireland), Europe (London), Europe (Paris), Europe
     *                     (Frankfurt)</p>
     *             </li>
     *             <li>
     *                <p>AP Region set: Asia Pacific (Tokyo), Asia Pacific (Seoul), Asia Pacific
     *                     (Osaka)</p>
     *             </li>
     *          </ul>
     * @public
     */
    RegionName: string | undefined;
}
/**
 * <p>Represents a replica to be added.</p>
 * @public
 */
export interface CreateReplicaAction {
    /**
     * <p>The Region of the replica to be added.</p>
     * @public
     */
    RegionName: string | undefined;
}
/**
 * <p>Represents the properties of a replica global secondary index.</p>
 * @public
 */
export interface ReplicaGlobalSecondaryIndex {
    /**
     * <p>The name of the global secondary index.</p>
     * @public
     */
    IndexName: string | undefined;
    /**
     * <p>Replica table GSI-specific provisioned throughput. If not specified, uses the source
     *             table GSI's read capacity settings.</p>
     * @public
     */
    ProvisionedThroughputOverride?: ProvisionedThroughputOverride | undefined;
    /**
     * <p>Overrides the maximum on-demand throughput settings for the specified global secondary
     *             index in the specified replica table.</p>
     * @public
     */
    OnDemandThroughputOverride?: OnDemandThroughputOverride | undefined;
}
/**
 * <p>Represents a replica to be created.</p>
 * @public
 */
export interface CreateReplicationGroupMemberAction {
    /**
     * <p>The Region where the new replica will be created.</p>
     * @public
     */
    RegionName: string | undefined;
    /**
     * <p>The KMS key that should be used for KMS encryption in
     *             the new replica. To specify a key, use its key ID, Amazon Resource Name (ARN), alias
     *             name, or alias ARN. Note that you should only provide this parameter if the key is
     *             different from the default DynamoDB KMS key
     *             <code>alias/aws/dynamodb</code>.</p>
     * @public
     */
    KMSMasterKeyId?: string | undefined;
    /**
     * <p>Replica-specific provisioned throughput. If not specified, uses the source table's
     *             provisioned throughput settings.</p>
     * @public
     */
    ProvisionedThroughputOverride?: ProvisionedThroughputOverride | undefined;
    /**
     * <p>The maximum on-demand throughput settings for the specified replica table being
     *             created. You can only modify <code>MaxReadRequestUnits</code>, because you can't modify
     *                 <code>MaxWriteRequestUnits</code> for individual replica tables. </p>
     * @public
     */
    OnDemandThroughputOverride?: OnDemandThroughputOverride | undefined;
    /**
     * <p>Replica-specific global secondary index settings.</p>
     * @public
     */
    GlobalSecondaryIndexes?: ReplicaGlobalSecondaryIndex[] | undefined;
    /**
     * <p>Replica-specific table class. If not specified, uses the source table's table
     *             class.</p>
     * @public
     */
    TableClassOverride?: TableClass | undefined;
}
/**
 * <p>Represents the properties of a global secondary index.</p>
 * @public
 */
export interface GlobalSecondaryIndex {
    /**
     * <p>The name of the global secondary index. The name must be unique among all other
     *             indexes on this table.</p>
     * @public
     */
    IndexName: string | undefined;
    /**
     * <p>The complete key schema for a global secondary index, which consists of one or more
     *             pairs of attribute names and key types:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>HASH</code> - partition key</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>RANGE</code> - sort key</p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>The partition key of an item is also known as its <i>hash
     *                     attribute</i>. The term "hash attribute" derives from DynamoDB's usage of
     *                 an internal hash function to evenly distribute data items across partitions, based
     *                 on their partition key values.</p>
     *             <p>The sort key of an item is also known as its <i>range attribute</i>.
     *                 The term "range attribute" derives from the way DynamoDB stores items with the same
     *                 partition key physically close together, in sorted order by the sort key
     *                 value.</p>
     *          </note>
     * @public
     */
    KeySchema: KeySchemaElement[] | undefined;
    /**
     * <p>Represents attributes that are copied (projected) from the table into the global
     *             secondary index. These are in addition to the primary key attributes and index key
     *             attributes, which are automatically projected. </p>
     * @public
     */
    Projection: Projection | undefined;
    /**
     * <p>Represents the provisioned throughput settings for the specified global secondary
     *             index. You must use either <code>OnDemandThroughput</code> or
     *                 <code>ProvisionedThroughput</code> based on your table's capacity mode.</p>
     *          <p>For current minimum and maximum provisioned throughput values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html">Service,
     *                 Account, and Table Quotas</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ProvisionedThroughput?: ProvisionedThroughput | undefined;
    /**
     * <p>The maximum number of read and write units for the specified global secondary index.
     *             If you use this parameter, you must specify <code>MaxReadRequestUnits</code>,
     *                 <code>MaxWriteRequestUnits</code>, or both. You must use either
     *                 <code>OnDemandThroughput</code> or <code>ProvisionedThroughput</code> based on your
     *             table's capacity mode.</p>
     * @public
     */
    OnDemandThroughput?: OnDemandThroughput | undefined;
    /**
     * <p>Represents the warm throughput value (in read units per second and write units per
     *             second) for the specified secondary index. If you use this parameter, you must specify
     *                 <code>ReadUnitsPerSecond</code>, <code>WriteUnitsPerSecond</code>, or both.</p>
     * @public
     */
    WarmThroughput?: WarmThroughput | undefined;
}
/**
 * <p>Represents the properties of a local secondary index.</p>
 * @public
 */
export interface LocalSecondaryIndex {
    /**
     * <p>The name of the local secondary index. The name must be unique among all other indexes
     *             on this table.</p>
     * @public
     */
    IndexName: string | undefined;
    /**
     * <p>The complete key schema for the local secondary index, consisting of one or more pairs
     *             of attribute names and key types:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>HASH</code> - partition key</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>RANGE</code> - sort key</p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>The partition key of an item is also known as its <i>hash
     *                     attribute</i>. The term "hash attribute" derives from DynamoDB's usage of
     *                 an internal hash function to evenly distribute data items across partitions, based
     *                 on their partition key values.</p>
     *             <p>The sort key of an item is also known as its <i>range attribute</i>.
     *                 The term "range attribute" derives from the way DynamoDB stores items with the same
     *                 partition key physically close together, in sorted order by the sort key
     *                 value.</p>
     *          </note>
     * @public
     */
    KeySchema: KeySchemaElement[] | undefined;
    /**
     * <p>Represents attributes that are copied (projected) from the table into the local
     *             secondary index. These are in addition to the primary key attributes and index key
     *             attributes, which are automatically projected. </p>
     * @public
     */
    Projection: Projection | undefined;
}
/**
 * <p>Represents the settings used to enable server-side encryption.</p>
 * @public
 */
export interface SSESpecification {
    /**
     * <p>Indicates whether server-side encryption is done using an Amazon Web Services managed
     *             key or an Amazon Web Services owned key. If enabled (true), server-side encryption type
     *             is set to <code>KMS</code> and an Amazon Web Services managed key is used (KMS charges apply). If disabled (false) or not specified, server-side
     *             encryption is set to Amazon Web Services owned key.</p>
     * @public
     */
    Enabled?: boolean | undefined;
    /**
     * <p>Server-side encryption type. The only supported value is:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>KMS</code> - Server-side encryption that uses Key Management Service. The
     *                     key is stored in your account and is managed by KMS (KMS charges apply).</p>
     *             </li>
     *          </ul>
     * @public
     */
    SSEType?: SSEType | undefined;
    /**
     * <p>The KMS key that should be used for the KMS encryption.
     *             To specify a key, use its key ID, Amazon Resource Name (ARN), alias name, or alias ARN.
     *             Note that you should only provide this parameter if the key is different from the
     *             default DynamoDB key <code>alias/aws/dynamodb</code>.</p>
     * @public
     */
    KMSMasterKeyId?: string | undefined;
}
/**
 * <p>Describes a tag. A tag is a key-value pair. You can add up to 50 tags to a single
 *             DynamoDB table. </p>
 *          <p>Amazon Web Services-assigned tag names and values are automatically assigned the
 *                 <code>aws:</code> prefix, which the user cannot assign. Amazon Web Services-assigned
 *             tag names do not count towards the tag limit of 50. User-assigned tag names have the
 *             prefix <code>user:</code> in the Cost Allocation Report. You cannot backdate the
 *             application of a tag.</p>
 *          <p>For an overview on tagging DynamoDB resources, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Tagging.html">Tagging
 *                 for DynamoDB</a> in the <i>Amazon DynamoDB Developer
 *                 Guide</i>.</p>
 * @public
 */
export interface Tag {
    /**
     * <p>The key of the tag. Tag keys are case sensitive. Each DynamoDB table can
     *             only have up to one tag with the same key. If you try to add an existing tag (same key),
     *             the existing tag value will be updated to the new value.</p>
     * @public
     */
    Key: string | undefined;
    /**
     * <p>The value of the tag. Tag values are case-sensitive and can be null.</p>
     * @public
     */
    Value: string | undefined;
}
/**
 * <p>Represents the input of a <code>CreateTable</code> operation.</p>
 * @public
 */
export interface CreateTableInput {
    /**
     * <p>An array of attributes that describe the key schema for the table and indexes.</p>
     * @public
     */
    AttributeDefinitions: AttributeDefinition[] | undefined;
    /**
     * <p>The name of the table to create. You can also provide the Amazon Resource Name (ARN) of the table in
     *             this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>Specifies the attributes that make up the primary key for a table or an index. The
     *             attributes in <code>KeySchema</code> must also be defined in the
     *                 <code>AttributeDefinitions</code> array. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DataModel.html">Data
     *                 Model</a> in the <i>Amazon DynamoDB Developer Guide</i>.</p>
     *          <p>Each <code>KeySchemaElement</code> in the array is composed of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>AttributeName</code> - The name of this key attribute.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>KeyType</code> - The role that the key attribute will assume:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>HASH</code> - partition key</p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>RANGE</code> - sort key</p>
     *                   </li>
     *                </ul>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>The partition key of an item is also known as its <i>hash
     *                     attribute</i>. The term "hash attribute" derives from the DynamoDB usage
     *                 of an internal hash function to evenly distribute data items across partitions,
     *                 based on their partition key values.</p>
     *             <p>The sort key of an item is also known as its <i>range attribute</i>.
     *                 The term "range attribute" derives from the way DynamoDB stores items with the same
     *                 partition key physically close together, in sorted order by the sort key
     *                 value.</p>
     *          </note>
     *          <p>For a simple primary key (partition key), you must provide exactly one element with a
     *                 <code>KeyType</code> of <code>HASH</code>.</p>
     *          <p>For a composite primary key (partition key and sort key), you must provide exactly two
     *             elements, in this order: The first element must have a <code>KeyType</code> of
     *                 <code>HASH</code>, and the second element must have a <code>KeyType</code> of
     *                 <code>RANGE</code>.</p>
     *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithTables.html#WorkingWithTables.primary.key">Working with Tables</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    KeySchema: KeySchemaElement[] | undefined;
    /**
     * <p>One or more local secondary indexes (the maximum is 5) to be created on the table.
     *             Each index is scoped to a given partition key value. There is a 10 GB size limit per
     *             partition key value; otherwise, the size of a local secondary index is
     *             unconstrained.</p>
     *          <p>Each local secondary index in the array includes the following:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>IndexName</code> - The name of the local secondary index. Must be unique
     *                     only for this table.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>KeySchema</code> - Specifies the key schema for the local secondary index.
     *                     The key schema must begin with the same partition key as the table.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>Projection</code> - Specifies attributes that are copied (projected) from
     *                     the table into the index. These are in addition to the primary key attributes
     *                     and index key attributes, which are automatically projected. Each attribute
     *                     specification is composed of:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>ProjectionType</code> - One of the following:</p>
     *                      <ul>
     *                         <li>
     *                            <p>
     *                               <code>KEYS_ONLY</code> - Only the index and primary keys are
     *                                     projected into the index.</p>
     *                         </li>
     *                         <li>
     *                            <p>
     *                               <code>INCLUDE</code> - Only the specified table attributes are
     *                                     projected into the index. The list of projected attributes is in
     *                                         <code>NonKeyAttributes</code>.</p>
     *                         </li>
     *                         <li>
     *                            <p>
     *                               <code>ALL</code> - All of the table attributes are projected
     *                                     into the index.</p>
     *                         </li>
     *                      </ul>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>NonKeyAttributes</code> - A list of one or more non-key attribute
     *                             names that are projected into the secondary index. The total count of
     *                             attributes provided in <code>NonKeyAttributes</code>, summed across all
     *                             of the secondary indexes, must not exceed 100. If you project the same
     *                             attribute into two different indexes, this counts as two distinct
     *                             attributes when determining the total. This limit only applies when you
     *                             specify the ProjectionType of <code>INCLUDE</code>. You still can
     *                             specify the ProjectionType of <code>ALL</code> to project all attributes
     *                             from the source table, even if the table has more than 100
     *                             attributes.</p>
     *                   </li>
     *                </ul>
     *             </li>
     *          </ul>
     * @public
     */
    LocalSecondaryIndexes?: LocalSecondaryIndex[] | undefined;
    /**
     * <p>One or more global secondary indexes (the maximum is 20) to be created on the table.
     *             Each global secondary index in the array includes the following:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>IndexName</code> - The name of the global secondary index. Must be unique
     *                     only for this table.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>KeySchema</code> - Specifies the key schema for the global secondary
     *                     index.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>Projection</code> - Specifies attributes that are copied (projected) from
     *                     the table into the index. These are in addition to the primary key attributes
     *                     and index key attributes, which are automatically projected. Each attribute
     *                     specification is composed of:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>ProjectionType</code> - One of the following:</p>
     *                      <ul>
     *                         <li>
     *                            <p>
     *                               <code>KEYS_ONLY</code> - Only the index and primary keys are
     *                                     projected into the index.</p>
     *                         </li>
     *                         <li>
     *                            <p>
     *                               <code>INCLUDE</code> - Only the specified table attributes are
     *                                     projected into the index. The list of projected attributes is in
     *                                         <code>NonKeyAttributes</code>.</p>
     *                         </li>
     *                         <li>
     *                            <p>
     *                               <code>ALL</code> - All of the table attributes are projected
     *                                     into the index.</p>
     *                         </li>
     *                      </ul>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>NonKeyAttributes</code> - A list of one or more non-key attribute
     *                             names that are projected into the secondary index. The total count of
     *                             attributes provided in <code>NonKeyAttributes</code>, summed across all
     *                             of the secondary indexes, must not exceed 100. If you project the same
     *                             attribute into two different indexes, this counts as two distinct
     *                             attributes when determining the total. This limit only applies when you
     *                             specify the ProjectionType of <code>INCLUDE</code>. You still can
     *                             specify the ProjectionType of <code>ALL</code> to project all attributes
     *                             from the source table, even if the table has more than 100
     *                             attributes.</p>
     *                   </li>
     *                </ul>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ProvisionedThroughput</code> - The provisioned throughput settings for the
     *                     global secondary index, consisting of read and write capacity units.</p>
     *             </li>
     *          </ul>
     * @public
     */
    GlobalSecondaryIndexes?: GlobalSecondaryIndex[] | undefined;
    /**
     * <p>Controls how you are charged for read and write throughput and how you manage
     *             capacity. This setting can be changed later.</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>PAY_PER_REQUEST</code> - We recommend using <code>PAY_PER_REQUEST</code>
     *                     for most DynamoDB workloads. <code>PAY_PER_REQUEST</code> sets the billing mode
     *                     to <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode.html">On-demand capacity mode</a>. </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>PROVISIONED</code> - We recommend using <code>PROVISIONED</code> for
     *                     steady workloads with predictable growth where capacity requirements can be
     *                     reliably forecasted. <code>PROVISIONED</code> sets the billing mode to <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/provisioned-capacity-mode.html">Provisioned capacity mode</a>.</p>
     *             </li>
     *          </ul>
     * @public
     */
    BillingMode?: BillingMode | undefined;
    /**
     * <p>Represents the provisioned throughput settings for a specified table or index. The
     *             settings can be modified using the <code>UpdateTable</code> operation.</p>
     *          <p> If you set BillingMode as <code>PROVISIONED</code>, you must specify this property.
     *             If you set BillingMode as <code>PAY_PER_REQUEST</code>, you cannot specify this
     *             property.</p>
     *          <p>For current minimum and maximum provisioned throughput values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html">Service,
     *                 Account, and Table Quotas</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ProvisionedThroughput?: ProvisionedThroughput | undefined;
    /**
     * <p>The settings for DynamoDB Streams on the table. These settings consist of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>StreamEnabled</code> - Indicates whether DynamoDB Streams is to be enabled
     *                     (true) or disabled (false).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>StreamViewType</code> - When an item in the table is modified,
     *                         <code>StreamViewType</code> determines what information is written to the
     *                     table's stream. Valid values for <code>StreamViewType</code> are:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>KEYS_ONLY</code> - Only the key attributes of the modified item
     *                             are written to the stream.</p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>NEW_IMAGE</code> - The entire item, as it appears after it was
     *                             modified, is written to the stream.</p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>OLD_IMAGE</code> - The entire item, as it appeared before it was
     *                             modified, is written to the stream.</p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>NEW_AND_OLD_IMAGES</code> - Both the new and the old item images
     *                             of the item are written to the stream.</p>
     *                   </li>
     *                </ul>
     *             </li>
     *          </ul>
     * @public
     */
    StreamSpecification?: StreamSpecification | undefined;
    /**
     * <p>Represents the settings used to enable server-side encryption.</p>
     * @public
     */
    SSESpecification?: SSESpecification | undefined;
    /**
     * <p>A list of key-value pairs to label the table. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Tagging.html">Tagging
     *                 for DynamoDB</a>.</p>
     * @public
     */
    Tags?: Tag[] | undefined;
    /**
     * <p>The table class of the new table. Valid values are <code>STANDARD</code> and
     *                 <code>STANDARD_INFREQUENT_ACCESS</code>.</p>
     * @public
     */
    TableClass?: TableClass | undefined;
    /**
     * <p>Indicates whether deletion protection is to be enabled (true) or disabled (false) on
     *             the table.</p>
     * @public
     */
    DeletionProtectionEnabled?: boolean | undefined;
    /**
     * <p>Represents the warm throughput (in read units per second and write units per second)
     *             for creating a table.</p>
     * @public
     */
    WarmThroughput?: WarmThroughput | undefined;
    /**
     * <p>An Amazon Web Services resource-based policy document in JSON format that will be
     *             attached to the table.</p>
     *          <p>When you attach a resource-based policy while creating a table, the policy application
     *             is <i>strongly consistent</i>.</p>
     *          <p>The maximum size supported for a resource-based policy document is 20 KB. DynamoDB counts whitespaces when calculating the size of a policy against this
     *             limit. For a full list of all considerations that apply for resource-based policies, see
     *                 <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/rbac-considerations.html">Resource-based
     *                 policy considerations</a>.</p>
     *          <note>
     *             <p>You need to specify the <code>CreateTable</code> and
     *                     <code>PutResourcePolicy</code>
     *                 IAM actions for authorizing a user to create a table with a
     *                 resource-based policy.</p>
     *          </note>
     * @public
     */
    ResourcePolicy?: string | undefined;
    /**
     * <p>Sets the maximum number of read and write units for the specified table in on-demand
     *             capacity mode. If you use this parameter, you must specify
     *                 <code>MaxReadRequestUnits</code>, <code>MaxWriteRequestUnits</code>, or both.</p>
     * @public
     */
    OnDemandThroughput?: OnDemandThroughput | undefined;
}
/**
 * <p>Represents the provisioned throughput settings for the table, consisting of read and
 *             write capacity units, along with data about increases and decreases.</p>
 * @public
 */
export interface ProvisionedThroughputDescription {
    /**
     * <p>The date and time of the last provisioned throughput increase for this table.</p>
     * @public
     */
    LastIncreaseDateTime?: Date | undefined;
    /**
     * <p>The date and time of the last provisioned throughput decrease for this table.</p>
     * @public
     */
    LastDecreaseDateTime?: Date | undefined;
    /**
     * <p>The number of provisioned throughput decreases for this table during this UTC calendar
     *             day. For current maximums on provisioned throughput decreases, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html">Service,
     *                 Account, and Table Quotas</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    NumberOfDecreasesToday?: number | undefined;
    /**
     * <p>The maximum number of strongly consistent reads consumed per second before DynamoDB
     *             returns a <code>ThrottlingException</code>. Eventually consistent reads require less
     *             effort than strongly consistent reads, so a setting of 50 <code>ReadCapacityUnits</code>
     *             per second provides 100 eventually consistent <code>ReadCapacityUnits</code> per
     *             second.</p>
     * @public
     */
    ReadCapacityUnits?: number | undefined;
    /**
     * <p>The maximum number of writes consumed per second before DynamoDB returns a
     *                 <code>ThrottlingException</code>.</p>
     * @public
     */
    WriteCapacityUnits?: number | undefined;
}
/**
 * <p>Represents the properties of a global secondary index.</p>
 * @public
 */
export interface GlobalSecondaryIndexDescription {
    /**
     * <p>The name of the global secondary index.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>The complete key schema for a global secondary index, which consists of one or more
     *             pairs of attribute names and key types:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>HASH</code> - partition key</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>RANGE</code> - sort key</p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>The partition key of an item is also known as its <i>hash
     *                     attribute</i>. The term "hash attribute" derives from DynamoDB's usage of an internal hash function to evenly distribute data items across
     *                 partitions, based on their partition key values.</p>
     *             <p>The sort key of an item is also known as its <i>range attribute</i>.
     *                 The term "range attribute" derives from the way DynamoDB stores items with
     *                 the same partition key physically close together, in sorted order by the sort key
     *                 value.</p>
     *          </note>
     * @public
     */
    KeySchema?: KeySchemaElement[] | undefined;
    /**
     * <p>Represents attributes that are copied (projected) from the table into the global
     *             secondary index. These are in addition to the primary key attributes and index key
     *             attributes, which are automatically projected. </p>
     * @public
     */
    Projection?: Projection | undefined;
    /**
     * <p>The current state of the global secondary index:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>CREATING</code> - The index is being created.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATING</code> - The index is being updated.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETING</code> - The index is being deleted.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ACTIVE</code> - The index is ready for use.</p>
     *             </li>
     *          </ul>
     * @public
     */
    IndexStatus?: IndexStatus | undefined;
    /**
     * <p>Indicates whether the index is currently backfilling. <i>Backfilling</i>
     *             is the process of reading items from the table and determining whether they can be added
     *             to the index. (Not all items will qualify: For example, a partition key cannot have any
     *             duplicate values.) If an item can be added to the index, DynamoDB will do so. After all
     *             items have been processed, the backfilling operation is complete and
     *                 <code>Backfilling</code> is false.</p>
     *          <p>You can delete an index that is being created during the <code>Backfilling</code>
     *             phase when <code>IndexStatus</code> is set to CREATING and <code>Backfilling</code> is
     *             true. You can't delete the index that is being created when <code>IndexStatus</code> is
     *             set to CREATING and <code>Backfilling</code> is false. </p>
     *          <note>
     *             <p>For indexes that were created during a <code>CreateTable</code> operation, the
     *                     <code>Backfilling</code> attribute does not appear in the
     *                     <code>DescribeTable</code> output.</p>
     *          </note>
     * @public
     */
    Backfilling?: boolean | undefined;
    /**
     * <p>Represents the provisioned throughput settings for the specified global secondary
     *             index.</p>
     *          <p>For current minimum and maximum provisioned throughput values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html">Service,
     *                 Account, and Table Quotas</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ProvisionedThroughput?: ProvisionedThroughputDescription | undefined;
    /**
     * <p>The total size of the specified index, in bytes. DynamoDB updates this value
     *             approximately every six hours. Recent changes might not be reflected in this
     *             value.</p>
     * @public
     */
    IndexSizeBytes?: number | undefined;
    /**
     * <p>The number of items in the specified index. DynamoDB updates this value approximately
     *             every six hours. Recent changes might not be reflected in this value.</p>
     * @public
     */
    ItemCount?: number | undefined;
    /**
     * <p>The Amazon Resource Name (ARN) that uniquely identifies the index.</p>
     * @public
     */
    IndexArn?: string | undefined;
    /**
     * <p>The maximum number of read and write units for the specified global secondary index.
     *             If you use this parameter, you must specify <code>MaxReadRequestUnits</code>,
     *                 <code>MaxWriteRequestUnits</code>, or both.</p>
     * @public
     */
    OnDemandThroughput?: OnDemandThroughput | undefined;
    /**
     * <p>Represents the warm throughput value (in read units per second and write units per
     *             second) for the specified secondary index.</p>
     * @public
     */
    WarmThroughput?: GlobalSecondaryIndexWarmThroughputDescription | undefined;
}
/**
 * @public
 * @enum
 */
export declare const WitnessStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly CREATING: "CREATING";
    readonly DELETING: "DELETING";
};
/**
 * @public
 */
export type WitnessStatus = (typeof WitnessStatus)[keyof typeof WitnessStatus];
/**
 * <p>Represents the properties of a witness Region in a MRSC global table. </p>
 * @public
 */
export interface GlobalTableWitnessDescription {
    /**
     * <p>The name of the Amazon Web Services Region that serves as a witness for the MRSC global
     *             table.</p>
     * @public
     */
    RegionName?: string | undefined;
    /**
     * <p>The current status of the witness Region in the MRSC global table.</p>
     * @public
     */
    WitnessStatus?: WitnessStatus | undefined;
}
/**
 * <p>Represents the properties of a local secondary index.</p>
 * @public
 */
export interface LocalSecondaryIndexDescription {
    /**
     * <p>Represents the name of the local secondary index.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>The complete key schema for the local secondary index, consisting of one or more pairs
     *             of attribute names and key types:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>HASH</code> - partition key</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>RANGE</code> - sort key</p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>The partition key of an item is also known as its <i>hash
     *                     attribute</i>. The term "hash attribute" derives from DynamoDB's usage of
     *                 an internal hash function to evenly distribute data items across partitions, based
     *                 on their partition key values.</p>
     *             <p>The sort key of an item is also known as its <i>range attribute</i>.
     *                 The term "range attribute" derives from the way DynamoDB stores items with the same
     *                 partition key physically close together, in sorted order by the sort key
     *                 value.</p>
     *          </note>
     * @public
     */
    KeySchema?: KeySchemaElement[] | undefined;
    /**
     * <p>Represents attributes that are copied (projected) from the table into the global
     *             secondary index. These are in addition to the primary key attributes and index key
     *             attributes, which are automatically projected. </p>
     * @public
     */
    Projection?: Projection | undefined;
    /**
     * <p>The total size of the specified index, in bytes. DynamoDB updates this value
     *             approximately every six hours. Recent changes might not be reflected in this
     *             value.</p>
     * @public
     */
    IndexSizeBytes?: number | undefined;
    /**
     * <p>The number of items in the specified index. DynamoDB updates this value
     *             approximately every six hours. Recent changes might not be reflected in this
     *             value.</p>
     * @public
     */
    ItemCount?: number | undefined;
    /**
     * <p>The Amazon Resource Name (ARN) that uniquely identifies the index.</p>
     * @public
     */
    IndexArn?: string | undefined;
}
/**
 * @public
 * @enum
 */
export declare const MultiRegionConsistency: {
    readonly EVENTUAL: "EVENTUAL";
    readonly STRONG: "STRONG";
};
/**
 * @public
 */
export type MultiRegionConsistency = (typeof MultiRegionConsistency)[keyof typeof MultiRegionConsistency];
/**
 * <p>Contains details for the restore.</p>
 * @public
 */
export interface RestoreSummary {
    /**
     * <p>The Amazon Resource Name (ARN) of the backup from which the table was restored.</p>
     * @public
     */
    SourceBackupArn?: string | undefined;
    /**
     * <p>The ARN of the source table of the backup that is being restored.</p>
     * @public
     */
    SourceTableArn?: string | undefined;
    /**
     * <p>Point in time or source backup time.</p>
     * @public
     */
    RestoreDateTime: Date | undefined;
    /**
     * <p>Indicates if a restore is in progress or not.</p>
     * @public
     */
    RestoreInProgress: boolean | undefined;
}
/**
 * <p>Represents the properties of a table.</p>
 * @public
 */
export interface TableDescription {
    /**
     * <p>An array of <code>AttributeDefinition</code> objects. Each of these objects describes
     *             one attribute in the table and index key schema.</p>
     *          <p>Each <code>AttributeDefinition</code> object in this array is composed of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>AttributeName</code> - The name of the attribute.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>AttributeType</code> - The data type for the attribute.</p>
     *             </li>
     *          </ul>
     * @public
     */
    AttributeDefinitions?: AttributeDefinition[] | undefined;
    /**
     * <p>The name of the table.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>The primary key structure for the table. Each <code>KeySchemaElement</code> consists
     *             of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>AttributeName</code> - The name of the attribute.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>KeyType</code> - The role of the attribute:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>HASH</code> - partition key</p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>RANGE</code> - sort key</p>
     *                   </li>
     *                </ul>
     *                <note>
     *                   <p>The partition key of an item is also known as its <i>hash
     *                             attribute</i>. The term "hash attribute" derives from DynamoDB's
     *                         usage of an internal hash function to evenly distribute data items across
     *                         partitions, based on their partition key values.</p>
     *                   <p>The sort key of an item is also known as its <i>range
     *                             attribute</i>. The term "range attribute" derives from the way
     *                         DynamoDB stores items with the same partition key physically close together,
     *                         in sorted order by the sort key value.</p>
     *                </note>
     *             </li>
     *          </ul>
     *          <p>For more information about primary keys, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DataModel.html#DataModelPrimaryKey">Primary Key</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    KeySchema?: KeySchemaElement[] | undefined;
    /**
     * <p>The current state of the table:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>CREATING</code> - The table is being created.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATING</code> - The table/index configuration is being updated. The
     *                     table/index remains available for data operations when
     *                     <code>UPDATING</code>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETING</code> - The table is being deleted.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ACTIVE</code> - The table is ready for use.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>INACCESSIBLE_ENCRYPTION_CREDENTIALS</code> - The KMS key
     *                     used to encrypt the table in inaccessible. Table operations may fail due to
     *                     failure to use the KMS key. DynamoDB will initiate the
     *                     table archival process when a table's KMS key remains
     *                     inaccessible for more than seven days. </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ARCHIVING</code> - The table is being archived. Operations are not allowed
     *                     until archival is complete. </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ARCHIVED</code> - The table has been archived. See the ArchivalReason for
     *                     more information. </p>
     *             </li>
     *          </ul>
     * @public
     */
    TableStatus?: TableStatus | undefined;
    /**
     * <p>The date and time when the table was created, in <a href="http://www.epochconverter.com/">UNIX epoch time</a> format.</p>
     * @public
     */
    CreationDateTime?: Date | undefined;
    /**
     * <p>The provisioned throughput settings for the table, consisting of read and write
     *             capacity units, along with data about increases and decreases.</p>
     * @public
     */
    ProvisionedThroughput?: ProvisionedThroughputDescription | undefined;
    /**
     * <p>The total size of the specified table, in bytes. DynamoDB updates this value
     *             approximately every six hours. Recent changes might not be reflected in this
     *             value.</p>
     * @public
     */
    TableSizeBytes?: number | undefined;
    /**
     * <p>The number of items in the specified table. DynamoDB updates this value approximately
     *             every six hours. Recent changes might not be reflected in this value.</p>
     * @public
     */
    ItemCount?: number | undefined;
    /**
     * <p>The Amazon Resource Name (ARN) that uniquely identifies the table.</p>
     * @public
     */
    TableArn?: string | undefined;
    /**
     * <p>Unique identifier for the table for which the backup was created. </p>
     * @public
     */
    TableId?: string | undefined;
    /**
     * <p>Contains the details for the read/write capacity mode.</p>
     * @public
     */
    BillingModeSummary?: BillingModeSummary | undefined;
    /**
     * <p>Represents one or more local secondary indexes on the table. Each index is scoped to a
     *             given partition key value. Tables with one or more local secondary indexes are subject
     *             to an item collection size limit, where the amount of data within a given item
     *             collection cannot exceed 10 GB. Each element is composed of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>IndexName</code> - The name of the local secondary index.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>KeySchema</code> - Specifies the complete index key schema. The attribute
     *                     names in the key schema must be between 1 and 255 characters (inclusive). The
     *                     key schema must begin with the same partition key as the table.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>Projection</code> - Specifies attributes that are copied (projected) from
     *                     the table into the index. These are in addition to the primary key attributes
     *                     and index key attributes, which are automatically projected. Each attribute
     *                     specification is composed of:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>ProjectionType</code> - One of the following:</p>
     *                      <ul>
     *                         <li>
     *                            <p>
     *                               <code>KEYS_ONLY</code> - Only the index and primary keys are
     *                                     projected into the index.</p>
     *                         </li>
     *                         <li>
     *                            <p>
     *                               <code>INCLUDE</code> - Only the specified table attributes are
     *                                     projected into the index. The list of projected attributes is in
     *                                         <code>NonKeyAttributes</code>.</p>
     *                         </li>
     *                         <li>
     *                            <p>
     *                               <code>ALL</code> - All of the table attributes are projected
     *                                     into the index.</p>
     *                         </li>
     *                      </ul>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>NonKeyAttributes</code> - A list of one or more non-key attribute
     *                             names that are projected into the secondary index. The total count of
     *                             attributes provided in <code>NonKeyAttributes</code>, summed across all
     *                             of the secondary indexes, must not exceed 100. If you project the same
     *                             attribute into two different indexes, this counts as two distinct
     *                             attributes when determining the total. This limit only applies when you
     *                             specify the ProjectionType of <code>INCLUDE</code>. You still can
     *                             specify the ProjectionType of <code>ALL</code> to project all attributes
     *                             from the source table, even if the table has more than 100
     *                             attributes.</p>
     *                   </li>
     *                </ul>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>IndexSizeBytes</code> - Represents the total size of the index, in bytes.
     *                     DynamoDB updates this value approximately every six hours. Recent changes might
     *                     not be reflected in this value.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ItemCount</code> - Represents the number of items in the index. DynamoDB
     *                     updates this value approximately every six hours. Recent changes might not be
     *                     reflected in this value.</p>
     *             </li>
     *          </ul>
     *          <p>If the table is in the <code>DELETING</code> state, no information about indexes will
     *             be returned.</p>
     * @public
     */
    LocalSecondaryIndexes?: LocalSecondaryIndexDescription[] | undefined;
    /**
     * <p>The global secondary indexes, if any, on the table. Each index is scoped to a given
     *             partition key value. Each element is composed of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Backfilling</code> - If true, then the index is currently in the
     *                     backfilling phase. Backfilling occurs only when a new global secondary index is
     *                     added to the table. It is the process by which DynamoDB populates the new index
     *                     with data from the table. (This attribute does not appear for indexes that were
     *                     created during a <code>CreateTable</code> operation.) </p>
     *                <p> You can delete an index that is being created during the
     *                         <code>Backfilling</code> phase when <code>IndexStatus</code> is set to
     *                     CREATING and <code>Backfilling</code> is true. You can't delete the index that
     *                     is being created when <code>IndexStatus</code> is set to CREATING and
     *                         <code>Backfilling</code> is false. (This attribute does not appear for
     *                     indexes that were created during a <code>CreateTable</code> operation.)</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>IndexName</code> - The name of the global secondary index.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>IndexSizeBytes</code> - The total size of the global secondary index, in
     *                     bytes. DynamoDB updates this value approximately every six hours. Recent changes
     *                     might not be reflected in this value. </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>IndexStatus</code> - The current status of the global secondary
     *                     index:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>CREATING</code> - The index is being created.</p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>UPDATING</code> - The index is being updated.</p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>DELETING</code> - The index is being deleted.</p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>ACTIVE</code> - The index is ready for use.</p>
     *                   </li>
     *                </ul>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ItemCount</code> - The number of items in the global secondary index.
     *                     DynamoDB updates this value approximately every six hours. Recent changes might
     *                     not be reflected in this value. </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>KeySchema</code> - Specifies the complete index key schema. The attribute
     *                     names in the key schema must be between 1 and 255 characters (inclusive). The
     *                     key schema must begin with the same partition key as the table.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>Projection</code> - Specifies attributes that are copied (projected) from
     *                     the table into the index. These are in addition to the primary key attributes
     *                     and index key attributes, which are automatically projected. Each attribute
     *                     specification is composed of:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>ProjectionType</code> - One of the following:</p>
     *                      <ul>
     *                         <li>
     *                            <p>
     *                               <code>KEYS_ONLY</code> - Only the index and primary keys are
     *                                     projected into the index.</p>
     *                         </li>
     *                         <li>
     *                            <p>
     *                               <code>INCLUDE</code> - In addition to the attributes described
     *                                     in <code>KEYS_ONLY</code>, the secondary index will include
     *                                     other non-key attributes that you specify.</p>
     *                         </li>
     *                         <li>
     *                            <p>
     *                               <code>ALL</code> - All of the table attributes are projected
     *                                     into the index.</p>
     *                         </li>
     *                      </ul>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>NonKeyAttributes</code> - A list of one or more non-key attribute
     *                             names that are projected into the secondary index. The total count of
     *                             attributes provided in <code>NonKeyAttributes</code>, summed across all
     *                             of the secondary indexes, must not exceed 100. If you project the same
     *                             attribute into two different indexes, this counts as two distinct
     *                             attributes when determining the total. This limit only applies when you
     *                             specify the ProjectionType of <code>INCLUDE</code>. You still can
     *                             specify the ProjectionType of <code>ALL</code> to project all attributes
     *                             from the source table, even if the table has more than 100
     *                             attributes.</p>
     *                   </li>
     *                </ul>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ProvisionedThroughput</code> - The provisioned throughput settings for the
     *                     global secondary index, consisting of read and write capacity units, along with
     *                     data about increases and decreases. </p>
     *             </li>
     *          </ul>
     *          <p>If the table is in the <code>DELETING</code> state, no information about indexes will
     *             be returned.</p>
     * @public
     */
    GlobalSecondaryIndexes?: GlobalSecondaryIndexDescription[] | undefined;
    /**
     * <p>The current DynamoDB Streams configuration for the table.</p>
     * @public
     */
    StreamSpecification?: StreamSpecification | undefined;
    /**
     * <p>A timestamp, in ISO 8601 format, for this stream.</p>
     *          <p>Note that <code>LatestStreamLabel</code> is not a unique identifier for the stream,
     *             because it is possible that a stream from another table might have the same timestamp.
     *             However, the combination of the following three elements is guaranteed to be
     *             unique:</p>
     *          <ul>
     *             <li>
     *                <p>Amazon Web Services customer ID</p>
     *             </li>
     *             <li>
     *                <p>Table name</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>StreamLabel</code>
     *                </p>
     *             </li>
     *          </ul>
     * @public
     */
    LatestStreamLabel?: string | undefined;
    /**
     * <p>The Amazon Resource Name (ARN) that uniquely identifies the latest stream for this
     *             table.</p>
     * @public
     */
    LatestStreamArn?: string | undefined;
    /**
     * <p>Represents the version of <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html">global tables</a>
     *             in use, if the table is replicated across Amazon Web Services Regions.</p>
     * @public
     */
    GlobalTableVersion?: string | undefined;
    /**
     * <p>Represents replicas of the table.</p>
     * @public
     */
    Replicas?: ReplicaDescription[] | undefined;
    /**
     * <p>The witness Region and its current status in the MRSC global table. Only one witness
     *             Region can be configured per MRSC global table.</p>
     * @public
     */
    GlobalTableWitnesses?: GlobalTableWitnessDescription[] | undefined;
    /**
     * <p>Contains details for the restore.</p>
     * @public
     */
    RestoreSummary?: RestoreSummary | undefined;
    /**
     * <p>The description of the server-side encryption status on the specified table.</p>
     * @public
     */
    SSEDescription?: SSEDescription | undefined;
    /**
     * <p>Contains information about the table archive.</p>
     * @public
     */
    ArchivalSummary?: ArchivalSummary | undefined;
    /**
     * <p>Contains details of the table class.</p>
     * @public
     */
    TableClassSummary?: TableClassSummary | undefined;
    /**
     * <p>Indicates whether deletion protection is enabled (true) or disabled (false) on the
     *             table.</p>
     * @public
     */
    DeletionProtectionEnabled?: boolean | undefined;
    /**
     * <p>The maximum number of read and write units for the specified on-demand table. If you
     *             use this parameter, you must specify <code>MaxReadRequestUnits</code>,
     *                 <code>MaxWriteRequestUnits</code>, or both.</p>
     * @public
     */
    OnDemandThroughput?: OnDemandThroughput | undefined;
    /**
     * <p>Describes the warm throughput value of the base table.</p>
     * @public
     */
    WarmThroughput?: TableWarmThroughputDescription | undefined;
    /**
     * <p>Indicates one of the following consistency modes for a global table:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>EVENTUAL</code>: Indicates that the global table is configured for
     *                     multi-Region eventual consistency (MREC).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>STRONG</code>: Indicates that the global table is configured for
     *                     multi-Region strong consistency (MRSC).</p>
     *             </li>
     *          </ul>
     *          <p>If you don't specify this field, the global table consistency mode defaults to
     *                 <code>EVENTUAL</code>. For more information about global tables consistency modes,
     *             see <a href="https://docs.aws.amazon.com/V2globaltables_HowItWorks.html#V2globaltables_HowItWorks.consistency-modes">
     *                 Consistency modes</a> in DynamoDB developer guide. </p>
     * @public
     */
    MultiRegionConsistency?: MultiRegionConsistency | undefined;
}
/**
 * <p>Represents the output of a <code>CreateTable</code> operation.</p>
 * @public
 */
export interface CreateTableOutput {
    /**
     * <p>Represents the properties of the table.</p>
     * @public
     */
    TableDescription?: TableDescription | undefined;
}
/**
 * <p>The operation conflicts with the resource's availability. For example:</p>
 *          <ul>
 *             <li>
 *                <p>You attempted to recreate an existing table.</p>
 *             </li>
 *             <li>
 *                <p>You tried to delete a table currently in the <code>CREATING</code>
 *                     state.</p>
 *             </li>
 *             <li>
 *                <p>You tried to update a resource that was already being updated.</p>
 *             </li>
 *          </ul>
 *          <p>When appropriate, wait for the ongoing update to complete and attempt the request
 *             again.</p>
 * @public
 */
export declare class ResourceInUseException extends __BaseException {
    readonly name: "ResourceInUseException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ResourceInUseException, __BaseException>);
}
/**
 * <p> Processing options for the CSV file being imported. </p>
 * @public
 */
export interface CsvOptions {
    /**
     * <p> The delimiter used for separating items in the CSV file being imported. </p>
     * @public
     */
    Delimiter?: string | undefined;
    /**
     * <p> List of the headers used to specify a common header for all source CSV files being
     *             imported. If this field is specified then the first line of each CSV file is treated as
     *             data instead of the header. If this field is not specified the the first line of each
     *             CSV file is treated as the header. </p>
     * @public
     */
    HeaderList?: string[] | undefined;
}
/**
 * @public
 */
export interface DeleteBackupInput {
    /**
     * <p>The ARN associated with the backup.</p>
     * @public
     */
    BackupArn: string | undefined;
}
/**
 * @public
 */
export interface DeleteBackupOutput {
    /**
     * <p>Contains the description of the backup created for the table.</p>
     * @public
     */
    BackupDescription?: BackupDescription | undefined;
}
/**
 * <p>Represents a global secondary index to be deleted from an existing table.</p>
 * @public
 */
export interface DeleteGlobalSecondaryIndexAction {
    /**
     * <p>The name of the global secondary index to be deleted.</p>
     * @public
     */
    IndexName: string | undefined;
}
/**
 * <p>Specifies the action to remove a witness Region from a MRSC global table. You cannot
 *             delete a single witness from a MRSC global table - you must delete both a replica and
 *             the witness together. The deletion of both a witness and replica converts the remaining
 *             replica to a single-Region DynamoDB table. </p>
 * @public
 */
export interface DeleteGlobalTableWitnessGroupMemberAction {
    /**
     * <p>The witness Region name to be removed from the MRSC global table.</p>
     * @public
     */
    RegionName: string | undefined;
}
/**
 * @public
 * @enum
 */
export declare const ReturnValue: {
    readonly ALL_NEW: "ALL_NEW";
    readonly ALL_OLD: "ALL_OLD";
    readonly NONE: "NONE";
    readonly UPDATED_NEW: "UPDATED_NEW";
    readonly UPDATED_OLD: "UPDATED_OLD";
};
/**
 * @public
 */
export type ReturnValue = (typeof ReturnValue)[keyof typeof ReturnValue];
/**
 * <p>Operation was rejected because there is an ongoing transaction for the
 *             item.</p>
 * @public
 */
export declare class TransactionConflictException extends __BaseException {
    readonly name: "TransactionConflictException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<TransactionConflictException, __BaseException>);
}
/**
 * <p>Represents a replica to be removed.</p>
 * @public
 */
export interface DeleteReplicaAction {
    /**
     * <p>The Region of the replica to be removed.</p>
     * @public
     */
    RegionName: string | undefined;
}
/**
 * <p>Represents a replica to be deleted.</p>
 * @public
 */
export interface DeleteReplicationGroupMemberAction {
    /**
     * <p>The Region where the replica exists.</p>
     * @public
     */
    RegionName: string | undefined;
}
/**
 * @public
 */
export interface DeleteResourcePolicyInput {
    /**
     * <p>The Amazon Resource Name (ARN) of the DynamoDB resource from which the policy will be
     *             removed. The resources you can specify include tables and streams. If you remove the
     *             policy of a table, it will also remove the permissions for the table's indexes defined
     *             in that policy document. This is because index permissions are defined in the table's
     *             policy.</p>
     * @public
     */
    ResourceArn: string | undefined;
    /**
     * <p>A string value that you can use to conditionally delete your policy. When you provide
     *             an expected revision ID, if the revision ID of the existing policy on the resource
     *             doesn't match or if there's no policy attached to the resource, the request will fail
     *             and return a <code>PolicyNotFoundException</code>.</p>
     * @public
     */
    ExpectedRevisionId?: string | undefined;
}
/**
 * @public
 */
export interface DeleteResourcePolicyOutput {
    /**
     * <p>A unique string that represents the revision ID of the policy. If you're comparing revision IDs, make sure to always use string comparison logic.</p>
     *          <p>This value will be empty if you make a request against a resource without a
     *             policy.</p>
     * @public
     */
    RevisionId?: string | undefined;
}
/**
 * <p>The operation tried to access a nonexistent resource-based policy.</p>
 *          <p>If you specified an <code>ExpectedRevisionId</code>, it's possible that a policy is
 *             present for the resource but its revision ID didn't match the expected value.</p>
 * @public
 */
export declare class PolicyNotFoundException extends __BaseException {
    readonly name: "PolicyNotFoundException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<PolicyNotFoundException, __BaseException>);
}
/**
 * <p>Represents the input of a <code>DeleteTable</code> operation.</p>
 * @public
 */
export interface DeleteTableInput {
    /**
     * <p>The name of the table to delete. You can also provide the Amazon Resource Name (ARN) of the table in
     *             this parameter.</p>
     * @public
     */
    TableName: string | undefined;
}
/**
 * <p>Represents the output of a <code>DeleteTable</code> operation.</p>
 * @public
 */
export interface DeleteTableOutput {
    /**
     * <p>Represents the properties of a table.</p>
     * @public
     */
    TableDescription?: TableDescription | undefined;
}
/**
 * @public
 */
export interface DescribeBackupInput {
    /**
     * <p>The Amazon Resource Name (ARN) associated with the backup.</p>
     * @public
     */
    BackupArn: string | undefined;
}
/**
 * @public
 */
export interface DescribeBackupOutput {
    /**
     * <p>Contains the description of the backup created for the table.</p>
     * @public
     */
    BackupDescription?: BackupDescription | undefined;
}
/**
 * @public
 */
export interface DescribeContinuousBackupsInput {
    /**
     * <p>Name of the table for which the customer wants to check the continuous backups and
     *             point in time recovery settings.</p>
     *          <p>You can also provide the Amazon Resource Name (ARN) of the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
}
/**
 * @public
 */
export interface DescribeContinuousBackupsOutput {
    /**
     * <p>Represents the continuous backups and point in time recovery settings on the
     *             table.</p>
     * @public
     */
    ContinuousBackupsDescription?: ContinuousBackupsDescription | undefined;
}
/**
 * @public
 */
export interface DescribeContributorInsightsInput {
    /**
     * <p>The name of the table to describe. You can also provide the Amazon Resource Name (ARN) of the table in
     *             this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>The name of the global secondary index to describe, if applicable.</p>
     * @public
     */
    IndexName?: string | undefined;
}
/**
 * <p>Represents a failure a contributor insights operation.</p>
 * @public
 */
export interface FailureException {
    /**
     * <p>Exception name.</p>
     * @public
     */
    ExceptionName?: string | undefined;
    /**
     * <p>Description of the failure.</p>
     * @public
     */
    ExceptionDescription?: string | undefined;
}
/**
 * @public
 */
export interface DescribeContributorInsightsOutput {
    /**
     * <p>The name of the table being described.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>The name of the global secondary index being described.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>List of names of the associated contributor insights rules.</p>
     * @public
     */
    ContributorInsightsRuleList?: string[] | undefined;
    /**
     * <p>Current status of contributor insights.</p>
     * @public
     */
    ContributorInsightsStatus?: ContributorInsightsStatus | undefined;
    /**
     * <p>Timestamp of the last time the status was changed.</p>
     * @public
     */
    LastUpdateDateTime?: Date | undefined;
    /**
     * <p>Returns information about the last failure that was encountered.</p>
     *          <p>The most common exceptions for a FAILED status are:</p>
     *          <ul>
     *             <li>
     *                <p>LimitExceededException - Per-account Amazon CloudWatch Contributor Insights
     *                     rule limit reached. Please disable Contributor Insights for other tables/indexes
     *                     OR disable Contributor Insights rules before retrying.</p>
     *             </li>
     *             <li>
     *                <p>AccessDeniedException - Amazon CloudWatch Contributor Insights rules cannot be
     *                     modified due to insufficient permissions.</p>
     *             </li>
     *             <li>
     *                <p>AccessDeniedException - Failed to create service-linked role for Contributor
     *                     Insights due to insufficient permissions.</p>
     *             </li>
     *             <li>
     *                <p>InternalServerError - Failed to create Amazon CloudWatch Contributor Insights
     *                     rules. Please retry request.</p>
     *             </li>
     *          </ul>
     * @public
     */
    FailureException?: FailureException | undefined;
    /**
     * <p>The mode of CloudWatch Contributor Insights for DynamoDB that determines
     *             which events are emitted. Can be set to track all access and throttled events or throttled
     *             events only.</p>
     * @public
     */
    ContributorInsightsMode?: ContributorInsightsMode | undefined;
}
/**
 * @public
 */
export interface DescribeEndpointsRequest {
}
/**
 * <p>An endpoint information details.</p>
 * @public
 */
export interface Endpoint {
    /**
     * <p>IP address of the endpoint.</p>
     * @public
     */
    Address: string | undefined;
    /**
     * <p>Endpoint cache time to live (TTL) value.</p>
     * @public
     */
    CachePeriodInMinutes: number | undefined;
}
/**
 * @public
 */
export interface DescribeEndpointsResponse {
    /**
     * <p>List of endpoints.</p>
     * @public
     */
    Endpoints: Endpoint[] | undefined;
}
/**
 * @public
 */
export interface DescribeExportInput {
    /**
     * <p>The Amazon Resource Name (ARN) associated with the export.</p>
     * @public
     */
    ExportArn: string | undefined;
}
/**
 * @public
 * @enum
 */
export declare const ExportFormat: {
    readonly DYNAMODB_JSON: "DYNAMODB_JSON";
    readonly ION: "ION";
};
/**
 * @public
 */
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];
/**
 * @public
 * @enum
 */
export declare const ExportStatus: {
    readonly COMPLETED: "COMPLETED";
    readonly FAILED: "FAILED";
    readonly IN_PROGRESS: "IN_PROGRESS";
};
/**
 * @public
 */
export type ExportStatus = (typeof ExportStatus)[keyof typeof ExportStatus];
/**
 * @public
 * @enum
 */
export declare const ExportType: {
    readonly FULL_EXPORT: "FULL_EXPORT";
    readonly INCREMENTAL_EXPORT: "INCREMENTAL_EXPORT";
};
/**
 * @public
 */
export type ExportType = (typeof ExportType)[keyof typeof ExportType];
/**
 * @public
 * @enum
 */
export declare const ExportViewType: {
    readonly NEW_AND_OLD_IMAGES: "NEW_AND_OLD_IMAGES";
    readonly NEW_IMAGE: "NEW_IMAGE";
};
/**
 * @public
 */
export type ExportViewType = (typeof ExportViewType)[keyof typeof ExportViewType];
/**
 * <p>Optional object containing the parameters specific to an incremental export.</p>
 * @public
 */
export interface IncrementalExportSpecification {
    /**
     * <p>Time in the past which provides the inclusive start range for the export table's data,
     *             counted in seconds from the start of the Unix epoch. The incremental export will reflect
     *             the table's state including and after this point in time.</p>
     * @public
     */
    ExportFromTime?: Date | undefined;
    /**
     * <p>Time in the past which provides the exclusive end range for the export table's data,
     *             counted in seconds from the start of the Unix epoch. The incremental export will reflect
     *             the table's state just prior to this point in time. If this is not provided, the latest
     *             time with data available will be used.</p>
     * @public
     */
    ExportToTime?: Date | undefined;
    /**
     * <p>The view type that was chosen for the export. Valid values are
     *                 <code>NEW_AND_OLD_IMAGES</code> and <code>NEW_IMAGES</code>. The default value is
     *                 <code>NEW_AND_OLD_IMAGES</code>.</p>
     * @public
     */
    ExportViewType?: ExportViewType | undefined;
}
/**
 * @public
 * @enum
 */
export declare const S3SseAlgorithm: {
    readonly AES256: "AES256";
    readonly KMS: "KMS";
};
/**
 * @public
 */
export type S3SseAlgorithm = (typeof S3SseAlgorithm)[keyof typeof S3SseAlgorithm];
/**
 * <p>Represents the properties of the exported table.</p>
 * @public
 */
export interface ExportDescription {
    /**
     * <p>The Amazon Resource Name (ARN) of the table export.</p>
     * @public
     */
    ExportArn?: string | undefined;
    /**
     * <p>Export can be in one of the following states: IN_PROGRESS, COMPLETED, or
     *             FAILED.</p>
     * @public
     */
    ExportStatus?: ExportStatus | undefined;
    /**
     * <p>The time at which the export task began.</p>
     * @public
     */
    StartTime?: Date | undefined;
    /**
     * <p>The time at which the export task completed.</p>
     * @public
     */
    EndTime?: Date | undefined;
    /**
     * <p>The name of the manifest file for the export task.</p>
     * @public
     */
    ExportManifest?: string | undefined;
    /**
     * <p>The Amazon Resource Name (ARN) of the table that was exported.</p>
     * @public
     */
    TableArn?: string | undefined;
    /**
     * <p>Unique ID of the table that was exported.</p>
     * @public
     */
    TableId?: string | undefined;
    /**
     * <p>Point in time from which table data was exported.</p>
     * @public
     */
    ExportTime?: Date | undefined;
    /**
     * <p>The client token that was provided for the export task. A client token makes calls to
     *                 <code>ExportTableToPointInTimeInput</code> idempotent, meaning that multiple
     *             identical calls have the same effect as one single call.</p>
     * @public
     */
    ClientToken?: string | undefined;
    /**
     * <p>The name of the Amazon S3 bucket containing the export.</p>
     * @public
     */
    S3Bucket?: string | undefined;
    /**
     * <p>The ID of the Amazon Web Services account that owns the bucket containing the
     *             export.</p>
     * @public
     */
    S3BucketOwner?: string | undefined;
    /**
     * <p>The Amazon S3 bucket prefix used as the file name and path of the exported
     *             snapshot.</p>
     * @public
     */
    S3Prefix?: string | undefined;
    /**
     * <p>Type of encryption used on the bucket where export data is stored. Valid values for
     *                 <code>S3SseAlgorithm</code> are:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>AES256</code> - server-side encryption with Amazon S3 managed
     *                     keys</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>KMS</code> - server-side encryption with KMS managed
     *                     keys</p>
     *             </li>
     *          </ul>
     * @public
     */
    S3SseAlgorithm?: S3SseAlgorithm | undefined;
    /**
     * <p>The ID of the KMS managed key used to encrypt the S3 bucket where
     *             export data is stored (if applicable).</p>
     * @public
     */
    S3SseKmsKeyId?: string | undefined;
    /**
     * <p>Status code for the result of the failed export.</p>
     * @public
     */
    FailureCode?: string | undefined;
    /**
     * <p>Export failure reason description.</p>
     * @public
     */
    FailureMessage?: string | undefined;
    /**
     * <p>The format of the exported data. Valid values for <code>ExportFormat</code> are
     *                 <code>DYNAMODB_JSON</code> or <code>ION</code>.</p>
     * @public
     */
    ExportFormat?: ExportFormat | undefined;
    /**
     * <p>The billable size of the table export.</p>
     * @public
     */
    BilledSizeBytes?: number | undefined;
    /**
     * <p>The number of items exported.</p>
     * @public
     */
    ItemCount?: number | undefined;
    /**
     * <p>The type of export that was performed. Valid values are <code>FULL_EXPORT</code> or
     *                 <code>INCREMENTAL_EXPORT</code>.</p>
     * @public
     */
    ExportType?: ExportType | undefined;
    /**
     * <p>Optional object containing the parameters specific to an incremental export.</p>
     * @public
     */
    IncrementalExportSpecification?: IncrementalExportSpecification | undefined;
}
/**
 * @public
 */
export interface DescribeExportOutput {
    /**
     * <p>Represents the properties of the export.</p>
     * @public
     */
    ExportDescription?: ExportDescription | undefined;
}
/**
 * <p>The specified export was not found.</p>
 * @public
 */
export declare class ExportNotFoundException extends __BaseException {
    readonly name: "ExportNotFoundException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ExportNotFoundException, __BaseException>);
}
/**
 * @public
 */
export interface DescribeGlobalTableInput {
    /**
     * <p>The name of the global table.</p>
     * @public
     */
    GlobalTableName: string | undefined;
}
/**
 * @public
 */
export interface DescribeGlobalTableOutput {
    /**
     * <p>Contains the details of the global table.</p>
     * @public
     */
    GlobalTableDescription?: GlobalTableDescription | undefined;
}
/**
 * <p>The specified global table does not exist.</p>
 * @public
 */
export declare class GlobalTableNotFoundException extends __BaseException {
    readonly name: "GlobalTableNotFoundException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<GlobalTableNotFoundException, __BaseException>);
}
/**
 * @public
 */
export interface DescribeGlobalTableSettingsInput {
    /**
     * <p>The name of the global table to describe.</p>
     * @public
     */
    GlobalTableName: string | undefined;
}
/**
 * <p>Represents the properties of a global secondary index.</p>
 * @public
 */
export interface ReplicaGlobalSecondaryIndexSettingsDescription {
    /**
     * <p>The name of the global secondary index. The name must be unique among all other
     *             indexes on this table.</p>
     * @public
     */
    IndexName: string | undefined;
    /**
     * <p> The current status of the global secondary index:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>CREATING</code> - The global secondary index is being created.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATING</code> - The global secondary index is being updated.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETING</code> - The global secondary index is being deleted.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ACTIVE</code> - The global secondary index is ready for use.</p>
     *             </li>
     *          </ul>
     * @public
     */
    IndexStatus?: IndexStatus | undefined;
    /**
     * <p>The maximum number of strongly consistent reads consumed per second before DynamoDB
     *             returns a <code>ThrottlingException</code>.</p>
     * @public
     */
    ProvisionedReadCapacityUnits?: number | undefined;
    /**
     * <p>Auto scaling settings for a global secondary index replica's read capacity
     *             units.</p>
     * @public
     */
    ProvisionedReadCapacityAutoScalingSettings?: AutoScalingSettingsDescription | undefined;
    /**
     * <p>The maximum number of writes consumed per second before DynamoDB returns a
     *                 <code>ThrottlingException</code>.</p>
     * @public
     */
    ProvisionedWriteCapacityUnits?: number | undefined;
    /**
     * <p>Auto scaling settings for a global secondary index replica's write capacity
     *             units.</p>
     * @public
     */
    ProvisionedWriteCapacityAutoScalingSettings?: AutoScalingSettingsDescription | undefined;
}
/**
 * <p>Represents the properties of a replica.</p>
 * @public
 */
export interface ReplicaSettingsDescription {
    /**
     * <p>The Region name of the replica.</p>
     * @public
     */
    RegionName: string | undefined;
    /**
     * <p>The current state of the Region:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>CREATING</code> - The Region is being created.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATING</code> - The Region is being updated.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETING</code> - The Region is being deleted.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ACTIVE</code> - The Region is ready for use.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReplicaStatus?: ReplicaStatus | undefined;
    /**
     * <p>The read/write capacity mode of the replica.</p>
     * @public
     */
    ReplicaBillingModeSummary?: BillingModeSummary | undefined;
    /**
     * <p>The maximum number of strongly consistent reads consumed per second before DynamoDB
     *             returns a <code>ThrottlingException</code>. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithTables.html#ProvisionedThroughput">Specifying Read and Write Requirements</a> in the <i>Amazon DynamoDB
     *                 Developer Guide</i>. </p>
     * @public
     */
    ReplicaProvisionedReadCapacityUnits?: number | undefined;
    /**
     * <p>Auto scaling settings for a global table replica's read capacity units.</p>
     * @public
     */
    ReplicaProvisionedReadCapacityAutoScalingSettings?: AutoScalingSettingsDescription | undefined;
    /**
     * <p>The maximum number of writes consumed per second before DynamoDB returns a
     *                 <code>ThrottlingException</code>. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithTables.html#ProvisionedThroughput">Specifying Read and Write Requirements</a> in the <i>Amazon DynamoDB
     *                 Developer Guide</i>.</p>
     * @public
     */
    ReplicaProvisionedWriteCapacityUnits?: number | undefined;
    /**
     * <p>Auto scaling settings for a global table replica's write capacity units.</p>
     * @public
     */
    ReplicaProvisionedWriteCapacityAutoScalingSettings?: AutoScalingSettingsDescription | undefined;
    /**
     * <p>Replica global secondary index settings for the global table.</p>
     * @public
     */
    ReplicaGlobalSecondaryIndexSettings?: ReplicaGlobalSecondaryIndexSettingsDescription[] | undefined;
    /**
     * <p>Contains details of the table class.</p>
     * @public
     */
    ReplicaTableClassSummary?: TableClassSummary | undefined;
}
/**
 * @public
 */
export interface DescribeGlobalTableSettingsOutput {
    /**
     * <p>The name of the global table.</p>
     * @public
     */
    GlobalTableName?: string | undefined;
    /**
     * <p>The Region-specific settings for the global table.</p>
     * @public
     */
    ReplicaSettings?: ReplicaSettingsDescription[] | undefined;
}
/**
 * @public
 */
export interface DescribeImportInput {
    /**
     * <p> The Amazon Resource Name (ARN) associated with the table you're importing to. </p>
     * @public
     */
    ImportArn: string | undefined;
}
/**
 * @public
 * @enum
 */
export declare const ImportStatus: {
    readonly CANCELLED: "CANCELLED";
    readonly CANCELLING: "CANCELLING";
    readonly COMPLETED: "COMPLETED";
    readonly FAILED: "FAILED";
    readonly IN_PROGRESS: "IN_PROGRESS";
};
/**
 * @public
 */
export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];
/**
 * @public
 * @enum
 */
export declare const InputCompressionType: {
    readonly GZIP: "GZIP";
    readonly NONE: "NONE";
    readonly ZSTD: "ZSTD";
};
/**
 * @public
 */
export type InputCompressionType = (typeof InputCompressionType)[keyof typeof InputCompressionType];
/**
 * @public
 * @enum
 */
export declare const InputFormat: {
    readonly CSV: "CSV";
    readonly DYNAMODB_JSON: "DYNAMODB_JSON";
    readonly ION: "ION";
};
/**
 * @public
 */
export type InputFormat = (typeof InputFormat)[keyof typeof InputFormat];
/**
 * <p> The format options for the data that was imported into the target table. There is one
 *             value, CsvOption.</p>
 * @public
 */
export interface InputFormatOptions {
    /**
     * <p> The options for imported source files in CSV format. The values are Delimiter and
     *             HeaderList. </p>
     * @public
     */
    Csv?: CsvOptions | undefined;
}
/**
 * <p> The S3 bucket that is being imported from. </p>
 * @public
 */
export interface S3BucketSource {
    /**
     * <p> The account number of the S3 bucket that is being imported from. If the bucket is
     *             owned by the requester this is optional. </p>
     * @public
     */
    S3BucketOwner?: string | undefined;
    /**
     * <p> The S3 bucket that is being imported from. </p>
     * @public
     */
    S3Bucket: string | undefined;
    /**
     * <p> The key prefix shared by all S3 Objects that are being imported. </p>
     * @public
     */
    S3KeyPrefix?: string | undefined;
}
/**
 * <p> The parameters for the table created as part of the import operation. </p>
 * @public
 */
export interface TableCreationParameters {
    /**
     * <p> The name of the table created as part of the import operation. </p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p> The attributes of the table created as part of the import operation. </p>
     * @public
     */
    AttributeDefinitions: AttributeDefinition[] | undefined;
    /**
     * <p> The primary key and option sort key of the table created as part of the import
     *             operation. </p>
     * @public
     */
    KeySchema: KeySchemaElement[] | undefined;
    /**
     * <p> The billing mode for provisioning the table created as part of the import operation.
     *         </p>
     * @public
     */
    BillingMode?: BillingMode | undefined;
    /**
     * <p>Represents the provisioned throughput settings for the specified global secondary
     *             index. You must use <code>ProvisionedThroughput</code> or
     *                 <code>OnDemandThroughput</code> based on your table’s capacity mode.</p>
     *          <p>For current minimum and maximum provisioned throughput values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html">Service,
     *                 Account, and Table Quotas</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ProvisionedThroughput?: ProvisionedThroughput | undefined;
    /**
     * <p>Sets the maximum number of read and write units for the specified on-demand table. If
     *             you use this parameter, you must specify <code>MaxReadRequestUnits</code>,
     *                 <code>MaxWriteRequestUnits</code>, or both.</p>
     * @public
     */
    OnDemandThroughput?: OnDemandThroughput | undefined;
    /**
     * <p>Represents the settings used to enable server-side encryption.</p>
     * @public
     */
    SSESpecification?: SSESpecification | undefined;
    /**
     * <p> The Global Secondary Indexes (GSI) of the table to be created as part of the import
     *             operation. </p>
     * @public
     */
    GlobalSecondaryIndexes?: GlobalSecondaryIndex[] | undefined;
}
/**
 * <p> Represents the properties of the table being imported into.
 *             </p>
 * @public
 */
export interface ImportTableDescription {
    /**
     * <p> The Amazon Resource Number (ARN) corresponding to the import request.
     *             </p>
     * @public
     */
    ImportArn?: string | undefined;
    /**
     * <p> The status of the import. </p>
     * @public
     */
    ImportStatus?: ImportStatus | undefined;
    /**
     * <p> The Amazon Resource Number (ARN) of the table being imported into.
     *             </p>
     * @public
     */
    TableArn?: string | undefined;
    /**
     * <p> The table id corresponding to the table created by import table process.
     *             </p>
     * @public
     */
    TableId?: string | undefined;
    /**
     * <p> The client token that was provided for the import task. Reusing the client token on
     *             retry makes a call to <code>ImportTable</code> idempotent. </p>
     * @public
     */
    ClientToken?: string | undefined;
    /**
     * <p> Values for the S3 bucket the source file is imported from. Includes bucket name
     *             (required), key prefix (optional) and bucket account owner ID (optional). </p>
     * @public
     */
    S3BucketSource?: S3BucketSource | undefined;
    /**
     * <p> The number of errors occurred on importing the source file into the target table.
     *         </p>
     * @public
     */
    ErrorCount?: number | undefined;
    /**
     * <p> The Amazon Resource Number (ARN) of the Cloudwatch Log Group associated with the
     *             target table. </p>
     * @public
     */
    CloudWatchLogGroupArn?: string | undefined;
    /**
     * <p> The format of the source data going into the target table.
     *             </p>
     * @public
     */
    InputFormat?: InputFormat | undefined;
    /**
     * <p> The format options for the data that was imported into the target table. There is one
     *             value, CsvOption. </p>
     * @public
     */
    InputFormatOptions?: InputFormatOptions | undefined;
    /**
     * <p> The compression options for the data that has been imported into the target table.
     *             The values are NONE, GZIP, or ZSTD. </p>
     * @public
     */
    InputCompressionType?: InputCompressionType | undefined;
    /**
     * <p> The parameters for the new table that is being imported into. </p>
     * @public
     */
    TableCreationParameters?: TableCreationParameters | undefined;
    /**
     * <p> The time when this import task started. </p>
     * @public
     */
    StartTime?: Date | undefined;
    /**
     * <p> The time at which the creation of the table associated with this import task
     *             completed. </p>
     * @public
     */
    EndTime?: Date | undefined;
    /**
     * <p> The total size of data processed from the source file, in Bytes. </p>
     * @public
     */
    ProcessedSizeBytes?: number | undefined;
    /**
     * <p> The total number of items processed from the source file. </p>
     * @public
     */
    ProcessedItemCount?: number | undefined;
    /**
     * <p> The number of items successfully imported into the new table. </p>
     * @public
     */
    ImportedItemCount?: number | undefined;
    /**
     * <p> The error code corresponding to the failure that the import job ran into during
     *             execution. </p>
     * @public
     */
    FailureCode?: string | undefined;
    /**
     * <p> The error message corresponding to the failure that the import job ran into during
     *             execution. </p>
     * @public
     */
    FailureMessage?: string | undefined;
}
/**
 * @public
 */
export interface DescribeImportOutput {
    /**
     * <p> Represents the properties of the table created for the import, and parameters of the
     *             import. The import parameters include import status, how many items were processed, and
     *             how many errors were encountered. </p>
     * @public
     */
    ImportTableDescription: ImportTableDescription | undefined;
}
/**
 * <p> The specified import was not found. </p>
 * @public
 */
export declare class ImportNotFoundException extends __BaseException {
    readonly name: "ImportNotFoundException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ImportNotFoundException, __BaseException>);
}
/**
 * @public
 */
export interface DescribeKinesisStreamingDestinationInput {
    /**
     * <p>The name of the table being described. You can also provide the Amazon Resource Name (ARN) of the table
     *             in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
}
/**
 * @public
 * @enum
 */
export declare const DestinationStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly DISABLED: "DISABLED";
    readonly DISABLING: "DISABLING";
    readonly ENABLE_FAILED: "ENABLE_FAILED";
    readonly ENABLING: "ENABLING";
    readonly UPDATING: "UPDATING";
};
/**
 * @public
 */
export type DestinationStatus = (typeof DestinationStatus)[keyof typeof DestinationStatus];
/**
 * <p>Describes a Kinesis data stream destination.</p>
 * @public
 */
export interface KinesisDataStreamDestination {
    /**
     * <p>The ARN for a specific Kinesis data stream.</p>
     * @public
     */
    StreamArn?: string | undefined;
    /**
     * <p>The current status of replication.</p>
     * @public
     */
    DestinationStatus?: DestinationStatus | undefined;
    /**
     * <p>The human-readable string that corresponds to the replica status.</p>
     * @public
     */
    DestinationStatusDescription?: string | undefined;
    /**
     * <p>The precision of the Kinesis data stream timestamp. The values are either
     *                 <code>MILLISECOND</code> or <code>MICROSECOND</code>.</p>
     * @public
     */
    ApproximateCreationDateTimePrecision?: ApproximateCreationDateTimePrecision | undefined;
}
/**
 * @public
 */
export interface DescribeKinesisStreamingDestinationOutput {
    /**
     * <p>The name of the table being described.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>The list of replica structures for the table being described.</p>
     * @public
     */
    KinesisDataStreamDestinations?: KinesisDataStreamDestination[] | undefined;
}
/**
 * <p>Represents the input of a <code>DescribeLimits</code> operation. Has no
 *             content.</p>
 * @public
 */
export interface DescribeLimitsInput {
}
/**
 * <p>Represents the output of a <code>DescribeLimits</code> operation.</p>
 * @public
 */
export interface DescribeLimitsOutput {
    /**
     * <p>The maximum total read capacity units that your account allows you to provision across
     *             all of your tables in this Region.</p>
     * @public
     */
    AccountMaxReadCapacityUnits?: number | undefined;
    /**
     * <p>The maximum total write capacity units that your account allows you to provision
     *             across all of your tables in this Region.</p>
     * @public
     */
    AccountMaxWriteCapacityUnits?: number | undefined;
    /**
     * <p>The maximum read capacity units that your account allows you to provision for a new
     *             table that you are creating in this Region, including the read capacity units
     *             provisioned for its global secondary indexes (GSIs).</p>
     * @public
     */
    TableMaxReadCapacityUnits?: number | undefined;
    /**
     * <p>The maximum write capacity units that your account allows you to provision for a new
     *             table that you are creating in this Region, including the write capacity units
     *             provisioned for its global secondary indexes (GSIs).</p>
     * @public
     */
    TableMaxWriteCapacityUnits?: number | undefined;
}
/**
 * <p>Represents the input of a <code>DescribeTable</code> operation.</p>
 * @public
 */
export interface DescribeTableInput {
    /**
     * <p>The name of the table to describe. You can also provide the Amazon Resource Name (ARN) of the table in
     *             this parameter.</p>
     * @public
     */
    TableName: string | undefined;
}
/**
 * <p>Represents the output of a <code>DescribeTable</code> operation.</p>
 * @public
 */
export interface DescribeTableOutput {
    /**
     * <p>The properties of the table.</p>
     * @public
     */
    Table?: TableDescription | undefined;
}
/**
 * @public
 */
export interface DescribeTableReplicaAutoScalingInput {
    /**
     * <p>The name of the table. You can also provide the Amazon Resource Name (ARN) of the table in this
     *             parameter.</p>
     * @public
     */
    TableName: string | undefined;
}
/**
 * <p>Represents the auto scaling configuration for a replica global secondary index.</p>
 * @public
 */
export interface ReplicaGlobalSecondaryIndexAutoScalingDescription {
    /**
     * <p>The name of the global secondary index.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>The current state of the replica global secondary index:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>CREATING</code> - The index is being created.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATING</code> - The table/index configuration is being updated. The
     *                     table/index remains available for data operations when
     *                     <code>UPDATING</code>
     *                </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETING</code> - The index is being deleted.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ACTIVE</code> - The index is ready for use.</p>
     *             </li>
     *          </ul>
     * @public
     */
    IndexStatus?: IndexStatus | undefined;
    /**
     * <p>Represents the auto scaling settings for a global table or global secondary
     *             index.</p>
     * @public
     */
    ProvisionedReadCapacityAutoScalingSettings?: AutoScalingSettingsDescription | undefined;
    /**
     * <p>Represents the auto scaling settings for a global table or global secondary
     *             index.</p>
     * @public
     */
    ProvisionedWriteCapacityAutoScalingSettings?: AutoScalingSettingsDescription | undefined;
}
/**
 * <p>Represents the auto scaling settings of the replica.</p>
 * @public
 */
export interface ReplicaAutoScalingDescription {
    /**
     * <p>The Region where the replica exists.</p>
     * @public
     */
    RegionName?: string | undefined;
    /**
     * <p>Replica-specific global secondary index auto scaling settings.</p>
     * @public
     */
    GlobalSecondaryIndexes?: ReplicaGlobalSecondaryIndexAutoScalingDescription[] | undefined;
    /**
     * <p>Represents the auto scaling settings for a global table or global secondary
     *             index.</p>
     * @public
     */
    ReplicaProvisionedReadCapacityAutoScalingSettings?: AutoScalingSettingsDescription | undefined;
    /**
     * <p>Represents the auto scaling settings for a global table or global secondary
     *             index.</p>
     * @public
     */
    ReplicaProvisionedWriteCapacityAutoScalingSettings?: AutoScalingSettingsDescription | undefined;
    /**
     * <p>The current state of the replica:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>CREATING</code> - The replica is being created.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATING</code> - The replica is being updated.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETING</code> - The replica is being deleted.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ACTIVE</code> - The replica is ready for use.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReplicaStatus?: ReplicaStatus | undefined;
}
/**
 * <p>Represents the auto scaling configuration for a global table.</p>
 * @public
 */
export interface TableAutoScalingDescription {
    /**
     * <p>The name of the table.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>The current state of the table:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>CREATING</code> - The table is being created.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATING</code> - The table is being updated.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETING</code> - The table is being deleted.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ACTIVE</code> - The table is ready for use.</p>
     *             </li>
     *          </ul>
     * @public
     */
    TableStatus?: TableStatus | undefined;
    /**
     * <p>Represents replicas of the global table.</p>
     * @public
     */
    Replicas?: ReplicaAutoScalingDescription[] | undefined;
}
/**
 * @public
 */
export interface DescribeTableReplicaAutoScalingOutput {
    /**
     * <p>Represents the auto scaling properties of the table.</p>
     * @public
     */
    TableAutoScalingDescription?: TableAutoScalingDescription | undefined;
}
/**
 * @public
 */
export interface DescribeTimeToLiveInput {
    /**
     * <p>The name of the table to be described. You can also provide the Amazon Resource Name (ARN) of the table
     *             in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
}
/**
 * @public
 */
export interface DescribeTimeToLiveOutput {
    /**
     * <p></p>
     * @public
     */
    TimeToLiveDescription?: TimeToLiveDescription | undefined;
}
/**
 * <p>Enables setting the configuration for Kinesis Streaming.</p>
 * @public
 */
export interface EnableKinesisStreamingConfiguration {
    /**
     * <p>Toggle for the precision of Kinesis data stream timestamp. The values are either
     *                 <code>MILLISECOND</code> or <code>MICROSECOND</code>.</p>
     * @public
     */
    ApproximateCreationDateTimePrecision?: ApproximateCreationDateTimePrecision | undefined;
}
/**
 * @public
 */
export interface KinesisStreamingDestinationInput {
    /**
     * <p>The name of the DynamoDB table. You can also provide the Amazon Resource Name (ARN) of the
     *             table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>The ARN for a Kinesis data stream.</p>
     * @public
     */
    StreamArn: string | undefined;
    /**
     * <p>The source for the Kinesis streaming information that is being enabled.</p>
     * @public
     */
    EnableKinesisStreamingConfiguration?: EnableKinesisStreamingConfiguration | undefined;
}
/**
 * @public
 */
export interface KinesisStreamingDestinationOutput {
    /**
     * <p>The name of the table being modified.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>The ARN for the specific Kinesis data stream.</p>
     * @public
     */
    StreamArn?: string | undefined;
    /**
     * <p>The current status of the replication.</p>
     * @public
     */
    DestinationStatus?: DestinationStatus | undefined;
    /**
     * <p>The destination for the Kinesis streaming information that is being enabled.</p>
     * @public
     */
    EnableKinesisStreamingConfiguration?: EnableKinesisStreamingConfiguration | undefined;
}
/**
 * <p> There was an attempt to insert an item with the same primary key as an item that
 *             already exists in the DynamoDB table.</p>
 * @public
 */
export declare class DuplicateItemException extends __BaseException {
    readonly name: "DuplicateItemException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<DuplicateItemException, __BaseException>);
}
/**
 * <p>DynamoDB rejected the request because you retried a request with a
 *             different payload but with an idempotent token that was already used.</p>
 * @public
 */
export declare class IdempotentParameterMismatchException extends __BaseException {
    readonly name: "IdempotentParameterMismatchException";
    readonly $fault: "client";
    Message?: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<IdempotentParameterMismatchException, __BaseException>);
}
/**
 * <p>The transaction with the given request token is already in progress.</p>
 *          <p> Recommended Settings </p>
 *          <note>
 *             <p> This is a general recommendation for handling the
 *                     <code>TransactionInProgressException</code>. These settings help ensure that the
 *                 client retries will trigger completion of the ongoing
 *                     <code>TransactWriteItems</code> request. </p>
 *          </note>
 *          <ul>
 *             <li>
 *                <p> Set <code>clientExecutionTimeout</code> to a value that allows at least one
 *                     retry to be processed after 5 seconds have elapsed since the first attempt for
 *                     the <code>TransactWriteItems</code> operation. </p>
 *             </li>
 *             <li>
 *                <p> Set <code>socketTimeout</code> to a value a little lower than the
 *                         <code>requestTimeout</code> setting. </p>
 *             </li>
 *             <li>
 *                <p>
 *                   <code>requestTimeout</code> should be set based on the time taken for the
 *                     individual retries of a single HTTP request for your use case, but setting it to
 *                     1 second or higher should work well to reduce chances of retries and
 *                         <code>TransactionInProgressException</code> errors. </p>
 *             </li>
 *             <li>
 *                <p> Use exponential backoff when retrying and tune backoff if needed. </p>
 *             </li>
 *          </ul>
 *          <p> Assuming <a href="https://github.com/aws/aws-sdk-java/blob/fd409dee8ae23fb8953e0bb4dbde65536a7e0514/aws-java-sdk-core/src/main/java/com/amazonaws/retry/PredefinedRetryPolicies.java#L97">default retry policy</a>, example timeout settings based on the guidelines
 *             above are as follows: </p>
 *          <p>Example timeline:</p>
 *          <ul>
 *             <li>
 *                <p>0-1000 first attempt</p>
 *             </li>
 *             <li>
 *                <p>1000-1500 first sleep/delay (default retry policy uses 500 ms as base delay
 *                     for 4xx errors)</p>
 *             </li>
 *             <li>
 *                <p>1500-2500 second attempt</p>
 *             </li>
 *             <li>
 *                <p>2500-3500 second sleep/delay (500 * 2, exponential backoff)</p>
 *             </li>
 *             <li>
 *                <p>3500-4500 third attempt</p>
 *             </li>
 *             <li>
 *                <p>4500-6500 third sleep/delay (500 * 2^2)</p>
 *             </li>
 *             <li>
 *                <p>6500-7500 fourth attempt (this can trigger inline recovery since 5 seconds
 *                     have elapsed since the first attempt reached TC)</p>
 *             </li>
 *          </ul>
 * @public
 */
export declare class TransactionInProgressException extends __BaseException {
    readonly name: "TransactionInProgressException";
    readonly $fault: "client";
    Message?: string | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<TransactionInProgressException, __BaseException>);
}
/**
 * <p>There was a conflict when writing to the specified S3 bucket.</p>
 * @public
 */
export declare class ExportConflictException extends __BaseException {
    readonly name: "ExportConflictException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ExportConflictException, __BaseException>);
}
/**
 * @public
 */
export interface ExportTableToPointInTimeInput {
    /**
     * <p>The Amazon Resource Name (ARN) associated with the table to export.</p>
     * @public
     */
    TableArn: string | undefined;
    /**
     * <p>Time in the past from which to export table data, counted in seconds from the start of
     *             the Unix epoch. The table export will be a snapshot of the table's state at this point
     *             in time.</p>
     * @public
     */
    ExportTime?: Date | undefined;
    /**
     * <p>Providing a <code>ClientToken</code> makes the call to
     *                 <code>ExportTableToPointInTimeInput</code> idempotent, meaning that multiple
     *             identical calls have the same effect as one single call.</p>
     *          <p>A client token is valid for 8 hours after the first request that uses it is completed.
     *             After 8 hours, any request with the same client token is treated as a new request. Do
     *             not resubmit the same request with the same client token for more than 8 hours, or the
     *             result might not be idempotent.</p>
     *          <p>If you submit a request with the same client token but a change in other parameters
     *             within the 8-hour idempotency window, DynamoDB returns an
     *                 <code>ImportConflictException</code>.</p>
     * @public
     */
    ClientToken?: string | undefined;
    /**
     * <p>The name of the Amazon S3 bucket to export the snapshot to.</p>
     * @public
     */
    S3Bucket: string | undefined;
    /**
     * <p>The ID of the Amazon Web Services account that owns the bucket the export will be
     *             stored in.</p>
     *          <note>
     *             <p>S3BucketOwner is a required parameter when exporting to a S3 bucket in another
     *                 account.</p>
     *          </note>
     * @public
     */
    S3BucketOwner?: string | undefined;
    /**
     * <p>The Amazon S3 bucket prefix to use as the file name and path of the exported
     *             snapshot.</p>
     * @public
     */
    S3Prefix?: string | undefined;
    /**
     * <p>Type of encryption used on the bucket where export data will be stored. Valid values
     *             for <code>S3SseAlgorithm</code> are:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>AES256</code> - server-side encryption with Amazon S3 managed
     *                     keys</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>KMS</code> - server-side encryption with KMS managed
     *                     keys</p>
     *             </li>
     *          </ul>
     * @public
     */
    S3SseAlgorithm?: S3SseAlgorithm | undefined;
    /**
     * <p>The ID of the KMS managed key used to encrypt the S3 bucket where
     *             export data will be stored (if applicable).</p>
     * @public
     */
    S3SseKmsKeyId?: string | undefined;
    /**
     * <p>The format for the exported data. Valid values for <code>ExportFormat</code> are
     *                 <code>DYNAMODB_JSON</code> or <code>ION</code>.</p>
     * @public
     */
    ExportFormat?: ExportFormat | undefined;
    /**
     * <p>Choice of whether to execute as a full export or incremental export. Valid values are
     *             FULL_EXPORT or INCREMENTAL_EXPORT. The default value is FULL_EXPORT. If
     *             INCREMENTAL_EXPORT is provided, the IncrementalExportSpecification must also be
     *             used.</p>
     * @public
     */
    ExportType?: ExportType | undefined;
    /**
     * <p>Optional object containing the parameters specific to an incremental export.</p>
     * @public
     */
    IncrementalExportSpecification?: IncrementalExportSpecification | undefined;
}
/**
 * @public
 */
export interface ExportTableToPointInTimeOutput {
    /**
     * <p>Contains a description of the table export.</p>
     * @public
     */
    ExportDescription?: ExportDescription | undefined;
}
/**
 * <p>The specified <code>ExportTime</code> is outside of the point in time recovery
 *             window.</p>
 * @public
 */
export declare class InvalidExportTimeException extends __BaseException {
    readonly name: "InvalidExportTimeException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<InvalidExportTimeException, __BaseException>);
}
/**
 * <p>Point in time recovery has not yet been enabled for this source table.</p>
 * @public
 */
export declare class PointInTimeRecoveryUnavailableException extends __BaseException {
    readonly name: "PointInTimeRecoveryUnavailableException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<PointInTimeRecoveryUnavailableException, __BaseException>);
}
/**
 * @public
 */
export interface GetResourcePolicyInput {
    /**
     * <p>The Amazon Resource Name (ARN) of the DynamoDB resource to which the policy is attached. The
     *             resources you can specify include tables and streams.</p>
     * @public
     */
    ResourceArn: string | undefined;
}
/**
 * @public
 */
export interface GetResourcePolicyOutput {
    /**
     * <p>The resource-based policy document attached to the resource, which can be a table or
     *             stream, in JSON format.</p>
     * @public
     */
    Policy?: string | undefined;
    /**
     * <p>A unique string that represents the revision ID of the policy. If you're comparing revision IDs, make sure to always use string comparison logic.</p>
     * @public
     */
    RevisionId?: string | undefined;
}
/**
 * <p> There was a conflict when importing from the specified S3 source. This can occur when
 *             the current import conflicts with a previous import request that had the same client
 *             token. </p>
 * @public
 */
export declare class ImportConflictException extends __BaseException {
    readonly name: "ImportConflictException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ImportConflictException, __BaseException>);
}
/**
 * @public
 */
export interface ImportTableInput {
    /**
     * <p>Providing a <code>ClientToken</code> makes the call to <code>ImportTableInput</code>
     *             idempotent, meaning that multiple identical calls have the same effect as one single
     *             call.</p>
     *          <p>A client token is valid for 8 hours after the first request that uses it is completed.
     *             After 8 hours, any request with the same client token is treated as a new request. Do
     *             not resubmit the same request with the same client token for more than 8 hours, or the
     *             result might not be idempotent.</p>
     *          <p>If you submit a request with the same client token but a change in other parameters
     *             within the 8-hour idempotency window, DynamoDB returns an
     *                 <code>IdempotentParameterMismatch</code> exception.</p>
     * @public
     */
    ClientToken?: string | undefined;
    /**
     * <p> The S3 bucket that provides the source for the import. </p>
     * @public
     */
    S3BucketSource: S3BucketSource | undefined;
    /**
     * <p> The format of the source data. Valid values for <code>ImportFormat</code> are
     *                 <code>CSV</code>, <code>DYNAMODB_JSON</code> or <code>ION</code>. </p>
     * @public
     */
    InputFormat: InputFormat | undefined;
    /**
     * <p> Additional properties that specify how the input is formatted, </p>
     * @public
     */
    InputFormatOptions?: InputFormatOptions | undefined;
    /**
     * <p> Type of compression to be used on the input coming from the imported table. </p>
     * @public
     */
    InputCompressionType?: InputCompressionType | undefined;
    /**
     * <p>Parameters for the table to import the data into. </p>
     * @public
     */
    TableCreationParameters: TableCreationParameters | undefined;
}
/**
 * @public
 */
export interface ImportTableOutput {
    /**
     * <p> Represents the properties of the table created for the import, and parameters of the
     *             import. The import parameters include import status, how many items were processed, and
     *             how many errors were encountered. </p>
     * @public
     */
    ImportTableDescription: ImportTableDescription | undefined;
}
/**
 * @public
 */
export interface ListBackupsInput {
    /**
     * <p>Lists the backups from the table specified in <code>TableName</code>. You can also
     *             provide the Amazon Resource Name (ARN) of the table in this parameter.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>Maximum number of backups to return at once.</p>
     * @public
     */
    Limit?: number | undefined;
    /**
     * <p>Only backups created after this time are listed. <code>TimeRangeLowerBound</code> is
     *             inclusive.</p>
     * @public
     */
    TimeRangeLowerBound?: Date | undefined;
    /**
     * <p>Only backups created before this time are listed. <code>TimeRangeUpperBound</code> is
     *             exclusive. </p>
     * @public
     */
    TimeRangeUpperBound?: Date | undefined;
    /**
     * <p>
     *             <code>LastEvaluatedBackupArn</code> is the Amazon Resource Name (ARN) of the backup last
     *             evaluated when the current page of results was returned, inclusive of the current page
     *             of results. This value may be specified as the <code>ExclusiveStartBackupArn</code> of a
     *             new <code>ListBackups</code> operation in order to fetch the next page of results.
     *         </p>
     * @public
     */
    ExclusiveStartBackupArn?: string | undefined;
    /**
     * <p>The backups from the table specified by <code>BackupType</code> are listed.</p>
     *          <p>Where <code>BackupType</code> can be:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>USER</code> - On-demand backup created by you. (The default setting if no
     *                     other backup types are specified.)</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>SYSTEM</code> - On-demand backup automatically created by DynamoDB.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ALL</code> - All types of on-demand backups (USER and SYSTEM).</p>
     *             </li>
     *          </ul>
     * @public
     */
    BackupType?: BackupTypeFilter | undefined;
}
/**
 * @public
 */
export interface ListBackupsOutput {
    /**
     * <p>List of <code>BackupSummary</code> objects.</p>
     * @public
     */
    BackupSummaries?: BackupSummary[] | undefined;
    /**
     * <p> The ARN of the backup last evaluated when the current page of results was returned,
     *             inclusive of the current page of results. This value may be specified as the
     *                 <code>ExclusiveStartBackupArn</code> of a new <code>ListBackups</code> operation in
     *             order to fetch the next page of results. </p>
     *          <p> If <code>LastEvaluatedBackupArn</code> is empty, then the last page of results has
     *             been processed and there are no more results to be retrieved. </p>
     *          <p> If <code>LastEvaluatedBackupArn</code> is not empty, this may or may not indicate
     *             that there is more data to be returned. All results are guaranteed to have been returned
     *             if and only if no value for <code>LastEvaluatedBackupArn</code> is returned. </p>
     * @public
     */
    LastEvaluatedBackupArn?: string | undefined;
}
/**
 * @public
 */
export interface ListContributorInsightsInput {
    /**
     * <p>The name of the table. You can also provide the Amazon Resource Name (ARN) of the table in this
     *             parameter.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>A token to for the desired page, if there is one.</p>
     * @public
     */
    NextToken?: string | undefined;
    /**
     * <p>Maximum number of results to return per page.</p>
     * @public
     */
    MaxResults?: number | undefined;
}
/**
 * @public
 */
export interface ListContributorInsightsOutput {
    /**
     * <p>A list of ContributorInsightsSummary.</p>
     * @public
     */
    ContributorInsightsSummaries?: ContributorInsightsSummary[] | undefined;
    /**
     * <p>A token to go to the next page if there is one.</p>
     * @public
     */
    NextToken?: string | undefined;
}
/**
 * @public
 */
export interface ListExportsInput {
    /**
     * <p>The Amazon Resource Name (ARN) associated with the exported table.</p>
     * @public
     */
    TableArn?: string | undefined;
    /**
     * <p>Maximum number of results to return per page.</p>
     * @public
     */
    MaxResults?: number | undefined;
    /**
     * <p>An optional string that, if supplied, must be copied from the output of a previous
     *             call to <code>ListExports</code>. When provided in this manner, the API fetches the next
     *             page of results.</p>
     * @public
     */
    NextToken?: string | undefined;
}
/**
 * <p>Summary information about an export task.</p>
 * @public
 */
export interface ExportSummary {
    /**
     * <p>The Amazon Resource Name (ARN) of the export.</p>
     * @public
     */
    ExportArn?: string | undefined;
    /**
     * <p>Export can be in one of the following states: IN_PROGRESS, COMPLETED, or
     *             FAILED.</p>
     * @public
     */
    ExportStatus?: ExportStatus | undefined;
    /**
     * <p>The type of export that was performed. Valid values are <code>FULL_EXPORT</code> or
     *                 <code>INCREMENTAL_EXPORT</code>.</p>
     * @public
     */
    ExportType?: ExportType | undefined;
}
/**
 * @public
 */
export interface ListExportsOutput {
    /**
     * <p>A list of <code>ExportSummary</code> objects.</p>
     * @public
     */
    ExportSummaries?: ExportSummary[] | undefined;
    /**
     * <p>If this value is returned, there are additional results to be displayed. To retrieve
     *             them, call <code>ListExports</code> again, with <code>NextToken</code> set to this
     *             value.</p>
     * @public
     */
    NextToken?: string | undefined;
}
/**
 * @public
 */
export interface ListGlobalTablesInput {
    /**
     * <p>The first global table name that this operation will evaluate.</p>
     * @public
     */
    ExclusiveStartGlobalTableName?: string | undefined;
    /**
     * <p>The maximum number of table names to return, if the parameter is not specified
     *             DynamoDB defaults to 100.</p>
     *          <p>If the number of global tables DynamoDB finds reaches this limit, it stops the
     *             operation and returns the table names collected up to that point, with a table name in
     *             the <code>LastEvaluatedGlobalTableName</code> to apply in a subsequent operation to the
     *                 <code>ExclusiveStartGlobalTableName</code> parameter.</p>
     * @public
     */
    Limit?: number | undefined;
    /**
     * <p>Lists the global tables in a specific Region.</p>
     * @public
     */
    RegionName?: string | undefined;
}
/**
 * <p>Represents the properties of a global table.</p>
 * @public
 */
export interface GlobalTable {
    /**
     * <p>The global table name.</p>
     * @public
     */
    GlobalTableName?: string | undefined;
    /**
     * <p>The Regions where the global table has replicas.</p>
     * @public
     */
    ReplicationGroup?: Replica[] | undefined;
}
/**
 * @public
 */
export interface ListGlobalTablesOutput {
    /**
     * <p>List of global table names.</p>
     * @public
     */
    GlobalTables?: GlobalTable[] | undefined;
    /**
     * <p>Last evaluated global table name.</p>
     * @public
     */
    LastEvaluatedGlobalTableName?: string | undefined;
}
/**
 * @public
 */
export interface ListImportsInput {
    /**
     * <p> The Amazon Resource Name (ARN) associated with the table that was imported to.
     *         </p>
     * @public
     */
    TableArn?: string | undefined;
    /**
     * <p> The number of <code>ImportSummary </code>objects returned in a single page. </p>
     * @public
     */
    PageSize?: number | undefined;
    /**
     * <p> An optional string that, if supplied, must be copied from the output of a previous
     *             call to <code>ListImports</code>. When provided in this manner, the API fetches the next
     *             page of results. </p>
     * @public
     */
    NextToken?: string | undefined;
}
/**
 * <p> Summary information about the source file for the import.
 *             </p>
 * @public
 */
export interface ImportSummary {
    /**
     * <p> The Amazon Resource Number (ARN) corresponding to the import request. </p>
     * @public
     */
    ImportArn?: string | undefined;
    /**
     * <p> The status of the import operation. </p>
     * @public
     */
    ImportStatus?: ImportStatus | undefined;
    /**
     * <p> The Amazon Resource Number (ARN) of the table being imported into. </p>
     * @public
     */
    TableArn?: string | undefined;
    /**
     * <p> The path and S3 bucket of the source file that is being imported. This includes the
     *             S3Bucket (required), S3KeyPrefix (optional) and S3BucketOwner (optional if the bucket is
     *             owned by the requester). </p>
     * @public
     */
    S3BucketSource?: S3BucketSource | undefined;
    /**
     * <p> The Amazon Resource Number (ARN) of the Cloudwatch Log Group associated with this
     *             import task. </p>
     * @public
     */
    CloudWatchLogGroupArn?: string | undefined;
    /**
     * <p> The format of the source data. Valid values are <code>CSV</code>,
     *                 <code>DYNAMODB_JSON</code> or <code>ION</code>.</p>
     * @public
     */
    InputFormat?: InputFormat | undefined;
    /**
     * <p> The time at which this import task began. </p>
     * @public
     */
    StartTime?: Date | undefined;
    /**
     * <p> The time at which this import task ended. (Does this include the successful complete
     *             creation of the table it was imported to?) </p>
     * @public
     */
    EndTime?: Date | undefined;
}
/**
 * @public
 */
export interface ListImportsOutput {
    /**
     * <p> A list of <code>ImportSummary</code> objects. </p>
     * @public
     */
    ImportSummaryList?: ImportSummary[] | undefined;
    /**
     * <p> If this value is returned, there are additional results to be displayed. To retrieve
     *             them, call <code>ListImports</code> again, with <code>NextToken</code> set to this
     *             value. </p>
     * @public
     */
    NextToken?: string | undefined;
}
/**
 * <p>Represents the input of a <code>ListTables</code> operation.</p>
 * @public
 */
export interface ListTablesInput {
    /**
     * <p>The first table name that this operation will evaluate. Use the value that was
     *             returned for <code>LastEvaluatedTableName</code> in a previous operation, so that you
     *             can obtain the next page of results.</p>
     * @public
     */
    ExclusiveStartTableName?: string | undefined;
    /**
     * <p>A maximum number of table names to return. If this parameter is not specified, the
     *             limit is 100.</p>
     * @public
     */
    Limit?: number | undefined;
}
/**
 * <p>Represents the output of a <code>ListTables</code> operation.</p>
 * @public
 */
export interface ListTablesOutput {
    /**
     * <p>The names of the tables associated with the current account at the current endpoint.
     *             The maximum size of this array is 100.</p>
     *          <p>If <code>LastEvaluatedTableName</code> also appears in the output, you can use this
     *             value as the <code>ExclusiveStartTableName</code> parameter in a subsequent
     *                 <code>ListTables</code> request and obtain the next page of results.</p>
     * @public
     */
    TableNames?: string[] | undefined;
    /**
     * <p>The name of the last table in the current page of results. Use this value as the
     *                 <code>ExclusiveStartTableName</code> in a new request to obtain the next page of
     *             results, until all the table names are returned.</p>
     *          <p>If you do not receive a <code>LastEvaluatedTableName</code> value in the response,
     *             this means that there are no more table names to be retrieved.</p>
     * @public
     */
    LastEvaluatedTableName?: string | undefined;
}
/**
 * @public
 */
export interface ListTagsOfResourceInput {
    /**
     * <p>The Amazon DynamoDB resource with tags to be listed. This value is an Amazon Resource
     *             Name (ARN).</p>
     * @public
     */
    ResourceArn: string | undefined;
    /**
     * <p>An optional string that, if supplied, must be copied from the output of a previous
     *             call to ListTagOfResource. When provided in this manner, this API fetches the next page
     *             of results.</p>
     * @public
     */
    NextToken?: string | undefined;
}
/**
 * @public
 */
export interface ListTagsOfResourceOutput {
    /**
     * <p>The tags currently associated with the Amazon DynamoDB resource.</p>
     * @public
     */
    Tags?: Tag[] | undefined;
    /**
     * <p>If this value is returned, there are additional results to be displayed. To retrieve
     *             them, call ListTagsOfResource again, with NextToken set to this value.</p>
     * @public
     */
    NextToken?: string | undefined;
}
/**
 * @public
 */
export interface PutResourcePolicyInput {
    /**
     * <p>The Amazon Resource Name (ARN) of the DynamoDB resource to which the policy will be attached.
     *             The resources you can specify include tables and streams.</p>
     *          <p>You can control index permissions using the base table's policy. To specify the same permission level for your table and its indexes, you can provide both the table and index Amazon Resource Name (ARN)s in the <code>Resource</code> field of a given <code>Statement</code> in your policy document. Alternatively, to specify different permissions for your table, indexes, or both, you can define multiple <code>Statement</code> fields in your policy document.</p>
     * @public
     */
    ResourceArn: string | undefined;
    /**
     * <p>An Amazon Web Services resource-based policy document in JSON format.</p>
     *          <ul>
     *             <li>
     *                <p>The maximum size supported for a resource-based policy document is 20 KB.
     *                         DynamoDB counts whitespaces when calculating the size of a policy
     *                     against this limit.</p>
     *             </li>
     *             <li>
     *                <p>Within a resource-based policy, if the action for a DynamoDB
     *                     service-linked role (SLR) to replicate data for a global table is denied, adding
     *                     or deleting a replica will fail with an error.</p>
     *             </li>
     *          </ul>
     *          <p>For a full list of all considerations that apply while attaching a resource-based
     *             policy, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/rbac-considerations.html">Resource-based
     *                 policy considerations</a>.</p>
     * @public
     */
    Policy: string | undefined;
    /**
     * <p>A string value that you can use to conditionally update your policy. You can provide
     *             the revision ID of your existing policy to make mutating requests against that
     *             policy.</p>
     *          <note>
     *             <p>When you provide an expected revision ID, if the revision ID of the existing
     *                 policy on the resource doesn't match or if there's no policy attached to the
     *                 resource, your request will be rejected with a
     *                 <code>PolicyNotFoundException</code>.</p>
     *          </note>
     *          <p>To conditionally attach a policy when no policy exists for the resource, specify
     *                 <code>NO_POLICY</code> for the revision ID.</p>
     * @public
     */
    ExpectedRevisionId?: string | undefined;
    /**
     * <p>Set this parameter to <code>true</code> to confirm that you want to remove your
     *             permissions to change the policy of this resource in the future.</p>
     * @public
     */
    ConfirmRemoveSelfResourceAccess?: boolean | undefined;
}
/**
 * @public
 */
export interface PutResourcePolicyOutput {
    /**
     * <p>A unique string that represents the revision ID of the policy. If you're comparing revision IDs, make sure to always use string comparison logic.</p>
     * @public
     */
    RevisionId?: string | undefined;
}
/**
 * @public
 * @enum
 */
export declare const Select: {
    readonly ALL_ATTRIBUTES: "ALL_ATTRIBUTES";
    readonly ALL_PROJECTED_ATTRIBUTES: "ALL_PROJECTED_ATTRIBUTES";
    readonly COUNT: "COUNT";
    readonly SPECIFIC_ATTRIBUTES: "SPECIFIC_ATTRIBUTES";
};
/**
 * @public
 */
export type Select = (typeof Select)[keyof typeof Select];
/**
 * @public
 */
export interface RestoreTableFromBackupInput {
    /**
     * <p>The name of the new table to which the backup must be restored.</p>
     * @public
     */
    TargetTableName: string | undefined;
    /**
     * <p>The Amazon Resource Name (ARN) associated with the backup.</p>
     * @public
     */
    BackupArn: string | undefined;
    /**
     * <p>The billing mode of the restored table.</p>
     * @public
     */
    BillingModeOverride?: BillingMode | undefined;
    /**
     * <p>List of global secondary indexes for the restored table. The indexes provided should
     *             match existing secondary indexes. You can choose to exclude some or all of the indexes
     *             at the time of restore.</p>
     * @public
     */
    GlobalSecondaryIndexOverride?: GlobalSecondaryIndex[] | undefined;
    /**
     * <p>List of local secondary indexes for the restored table. The indexes provided should
     *             match existing secondary indexes. You can choose to exclude some or all of the indexes
     *             at the time of restore.</p>
     * @public
     */
    LocalSecondaryIndexOverride?: LocalSecondaryIndex[] | undefined;
    /**
     * <p>Provisioned throughput settings for the restored table.</p>
     * @public
     */
    ProvisionedThroughputOverride?: ProvisionedThroughput | undefined;
    /**
     * <p>Sets the maximum number of read and write units for the specified on-demand table. If
     *             you use this parameter, you must specify <code>MaxReadRequestUnits</code>,
     *                 <code>MaxWriteRequestUnits</code>, or both.</p>
     * @public
     */
    OnDemandThroughputOverride?: OnDemandThroughput | undefined;
    /**
     * <p>The new server-side encryption settings for the restored table.</p>
     * @public
     */
    SSESpecificationOverride?: SSESpecification | undefined;
}
/**
 * @public
 */
export interface RestoreTableFromBackupOutput {
    /**
     * <p>The description of the table created from an existing backup.</p>
     * @public
     */
    TableDescription?: TableDescription | undefined;
}
/**
 * <p>A target table with the specified name already exists. </p>
 * @public
 */
export declare class TableAlreadyExistsException extends __BaseException {
    readonly name: "TableAlreadyExistsException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<TableAlreadyExistsException, __BaseException>);
}
/**
 * <p>An invalid restore time was specified. RestoreDateTime must be between
 *             EarliestRestorableDateTime and LatestRestorableDateTime.</p>
 * @public
 */
export declare class InvalidRestoreTimeException extends __BaseException {
    readonly name: "InvalidRestoreTimeException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<InvalidRestoreTimeException, __BaseException>);
}
/**
 * @public
 */
export interface RestoreTableToPointInTimeInput {
    /**
     * <p>The DynamoDB table that will be restored. This value is an Amazon Resource Name
     *             (ARN).</p>
     * @public
     */
    SourceTableArn?: string | undefined;
    /**
     * <p>Name of the source table that is being restored.</p>
     * @public
     */
    SourceTableName?: string | undefined;
    /**
     * <p>The name of the new table to which it must be restored to.</p>
     * @public
     */
    TargetTableName: string | undefined;
    /**
     * <p>Restore the table to the latest possible time. <code>LatestRestorableDateTime</code>
     *             is typically 5 minutes before the current time. </p>
     * @public
     */
    UseLatestRestorableTime?: boolean | undefined;
    /**
     * <p>Time in the past to restore the table to.</p>
     * @public
     */
    RestoreDateTime?: Date | undefined;
    /**
     * <p>The billing mode of the restored table.</p>
     * @public
     */
    BillingModeOverride?: BillingMode | undefined;
    /**
     * <p>List of global secondary indexes for the restored table. The indexes provided should
     *             match existing secondary indexes. You can choose to exclude some or all of the indexes
     *             at the time of restore.</p>
     * @public
     */
    GlobalSecondaryIndexOverride?: GlobalSecondaryIndex[] | undefined;
    /**
     * <p>List of local secondary indexes for the restored table. The indexes provided should
     *             match existing secondary indexes. You can choose to exclude some or all of the indexes
     *             at the time of restore.</p>
     * @public
     */
    LocalSecondaryIndexOverride?: LocalSecondaryIndex[] | undefined;
    /**
     * <p>Provisioned throughput settings for the restored table.</p>
     * @public
     */
    ProvisionedThroughputOverride?: ProvisionedThroughput | undefined;
    /**
     * <p>Sets the maximum number of read and write units for the specified on-demand table. If
     *             you use this parameter, you must specify <code>MaxReadRequestUnits</code>,
     *                 <code>MaxWriteRequestUnits</code>, or both.</p>
     * @public
     */
    OnDemandThroughputOverride?: OnDemandThroughput | undefined;
    /**
     * <p>The new server-side encryption settings for the restored table.</p>
     * @public
     */
    SSESpecificationOverride?: SSESpecification | undefined;
}
/**
 * @public
 */
export interface RestoreTableToPointInTimeOutput {
    /**
     * <p>Represents the properties of a table.</p>
     * @public
     */
    TableDescription?: TableDescription | undefined;
}
/**
 * @public
 */
export interface TagResourceInput {
    /**
     * <p>Identifies the Amazon DynamoDB resource to which tags should be added. This value is
     *             an Amazon Resource Name (ARN).</p>
     * @public
     */
    ResourceArn: string | undefined;
    /**
     * <p>The tags to be assigned to the Amazon DynamoDB resource.</p>
     * @public
     */
    Tags: Tag[] | undefined;
}
/**
 * @public
 */
export interface UntagResourceInput {
    /**
     * <p>The DynamoDB resource that the tags will be removed from. This value is an Amazon
     *             Resource Name (ARN).</p>
     * @public
     */
    ResourceArn: string | undefined;
    /**
     * <p>A list of tag keys. Existing tags of the resource whose keys are members of this list
     *             will be removed from the DynamoDB resource.</p>
     * @public
     */
    TagKeys: string[] | undefined;
}
/**
 * <p>Represents the settings used to enable point in time recovery.</p>
 * @public
 */
export interface PointInTimeRecoverySpecification {
    /**
     * <p>Indicates whether point in time recovery is enabled (true) or disabled (false) on the
     *             table.</p>
     * @public
     */
    PointInTimeRecoveryEnabled: boolean | undefined;
    /**
     * <p>The number of preceding days for which continuous backups are taken and maintained.
     *             Your table data is only recoverable to any point-in-time from within the configured
     *             recovery period. This parameter is optional. If no value is provided, the value will
     *             default to 35.</p>
     * @public
     */
    RecoveryPeriodInDays?: number | undefined;
}
/**
 * @public
 */
export interface UpdateContinuousBackupsInput {
    /**
     * <p>The name of the table. You can also provide the Amazon Resource Name (ARN) of the table in this
     *             parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>Represents the settings used to enable point in time recovery.</p>
     * @public
     */
    PointInTimeRecoverySpecification: PointInTimeRecoverySpecification | undefined;
}
/**
 * @public
 */
export interface UpdateContinuousBackupsOutput {
    /**
     * <p>Represents the continuous backups and point in time recovery settings on the
     *             table.</p>
     * @public
     */
    ContinuousBackupsDescription?: ContinuousBackupsDescription | undefined;
}
/**
 * @public
 */
export interface UpdateContributorInsightsInput {
    /**
     * <p>The name of the table. You can also provide the Amazon Resource Name (ARN) of the table in this
     *             parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>The global secondary index name, if applicable.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>Represents the contributor insights action.</p>
     * @public
     */
    ContributorInsightsAction: ContributorInsightsAction | undefined;
    /**
     * <p>Specifies whether to track all access and throttled events or throttled events only for
     *             the DynamoDB table or index.</p>
     * @public
     */
    ContributorInsightsMode?: ContributorInsightsMode | undefined;
}
/**
 * @public
 */
export interface UpdateContributorInsightsOutput {
    /**
     * <p>The name of the table.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>The name of the global secondary index, if applicable.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>The status of contributor insights</p>
     * @public
     */
    ContributorInsightsStatus?: ContributorInsightsStatus | undefined;
    /**
     * <p>The updated mode of CloudWatch Contributor Insights that determines whether to monitor
     *             all access and throttled events or to track throttled events exclusively.</p>
     * @public
     */
    ContributorInsightsMode?: ContributorInsightsMode | undefined;
}
/**
 * <p>The specified replica is already part of the global table.</p>
 * @public
 */
export declare class ReplicaAlreadyExistsException extends __BaseException {
    readonly name: "ReplicaAlreadyExistsException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ReplicaAlreadyExistsException, __BaseException>);
}
/**
 * <p>The specified replica is no longer part of the global table.</p>
 * @public
 */
export declare class ReplicaNotFoundException extends __BaseException {
    readonly name: "ReplicaNotFoundException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ReplicaNotFoundException, __BaseException>);
}
/**
 * <p>Represents one of the following:</p>
 *          <ul>
 *             <li>
 *                <p>A new replica to be added to an existing global table.</p>
 *             </li>
 *             <li>
 *                <p>New parameters for an existing replica.</p>
 *             </li>
 *             <li>
 *                <p>An existing replica to be removed from an existing global table.</p>
 *             </li>
 *          </ul>
 * @public
 */
export interface ReplicaUpdate {
    /**
     * <p>The parameters required for creating a replica on an existing global table.</p>
     * @public
     */
    Create?: CreateReplicaAction | undefined;
    /**
     * <p>The name of the existing replica to be removed.</p>
     * @public
     */
    Delete?: DeleteReplicaAction | undefined;
}
/**
 * @public
 */
export interface UpdateGlobalTableInput {
    /**
     * <p>The global table name.</p>
     * @public
     */
    GlobalTableName: string | undefined;
    /**
     * <p>A list of Regions that should be added or removed from the global table.</p>
     * @public
     */
    ReplicaUpdates: ReplicaUpdate[] | undefined;
}
/**
 * @public
 */
export interface UpdateGlobalTableOutput {
    /**
     * <p>Contains the details of the global table.</p>
     * @public
     */
    GlobalTableDescription?: GlobalTableDescription | undefined;
}
/**
 * <p>The operation tried to access a nonexistent index.</p>
 * @public
 */
export declare class IndexNotFoundException extends __BaseException {
    readonly name: "IndexNotFoundException";
    readonly $fault: "client";
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<IndexNotFoundException, __BaseException>);
}
/**
 * <p>Represents the settings of a global secondary index for a global table that will be
 *             modified.</p>
 * @public
 */
export interface GlobalTableGlobalSecondaryIndexSettingsUpdate {
    /**
     * <p>The name of the global secondary index. The name must be unique among all other
     *             indexes on this table.</p>
     * @public
     */
    IndexName: string | undefined;
    /**
     * <p>The maximum number of writes consumed per second before DynamoDB returns a
     *                 <code>ThrottlingException.</code>
     *          </p>
     * @public
     */
    ProvisionedWriteCapacityUnits?: number | undefined;
    /**
     * <p>Auto scaling settings for managing a global secondary index's write capacity
     *             units.</p>
     * @public
     */
    ProvisionedWriteCapacityAutoScalingSettingsUpdate?: AutoScalingSettingsUpdate | undefined;
}
/**
 * <p>Represents the settings of a global secondary index for a global table that will be
 *             modified.</p>
 * @public
 */
export interface ReplicaGlobalSecondaryIndexSettingsUpdate {
    /**
     * <p>The name of the global secondary index. The name must be unique among all other
     *             indexes on this table.</p>
     * @public
     */
    IndexName: string | undefined;
    /**
     * <p>The maximum number of strongly consistent reads consumed per second before DynamoDB
     *             returns a <code>ThrottlingException</code>.</p>
     * @public
     */
    ProvisionedReadCapacityUnits?: number | undefined;
    /**
     * <p>Auto scaling settings for managing a global secondary index replica's read capacity
     *             units.</p>
     * @public
     */
    ProvisionedReadCapacityAutoScalingSettingsUpdate?: AutoScalingSettingsUpdate | undefined;
}
/**
 * <p>Represents the settings for a global table in a Region that will be modified.</p>
 * @public
 */
export interface ReplicaSettingsUpdate {
    /**
     * <p>The Region of the replica to be added.</p>
     * @public
     */
    RegionName: string | undefined;
    /**
     * <p>The maximum number of strongly consistent reads consumed per second before DynamoDB
     *             returns a <code>ThrottlingException</code>. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithTables.html#ProvisionedThroughput">Specifying Read and Write Requirements</a> in the <i>Amazon DynamoDB
     *                 Developer Guide</i>. </p>
     * @public
     */
    ReplicaProvisionedReadCapacityUnits?: number | undefined;
    /**
     * <p>Auto scaling settings for managing a global table replica's read capacity
     *             units.</p>
     * @public
     */
    ReplicaProvisionedReadCapacityAutoScalingSettingsUpdate?: AutoScalingSettingsUpdate | undefined;
    /**
     * <p>Represents the settings of a global secondary index for a global table that will be
     *             modified.</p>
     * @public
     */
    ReplicaGlobalSecondaryIndexSettingsUpdate?: ReplicaGlobalSecondaryIndexSettingsUpdate[] | undefined;
    /**
     * <p>Replica-specific table class. If not specified, uses the source table's table
     *             class.</p>
     * @public
     */
    ReplicaTableClass?: TableClass | undefined;
}
/**
 * @public
 */
export interface UpdateGlobalTableSettingsInput {
    /**
     * <p>The name of the global table</p>
     * @public
     */
    GlobalTableName: string | undefined;
    /**
     * <p>The billing mode of the global table. If <code>GlobalTableBillingMode</code> is not
     *             specified, the global table defaults to <code>PROVISIONED</code> capacity billing
     *             mode.</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>PROVISIONED</code> - We recommend using <code>PROVISIONED</code> for
     *                     predictable workloads. <code>PROVISIONED</code> sets the billing mode to <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/provisioned-capacity-mode.html">Provisioned capacity mode</a>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>PAY_PER_REQUEST</code> - We recommend using <code>PAY_PER_REQUEST</code>
     *                     for unpredictable workloads. <code>PAY_PER_REQUEST</code> sets the billing mode
     *                     to <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode.html">On-demand capacity mode</a>. </p>
     *             </li>
     *          </ul>
     * @public
     */
    GlobalTableBillingMode?: BillingMode | undefined;
    /**
     * <p>The maximum number of writes consumed per second before DynamoDB returns a
     *                 <code>ThrottlingException.</code>
     *          </p>
     * @public
     */
    GlobalTableProvisionedWriteCapacityUnits?: number | undefined;
    /**
     * <p>Auto scaling settings for managing provisioned write capacity for the global
     *             table.</p>
     * @public
     */
    GlobalTableProvisionedWriteCapacityAutoScalingSettingsUpdate?: AutoScalingSettingsUpdate | undefined;
    /**
     * <p>Represents the settings of a global secondary index for a global table that will be
     *             modified.</p>
     * @public
     */
    GlobalTableGlobalSecondaryIndexSettingsUpdate?: GlobalTableGlobalSecondaryIndexSettingsUpdate[] | undefined;
    /**
     * <p>Represents the settings for a global table in a Region that will be modified.</p>
     * @public
     */
    ReplicaSettingsUpdate?: ReplicaSettingsUpdate[] | undefined;
}
/**
 * @public
 */
export interface UpdateGlobalTableSettingsOutput {
    /**
     * <p>The name of the global table.</p>
     * @public
     */
    GlobalTableName?: string | undefined;
    /**
     * <p>The Region-specific settings for the global table.</p>
     * @public
     */
    ReplicaSettings?: ReplicaSettingsDescription[] | undefined;
}
/**
 * <p>Enables updating the configuration for Kinesis Streaming.</p>
 * @public
 */
export interface UpdateKinesisStreamingConfiguration {
    /**
     * <p>Enables updating the precision of Kinesis data stream timestamp. </p>
     * @public
     */
    ApproximateCreationDateTimePrecision?: ApproximateCreationDateTimePrecision | undefined;
}
/**
 * @public
 */
export interface UpdateKinesisStreamingDestinationInput {
    /**
     * <p>The table name for the Kinesis streaming destination input. You can also provide the
     *             ARN of the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>The Amazon Resource Name (ARN) for the Kinesis stream input.</p>
     * @public
     */
    StreamArn: string | undefined;
    /**
     * <p>The command to update the Kinesis stream configuration.</p>
     * @public
     */
    UpdateKinesisStreamingConfiguration?: UpdateKinesisStreamingConfiguration | undefined;
}
/**
 * @public
 */
export interface UpdateKinesisStreamingDestinationOutput {
    /**
     * <p>The table name for the Kinesis streaming destination output.</p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p>The ARN for the Kinesis stream input.</p>
     * @public
     */
    StreamArn?: string | undefined;
    /**
     * <p>The status of the attempt to update the Kinesis streaming destination output.</p>
     * @public
     */
    DestinationStatus?: DestinationStatus | undefined;
    /**
     * <p>The command to update the Kinesis streaming destination configuration.</p>
     * @public
     */
    UpdateKinesisStreamingConfiguration?: UpdateKinesisStreamingConfiguration | undefined;
}
/**
 * <p>Represents the new provisioned throughput settings to be applied to a global secondary
 *             index.</p>
 * @public
 */
export interface UpdateGlobalSecondaryIndexAction {
    /**
     * <p>The name of the global secondary index to be updated.</p>
     * @public
     */
    IndexName: string | undefined;
    /**
     * <p>Represents the provisioned throughput settings for the specified global secondary
     *             index.</p>
     *          <p>For current minimum and maximum provisioned throughput values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html">Service,
     *                 Account, and Table Quotas</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ProvisionedThroughput?: ProvisionedThroughput | undefined;
    /**
     * <p>Updates the maximum number of read and write units for the specified global secondary
     *             index. If you use this parameter, you must specify <code>MaxReadRequestUnits</code>,
     *                 <code>MaxWriteRequestUnits</code>, or both.</p>
     * @public
     */
    OnDemandThroughput?: OnDemandThroughput | undefined;
    /**
     * <p>Represents the warm throughput value of the new provisioned throughput settings to be
     *             applied to a global secondary index.</p>
     * @public
     */
    WarmThroughput?: WarmThroughput | undefined;
}
/**
 * <p>Represents one of the following:</p>
 *          <ul>
 *             <li>
 *                <p>A new global secondary index to be added to an existing table.</p>
 *             </li>
 *             <li>
 *                <p>New provisioned throughput parameters for an existing global secondary
 *                     index.</p>
 *             </li>
 *             <li>
 *                <p>An existing global secondary index to be removed from an existing
 *                     table.</p>
 *             </li>
 *          </ul>
 * @public
 */
export interface GlobalSecondaryIndexUpdate {
    /**
     * <p>The name of an existing global secondary index, along with new provisioned throughput
     *             settings to be applied to that index.</p>
     * @public
     */
    Update?: UpdateGlobalSecondaryIndexAction | undefined;
    /**
     * <p>The parameters required for creating a global secondary index on an existing
     *             table:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>IndexName </code>
     *                </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>KeySchema </code>
     *                </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>AttributeDefinitions </code>
     *                </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>Projection </code>
     *                </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ProvisionedThroughput </code>
     *                </p>
     *             </li>
     *          </ul>
     * @public
     */
    Create?: CreateGlobalSecondaryIndexAction | undefined;
    /**
     * <p>The name of an existing global secondary index to be removed.</p>
     * @public
     */
    Delete?: DeleteGlobalSecondaryIndexAction | undefined;
}
/**
 * <p>Represents one of the following:</p>
 *          <ul>
 *             <li>
 *                <p>A new witness to be added to a new global table.</p>
 *             </li>
 *             <li>
 *                <p>An existing witness to be removed from an existing global table.</p>
 *             </li>
 *          </ul>
 *          <p>You can configure one witness per MRSC global table.</p>
 * @public
 */
export interface GlobalTableWitnessGroupUpdate {
    /**
     * <p>Specifies a witness Region to be added to a new MRSC global table. The witness must be
     *             added when creating the MRSC global table.</p>
     * @public
     */
    Create?: CreateGlobalTableWitnessGroupMemberAction | undefined;
    /**
     * <p>Specifies a witness Region to be removed from an existing global table. Must be done
     *             in conjunction with removing a replica. The deletion of both a witness and replica
     *             converts the remaining replica to a single-Region DynamoDB table.</p>
     * @public
     */
    Delete?: DeleteGlobalTableWitnessGroupMemberAction | undefined;
}
/**
 * <p>Represents a replica to be modified.</p>
 * @public
 */
export interface UpdateReplicationGroupMemberAction {
    /**
     * <p>The Region where the replica exists.</p>
     * @public
     */
    RegionName: string | undefined;
    /**
     * <p>The KMS key of the replica that should be used for KMS
     *             encryption. To specify a key, use its key ID, Amazon Resource Name (ARN), alias name, or
     *             alias ARN. Note that you should only provide this parameter if the key is different from
     *             the default DynamoDB KMS key <code>alias/aws/dynamodb</code>.</p>
     * @public
     */
    KMSMasterKeyId?: string | undefined;
    /**
     * <p>Replica-specific provisioned throughput. If not specified, uses the source table's
     *             provisioned throughput settings.</p>
     * @public
     */
    ProvisionedThroughputOverride?: ProvisionedThroughputOverride | undefined;
    /**
     * <p>Overrides the maximum on-demand throughput for the replica table.</p>
     * @public
     */
    OnDemandThroughputOverride?: OnDemandThroughputOverride | undefined;
    /**
     * <p>Replica-specific global secondary index settings.</p>
     * @public
     */
    GlobalSecondaryIndexes?: ReplicaGlobalSecondaryIndex[] | undefined;
    /**
     * <p>Replica-specific table class. If not specified, uses the source table's table
     *             class.</p>
     * @public
     */
    TableClassOverride?: TableClass | undefined;
}
/**
 * <p>Represents one of the following:</p>
 *          <ul>
 *             <li>
 *                <p>A new replica to be added to an existing regional table or global table. This
 *                     request invokes the <code>CreateTableReplica</code> action in the destination
 *                     Region.</p>
 *             </li>
 *             <li>
 *                <p>New parameters for an existing replica. This request invokes the
 *                         <code>UpdateTable</code> action in the destination Region.</p>
 *             </li>
 *             <li>
 *                <p>An existing replica to be deleted. The request invokes the
 *                         <code>DeleteTableReplica</code> action in the destination Region, deleting
 *                     the replica and all if its items in the destination Region.</p>
 *             </li>
 *          </ul>
 *          <note>
 *             <p>When you manually remove a table or global table replica, you do not automatically
 *                 remove any associated scalable targets, scaling policies, or CloudWatch
 *                 alarms.</p>
 *          </note>
 * @public
 */
export interface ReplicationGroupUpdate {
    /**
     * <p>The parameters required for creating a replica for the table.</p>
     * @public
     */
    Create?: CreateReplicationGroupMemberAction | undefined;
    /**
     * <p>The parameters required for updating a replica for the table.</p>
     * @public
     */
    Update?: UpdateReplicationGroupMemberAction | undefined;
    /**
     * <p>The parameters required for deleting a replica for the table.</p>
     * @public
     */
    Delete?: DeleteReplicationGroupMemberAction | undefined;
}
/**
 * <p>Represents the input of an <code>UpdateTable</code> operation.</p>
 * @public
 */
export interface UpdateTableInput {
    /**
     * <p>An array of attributes that describe the key schema for the table and indexes. If you
     *             are adding a new global secondary index to the table, <code>AttributeDefinitions</code>
     *             must include the key element(s) of the new index.</p>
     * @public
     */
    AttributeDefinitions?: AttributeDefinition[] | undefined;
    /**
     * <p>The name of the table to be updated. You can also provide the Amazon Resource Name (ARN) of the table
     *             in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>Controls how you are charged for read and write throughput and how you manage
     *             capacity. When switching from pay-per-request to provisioned capacity, initial
     *             provisioned capacity values must be set. The initial provisioned capacity values are
     *             estimated based on the consumed read and write capacity of your table and global
     *             secondary indexes over the past 30 minutes.</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>PAY_PER_REQUEST</code> - We recommend using <code>PAY_PER_REQUEST</code>
     *                     for most DynamoDB workloads. <code>PAY_PER_REQUEST</code> sets the billing mode
     *                     to <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode.html">On-demand capacity mode</a>. </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>PROVISIONED</code> - We recommend using <code>PROVISIONED</code> for
     *                     steady workloads with predictable growth where capacity requirements can be
     *                     reliably forecasted. <code>PROVISIONED</code> sets the billing mode to <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/provisioned-capacity-mode.html">Provisioned capacity mode</a>.</p>
     *             </li>
     *          </ul>
     * @public
     */
    BillingMode?: BillingMode | undefined;
    /**
     * <p>The new provisioned throughput settings for the specified table or index.</p>
     * @public
     */
    ProvisionedThroughput?: ProvisionedThroughput | undefined;
    /**
     * <p>An array of one or more global secondary indexes for the table. For each index in the
     *             array, you can request one action:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Create</code> - add a new global secondary index to the table.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>Update</code> - modify the provisioned throughput settings of an existing
     *                     global secondary index.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>Delete</code> - remove a global secondary index from the table.</p>
     *             </li>
     *          </ul>
     *          <p>You can create or delete only one global secondary index per <code>UpdateTable</code>
     *             operation.</p>
     *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.OnlineOps.html">Managing Global
     *                 Secondary Indexes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>. </p>
     * @public
     */
    GlobalSecondaryIndexUpdates?: GlobalSecondaryIndexUpdate[] | undefined;
    /**
     * <p>Represents the DynamoDB Streams configuration for the table.</p>
     *          <note>
     *             <p>You receive a <code>ValidationException</code> if you try to enable a stream on a
     *                 table that already has a stream, or if you try to disable a stream on a table that
     *                 doesn't have a stream.</p>
     *          </note>
     * @public
     */
    StreamSpecification?: StreamSpecification | undefined;
    /**
     * <p>The new server-side encryption settings for the specified table.</p>
     * @public
     */
    SSESpecification?: SSESpecification | undefined;
    /**
     * <p>A list of replica update actions (create, delete, or update) for the table.</p>
     * @public
     */
    ReplicaUpdates?: ReplicationGroupUpdate[] | undefined;
    /**
     * <p>The table class of the table to be updated. Valid values are <code>STANDARD</code> and
     *                 <code>STANDARD_INFREQUENT_ACCESS</code>.</p>
     * @public
     */
    TableClass?: TableClass | undefined;
    /**
     * <p>Indicates whether deletion protection is to be enabled (true) or disabled (false) on
     *             the table.</p>
     * @public
     */
    DeletionProtectionEnabled?: boolean | undefined;
    /**
     * <p>Specifies the consistency mode for a new global table. This parameter is only valid
     *             when you create a global table by specifying one or more <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ReplicationGroupUpdate.html#DDB-Type-ReplicationGroupUpdate-Create">Create</a> actions in the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateTable.html#DDB-UpdateTable-request-ReplicaUpdates">ReplicaUpdates</a> action list.</p>
     *          <p>You can specify one of the following consistency modes:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>EVENTUAL</code>: Configures a new global table for multi-Region eventual
     *                     consistency (MREC). This is the default consistency mode for global
     *                     tables.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>STRONG</code>: Configures a new global table for multi-Region strong
     *                     consistency (MRSC).</p>
     *             </li>
     *          </ul>
     *          <p>If you don't specify this field, the global table consistency mode defaults to
     *                 <code>EVENTUAL</code>. For more information about global tables consistency modes,
     *             see <a href="https://docs.aws.amazon.com/V2globaltables_HowItWorks.html#V2globaltables_HowItWorks.consistency-modes">
     *                 Consistency modes</a> in DynamoDB developer guide. </p>
     * @public
     */
    MultiRegionConsistency?: MultiRegionConsistency | undefined;
    /**
     * <p>A list of witness updates for a  MRSC global table. A witness provides a cost-effective
     *             alternative to a full replica in a MRSC global table by maintaining replicated change
     *             data written to global table replicas. You cannot perform read or write operations on a
     *             witness. For each witness, you can request one action:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Create</code> - add a new witness to the global table.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>Delete</code> - remove a witness from the global table.</p>
     *             </li>
     *          </ul>
     *          <p>You can create or delete only one witness per <code>UpdateTable</code>
     *             operation.</p>
     *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_HowItWorks.html#V2globaltables_HowItWorks.consistency-modes">Multi-Region strong consistency (MRSC)</a> in the Amazon DynamoDB
     *             Developer Guide</p>
     * @public
     */
    GlobalTableWitnessUpdates?: GlobalTableWitnessGroupUpdate[] | undefined;
    /**
     * <p>Updates the maximum number of read and write units for the specified table in
     *             on-demand capacity mode. If you use this parameter, you must specify
     *                 <code>MaxReadRequestUnits</code>, <code>MaxWriteRequestUnits</code>, or both.</p>
     * @public
     */
    OnDemandThroughput?: OnDemandThroughput | undefined;
    /**
     * <p>Represents the warm throughput (in read units per second and write units per second)
     *             for updating a table.</p>
     * @public
     */
    WarmThroughput?: WarmThroughput | undefined;
}
/**
 * <p>Represents the output of an <code>UpdateTable</code> operation.</p>
 * @public
 */
export interface UpdateTableOutput {
    /**
     * <p>Represents the properties of the table.</p>
     * @public
     */
    TableDescription?: TableDescription | undefined;
}
/**
 * <p>Represents the auto scaling settings of a global secondary index for a global table
 *             that will be modified.</p>
 * @public
 */
export interface GlobalSecondaryIndexAutoScalingUpdate {
    /**
     * <p>The name of the global secondary index.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>Represents the auto scaling settings to be modified for a global table or global
     *             secondary index.</p>
     * @public
     */
    ProvisionedWriteCapacityAutoScalingUpdate?: AutoScalingSettingsUpdate | undefined;
}
/**
 * <p>Represents the auto scaling settings of a global secondary index for a replica that
 *             will be modified.</p>
 * @public
 */
export interface ReplicaGlobalSecondaryIndexAutoScalingUpdate {
    /**
     * <p>The name of the global secondary index.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>Represents the auto scaling settings to be modified for a global table or global
     *             secondary index.</p>
     * @public
     */
    ProvisionedReadCapacityAutoScalingUpdate?: AutoScalingSettingsUpdate | undefined;
}
/**
 * <p>Represents the auto scaling settings of a replica that will be modified.</p>
 * @public
 */
export interface ReplicaAutoScalingUpdate {
    /**
     * <p>The Region where the replica exists.</p>
     * @public
     */
    RegionName: string | undefined;
    /**
     * <p>Represents the auto scaling settings of global secondary indexes that will be
     *             modified.</p>
     * @public
     */
    ReplicaGlobalSecondaryIndexUpdates?: ReplicaGlobalSecondaryIndexAutoScalingUpdate[] | undefined;
    /**
     * <p>Represents the auto scaling settings to be modified for a global table or global
     *             secondary index.</p>
     * @public
     */
    ReplicaProvisionedReadCapacityAutoScalingUpdate?: AutoScalingSettingsUpdate | undefined;
}
/**
 * @public
 */
export interface UpdateTableReplicaAutoScalingInput {
    /**
     * <p>Represents the auto scaling settings of the global secondary indexes of the replica to
     *             be updated.</p>
     * @public
     */
    GlobalSecondaryIndexUpdates?: GlobalSecondaryIndexAutoScalingUpdate[] | undefined;
    /**
     * <p>The name of the global table to be updated. You can also provide the Amazon Resource Name (ARN) of the
     *             table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>Represents the auto scaling settings to be modified for a global table or global
     *             secondary index.</p>
     * @public
     */
    ProvisionedWriteCapacityAutoScalingUpdate?: AutoScalingSettingsUpdate | undefined;
    /**
     * <p>Represents the auto scaling settings of replicas of the table that will be
     *             modified.</p>
     * @public
     */
    ReplicaUpdates?: ReplicaAutoScalingUpdate[] | undefined;
}
/**
 * @public
 */
export interface UpdateTableReplicaAutoScalingOutput {
    /**
     * <p>Returns information about the auto scaling settings of a table with replicas.</p>
     * @public
     */
    TableAutoScalingDescription?: TableAutoScalingDescription | undefined;
}
/**
 * <p>Represents the settings used to enable or disable Time to Live (TTL) for the specified
 *             table.</p>
 * @public
 */
export interface TimeToLiveSpecification {
    /**
     * <p>Indicates whether TTL is to be enabled (true) or disabled (false) on the table.</p>
     * @public
     */
    Enabled: boolean | undefined;
    /**
     * <p>The name of the TTL attribute used to store the expiration time for items in the
     *             table.</p>
     * @public
     */
    AttributeName: string | undefined;
}
/**
 * <p>Represents the input of an <code>UpdateTimeToLive</code> operation.</p>
 * @public
 */
export interface UpdateTimeToLiveInput {
    /**
     * <p>The name of the table to be configured. You can also provide the Amazon Resource Name (ARN) of the
     *             table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>Represents the settings used to enable or disable Time to Live for the specified
     *             table.</p>
     * @public
     */
    TimeToLiveSpecification: TimeToLiveSpecification | undefined;
}
/**
 * @public
 */
export interface UpdateTimeToLiveOutput {
    /**
     * <p>Represents the output of an <code>UpdateTimeToLive</code> operation.</p>
     * @public
     */
    TimeToLiveSpecification?: TimeToLiveSpecification | undefined;
}
/**
 * <p>Represents the data for an attribute.</p>
 *          <p>Each attribute value is described as a name-value pair. The name is the data type, and
 *             the value is the data itself.</p>
 *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html#HowItWorks.DataTypes">Data Types</a> in the <i>Amazon DynamoDB Developer
 *             Guide</i>.</p>
 * @public
 */
export type AttributeValue = AttributeValue.BMember | AttributeValue.BOOLMember | AttributeValue.BSMember | AttributeValue.LMember | AttributeValue.MMember | AttributeValue.NMember | AttributeValue.NSMember | AttributeValue.NULLMember | AttributeValue.SMember | AttributeValue.SSMember | AttributeValue.$UnknownMember;
/**
 * @public
 */
export declare namespace AttributeValue {
    /**
     * <p>An attribute of type String. For example:</p>
     *          <p>
     *             <code>"S": "Hello"</code>
     *          </p>
     * @public
     */
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
    /**
     * <p>An attribute of type Number. For example:</p>
     *          <p>
     *             <code>"N": "123.45"</code>
     *          </p>
     *          <p>Numbers are sent across the network to DynamoDB as strings, to maximize compatibility
     *             across languages and libraries. However, DynamoDB treats them as number type attributes
     *             for mathematical operations.</p>
     * @public
     */
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
    /**
     * <p>An attribute of type Binary. For example:</p>
     *          <p>
     *             <code>"B": "dGhpcyB0ZXh0IGlzIGJhc2U2NC1lbmNvZGVk"</code>
     *          </p>
     * @public
     */
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
    /**
     * <p>An attribute of type String Set. For example:</p>
     *          <p>
     *             <code>"SS": ["Giraffe", "Hippo" ,"Zebra"]</code>
     *          </p>
     * @public
     */
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
    /**
     * <p>An attribute of type Number Set. For example:</p>
     *          <p>
     *             <code>"NS": ["42.2", "-19", "7.5", "3.14"]</code>
     *          </p>
     *          <p>Numbers are sent across the network to DynamoDB as strings, to maximize compatibility
     *             across languages and libraries. However, DynamoDB treats them as number type attributes
     *             for mathematical operations.</p>
     * @public
     */
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
    /**
     * <p>An attribute of type Binary Set. For example:</p>
     *          <p>
     *             <code>"BS": ["U3Vubnk=", "UmFpbnk=", "U25vd3k="]</code>
     *          </p>
     * @public
     */
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
    /**
     * <p>An attribute of type Map. For example:</p>
     *          <p>
     *             <code>"M": \{"Name": \{"S": "Joe"\}, "Age": \{"N": "35"\}\}</code>
     *          </p>
     * @public
     */
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
    /**
     * <p>An attribute of type List. For example:</p>
     *          <p>
     *             <code>"L": [ \{"S": "Cookies"\} , \{"S": "Coffee"\}, \{"N": "3.14159"\}]</code>
     *          </p>
     * @public
     */
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
    /**
     * <p>An attribute of type Null. For example:</p>
     *          <p>
     *             <code>"NULL": true</code>
     *          </p>
     * @public
     */
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
    /**
     * <p>An attribute of type Boolean. For example:</p>
     *          <p>
     *             <code>"BOOL": true</code>
     *          </p>
     * @public
     */
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
    /**
     * @public
     */
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
/**
 * <p>For the <code>UpdateItem</code> operation, represents the attributes to be modified,
 *             the action to perform on each, and the new value for each.</p>
 *          <note>
 *             <p>You cannot use <code>UpdateItem</code> to update any primary key attributes.
 *                 Instead, you will need to delete the item, and then use <code>PutItem</code> to
 *                 create a new item with new attributes.</p>
 *          </note>
 *          <p>Attribute values cannot be null; string and binary type attributes must have lengths
 *             greater than zero; and set type attributes must not be empty. Requests with empty values
 *             will be rejected with a <code>ValidationException</code> exception.</p>
 * @public
 */
export interface AttributeValueUpdate {
    /**
     * <p>Represents the data for an attribute.</p>
     *          <p>Each attribute value is described as a name-value pair. The name is the data type, and
     *             the value is the data itself.</p>
     *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html#HowItWorks.DataTypes">Data Types</a> in the <i>Amazon DynamoDB Developer Guide</i>.
     *         </p>
     * @public
     */
    Value?: AttributeValue | undefined;
    /**
     * <p>Specifies how to perform the update. Valid values are <code>PUT</code> (default),
     *                 <code>DELETE</code>, and <code>ADD</code>. The behavior depends on whether the
     *             specified primary key already exists in the table.</p>
     *          <p>
     *             <b>If an item with the specified <i>Key</i> is found in
     *                 the table:</b>
     *          </p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>PUT</code> - Adds the specified attribute to the item. If the attribute
     *                     already exists, it is replaced by the new value. </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETE</code> - If no value is specified, the attribute and its value are
     *                     removed from the item. The data type of the specified value must match the
     *                     existing value's data type.</p>
     *                <p>If a <i>set</i> of values is specified, then those values are
     *                     subtracted from the old set. For example, if the attribute value was the set
     *                         <code>[a,b,c]</code> and the <code>DELETE</code> action specified
     *                         <code>[a,c]</code>, then the final attribute value would be
     *                     <code>[b]</code>. Specifying an empty set is an error.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ADD</code> - If the attribute does not already exist, then the attribute
     *                     and its values are added to the item. If the attribute does exist, then the
     *                     behavior of <code>ADD</code> depends on the data type of the attribute:</p>
     *                <ul>
     *                   <li>
     *                      <p>If the existing attribute is a number, and if <code>Value</code> is
     *                             also a number, then the <code>Value</code> is mathematically added to
     *                             the existing attribute. If <code>Value</code> is a negative number, then
     *                             it is subtracted from the existing attribute.</p>
     *                      <note>
     *                         <p> If you use <code>ADD</code> to increment or decrement a number
     *                                 value for an item that doesn't exist before the update, DynamoDB
     *                                 uses 0 as the initial value.</p>
     *                         <p>In addition, if you use <code>ADD</code> to update an existing
     *                                 item, and intend to increment or decrement an attribute value which
     *                                 does not yet exist, DynamoDB uses <code>0</code> as the initial
     *                                 value. For example, suppose that the item you want to update does
     *                                 not yet have an attribute named <i>itemcount</i>, but
     *                                 you decide to <code>ADD</code> the number <code>3</code> to this
     *                                 attribute anyway, even though it currently does not exist. DynamoDB
     *                                 will create the <i>itemcount</i> attribute, set its
     *                                 initial value to <code>0</code>, and finally add <code>3</code> to
     *                                 it. The result will be a new <i>itemcount</i>
     *                                 attribute in the item, with a value of <code>3</code>.</p>
     *                      </note>
     *                   </li>
     *                   <li>
     *                      <p>If the existing data type is a set, and if the <code>Value</code> is
     *                             also a set, then the <code>Value</code> is added to the existing set.
     *                             (This is a <i>set</i> operation, not mathematical
     *                             addition.) For example, if the attribute value was the set
     *                                 <code>[1,2]</code>, and the <code>ADD</code> action specified
     *                                 <code>[3]</code>, then the final attribute value would be
     *                                 <code>[1,2,3]</code>. An error occurs if an Add action is specified
     *                             for a set attribute and the attribute type specified does not match the
     *                             existing set type. </p>
     *                      <p>Both sets must have the same primitive data type. For example, if the
     *                             existing data type is a set of strings, the <code>Value</code> must also
     *                             be a set of strings. The same holds true for number sets and binary
     *                             sets.</p>
     *                   </li>
     *                </ul>
     *                <p>This action is only valid for an existing attribute whose data type is number
     *                     or is a set. Do not use <code>ADD</code> for any other data types.</p>
     *             </li>
     *          </ul>
     *          <p>
     *             <b>If no item with the specified <i>Key</i> is
     *                 found:</b>
     *          </p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>PUT</code> - DynamoDB creates a new item with the specified primary key,
     *                     and then adds the attribute. </p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETE</code> - Nothing happens; there is no attribute to delete.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ADD</code> - DynamoDB creates a new item with the supplied primary key and
     *                     number (or set) for the attribute value. The only data types allowed are number,
     *                     number set, string set or binary set.</p>
     *             </li>
     *          </ul>
     * @public
     */
    Action?: AttributeAction | undefined;
}
/**
 * <p> An error associated with a statement in a PartiQL batch that was run. </p>
 * @public
 */
export interface BatchStatementError {
    /**
     * <p> The error code associated with the failed PartiQL batch statement. </p>
     * @public
     */
    Code?: BatchStatementErrorCodeEnum | undefined;
    /**
     * <p> The error message associated with the PartiQL batch response. </p>
     * @public
     */
    Message?: string | undefined;
    /**
     * <p>The item which caused the condition check to fail. This will be set if
     *             ReturnValuesOnConditionCheckFailure is specified as <code>ALL_OLD</code>.</p>
     * @public
     */
    Item?: Record<string, AttributeValue> | undefined;
}
/**
 * <p> A PartiQL batch statement request. </p>
 * @public
 */
export interface BatchStatementRequest {
    /**
     * <p> A valid PartiQL statement. </p>
     * @public
     */
    Statement: string | undefined;
    /**
     * <p> The parameters associated with a PartiQL statement in the batch request. </p>
     * @public
     */
    Parameters?: AttributeValue[] | undefined;
    /**
     * <p> The read consistency of the PartiQL batch request. </p>
     * @public
     */
    ConsistentRead?: boolean | undefined;
    /**
     * <p>An optional parameter that returns the item attributes for a PartiQL batch request
     *             operation that failed a condition check.</p>
     *          <p>There is no additional cost associated with requesting a return value aside from the
     *             small network and processing overhead of receiving a larger response. No read capacity
     *             units are consumed.</p>
     * @public
     */
    ReturnValuesOnConditionCheckFailure?: ReturnValuesOnConditionCheckFailure | undefined;
}
/**
 * <p>An ordered list of errors for each item in the request which caused the transaction to
 *             get cancelled. The values of the list are ordered according to the ordering of the
 *                 <code>TransactWriteItems</code> request parameter. If no error occurred for the
 *             associated item an error with a Null code and Null message will be present. </p>
 * @public
 */
export interface CancellationReason {
    /**
     * <p>Item in the request which caused the transaction to get cancelled.</p>
     * @public
     */
    Item?: Record<string, AttributeValue> | undefined;
    /**
     * <p>Status code for the result of the cancelled transaction.</p>
     * @public
     */
    Code?: string | undefined;
    /**
     * <p>Cancellation reason message description.</p>
     * @public
     */
    Message?: string | undefined;
}
/**
 * <p>Represents the selection criteria for a <code>Query</code> or <code>Scan</code>
 *             operation:</p>
 *          <ul>
 *             <li>
 *                <p>For a <code>Query</code> operation, <code>Condition</code> is used for
 *                     specifying the <code>KeyConditions</code> to use when querying a table or an
 *                     index. For <code>KeyConditions</code>, only the following comparison operators
 *                     are supported:</p>
 *                <p>
 *                   <code>EQ | LE | LT | GE | GT | BEGINS_WITH | BETWEEN</code>
 *                </p>
 *                <p>
 *                   <code>Condition</code> is also used in a <code>QueryFilter</code>, which
 *                     evaluates the query results and returns only the desired values.</p>
 *             </li>
 *             <li>
 *                <p>For a <code>Scan</code> operation, <code>Condition</code> is used in a
 *                         <code>ScanFilter</code>, which evaluates the scan results and returns only
 *                     the desired values.</p>
 *             </li>
 *          </ul>
 * @public
 */
export interface Condition {
    /**
     * <p>One or more values to evaluate against the supplied attribute. The number of values in
     *             the list depends on the <code>ComparisonOperator</code> being used.</p>
     *          <p>For type Number, value comparisons are numeric.</p>
     *          <p>String value comparisons for greater than, equals, or less than are based on ASCII
     *             character code values. For example, <code>a</code> is greater than <code>A</code>, and
     *                 <code>a</code> is greater than <code>B</code>. For a list of code values, see <a href="http://en.wikipedia.org/wiki/ASCII#ASCII_printable_characters">http://en.wikipedia.org/wiki/ASCII#ASCII_printable_characters</a>.</p>
     *          <p>For Binary, DynamoDB treats each byte of the binary data as unsigned when it
     *             compares binary values.</p>
     * @public
     */
    AttributeValueList?: AttributeValue[] | undefined;
    /**
     * <p>A comparator for evaluating attributes. For example, equals, greater than, less than,
     *             etc.</p>
     *          <p>The following comparison operators are available:</p>
     *          <p>
     *             <code>EQ | NE | LE | LT | GE | GT | NOT_NULL | NULL | CONTAINS | NOT_CONTAINS |
     *                 BEGINS_WITH | IN | BETWEEN</code>
     *          </p>
     *          <p>The following are descriptions of each comparison operator.</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>EQ</code> : Equal. <code>EQ</code> is supported for all data types,
     *                     including lists and maps.</p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, Binary, String Set, Number Set, or Binary Set.
     *                     If an item contains an <code>AttributeValue</code> element of a different type
     *                     than the one provided in the request, the value does not match. For example,
     *                         <code>\{"S":"6"\}</code> does not equal <code>\{"N":"6"\}</code>. Also,
     *                         <code>\{"N":"6"\}</code> does not equal <code>\{"NS":["6", "2",
     *                     "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NE</code> : Not equal. <code>NE</code> is supported for all data types,
     *                     including lists and maps.</p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     of type String, Number, Binary, String Set, Number Set, or Binary Set. If an
     *                     item contains an <code>AttributeValue</code> of a different type than the one
     *                     provided in the request, the value does not match. For example,
     *                         <code>\{"S":"6"\}</code> does not equal <code>\{"N":"6"\}</code>. Also,
     *                         <code>\{"N":"6"\}</code> does not equal <code>\{"NS":["6", "2",
     *                     "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>LE</code> : Less than or equal. </p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, or Binary (not a set type). If an item contains
     *                     an <code>AttributeValue</code> element of a different type than the one provided
     *                     in the request, the value does not match. For example, <code>\{"S":"6"\}</code>
     *                     does not equal <code>\{"N":"6"\}</code>. Also, <code>\{"N":"6"\}</code> does not
     *                     compare to <code>\{"NS":["6", "2", "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>LT</code> : Less than. </p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     of type String, Number, or Binary (not a set type). If an item contains an
     *                         <code>AttributeValue</code> element of a different type than the one
     *                     provided in the request, the value does not match. For example,
     *                         <code>\{"S":"6"\}</code> does not equal <code>\{"N":"6"\}</code>. Also,
     *                         <code>\{"N":"6"\}</code> does not compare to <code>\{"NS":["6", "2",
     *                         "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>GE</code> : Greater than or equal. </p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, or Binary (not a set type). If an item contains
     *                     an <code>AttributeValue</code> element of a different type than the one provided
     *                     in the request, the value does not match. For example, <code>\{"S":"6"\}</code>
     *                     does not equal <code>\{"N":"6"\}</code>. Also, <code>\{"N":"6"\}</code> does not
     *                     compare to <code>\{"NS":["6", "2", "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>GT</code> : Greater than. </p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, or Binary (not a set type). If an item contains
     *                     an <code>AttributeValue</code> element of a different type than the one provided
     *                     in the request, the value does not match. For example, <code>\{"S":"6"\}</code>
     *                     does not equal <code>\{"N":"6"\}</code>. Also, <code>\{"N":"6"\}</code> does not
     *                     compare to <code>\{"NS":["6", "2", "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NOT_NULL</code> : The attribute exists. <code>NOT_NULL</code> is supported
     *                     for all data types, including lists and maps.</p>
     *                <note>
     *                   <p>This operator tests for the existence of an attribute, not its data type.
     *                         If the data type of attribute "<code>a</code>" is null, and you evaluate it
     *                         using <code>NOT_NULL</code>, the result is a Boolean <code>true</code>. This
     *                         result is because the attribute "<code>a</code>" exists; its data type is
     *                         not relevant to the <code>NOT_NULL</code> comparison operator.</p>
     *                </note>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NULL</code> : The attribute does not exist. <code>NULL</code> is supported
     *                     for all data types, including lists and maps.</p>
     *                <note>
     *                   <p>This operator tests for the nonexistence of an attribute, not its data
     *                         type. If the data type of attribute "<code>a</code>" is null, and you
     *                         evaluate it using <code>NULL</code>, the result is a Boolean
     *                             <code>false</code>. This is because the attribute "<code>a</code>"
     *                         exists; its data type is not relevant to the <code>NULL</code> comparison
     *                         operator.</p>
     *                </note>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>CONTAINS</code> : Checks for a subsequence, or value in a set.</p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, or Binary (not a set type). If the target
     *                     attribute of the comparison is of type String, then the operator checks for a
     *                     substring match. If the target attribute of the comparison is of type Binary,
     *                     then the operator looks for a subsequence of the target that matches the input.
     *                     If the target attribute of the comparison is a set ("<code>SS</code>",
     *                         "<code>NS</code>", or "<code>BS</code>"), then the operator evaluates to
     *                     true if it finds an exact match with any member of the set.</p>
     *                <p>CONTAINS is supported for lists: When evaluating "<code>a CONTAINS b</code>",
     *                         "<code>a</code>" can be a list; however, "<code>b</code>" cannot be a set, a
     *                     map, or a list.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NOT_CONTAINS</code> : Checks for absence of a subsequence, or absence of a
     *                     value in a set.</p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, or Binary (not a set type). If the target
     *                     attribute of the comparison is a String, then the operator checks for the
     *                     absence of a substring match. If the target attribute of the comparison is
     *                     Binary, then the operator checks for the absence of a subsequence of the target
     *                     that matches the input. If the target attribute of the comparison is a set
     *                         ("<code>SS</code>", "<code>NS</code>", or "<code>BS</code>"), then the
     *                     operator evaluates to true if it <i>does not</i> find an exact
     *                     match with any member of the set.</p>
     *                <p>NOT_CONTAINS is supported for lists: When evaluating "<code>a NOT CONTAINS
     *                         b</code>", "<code>a</code>" can be a list; however, "<code>b</code>" cannot
     *                     be a set, a map, or a list.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>BEGINS_WITH</code> : Checks for a prefix. </p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     of type String or Binary (not a Number or a set type). The target attribute of
     *                     the comparison must be of type String or Binary (not a Number or a set
     *                     type).</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>IN</code> : Checks for matching elements in a list.</p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain one or more
     *                         <code>AttributeValue</code> elements of type String, Number, or Binary.
     *                     These attributes are compared against an existing attribute of an item. If any
     *                     elements of the input are equal to the item attribute, the expression evaluates
     *                     to true.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>BETWEEN</code> : Greater than or equal to the first value, and less than
     *                     or equal to the second value. </p>
     *                <p>
     *                   <code>AttributeValueList</code> must contain two <code>AttributeValue</code>
     *                     elements of the same type, either String, Number, or Binary (not a set type). A
     *                     target attribute matches if the target value is greater than, or equal to, the
     *                     first element and less than, or equal to, the second element. If an item
     *                     contains an <code>AttributeValue</code> element of a different type than the one
     *                     provided in the request, the value does not match. For example,
     *                         <code>\{"S":"6"\}</code> does not compare to <code>\{"N":"6"\}</code>. Also,
     *                         <code>\{"N":"6"\}</code> does not compare to <code>\{"NS":["6", "2",
     *                         "1"]\}</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>For usage examples of <code>AttributeValueList</code> and
     *                 <code>ComparisonOperator</code>, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.html">Legacy
     *                 Conditional Parameters</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ComparisonOperator: ComparisonOperator | undefined;
}
/**
 * <p>A condition specified in the operation failed to be evaluated.</p>
 * @public
 */
export declare class ConditionalCheckFailedException extends __BaseException {
    readonly name: "ConditionalCheckFailedException";
    readonly $fault: "client";
    /**
     * <p>Item which caused the <code>ConditionalCheckFailedException</code>.</p>
     * @public
     */
    Item?: Record<string, AttributeValue> | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<ConditionalCheckFailedException, __BaseException>);
}
/**
 * <p>Represents a request to perform a <code>DeleteItem</code> operation on an item.</p>
 * @public
 */
export interface DeleteRequest {
    /**
     * <p>A map of attribute name to attribute values, representing the primary key of the item
     *             to delete. All of the table's primary key attributes must be specified, and their data
     *             types must match those of the table's key schema.</p>
     * @public
     */
    Key: Record<string, AttributeValue> | undefined;
}
/**
 * @public
 */
export interface ExecuteStatementInput {
    /**
     * <p>The PartiQL statement representing the operation to run.</p>
     * @public
     */
    Statement: string | undefined;
    /**
     * <p>The parameters for the PartiQL statement, if any.</p>
     * @public
     */
    Parameters?: AttributeValue[] | undefined;
    /**
     * <p>The consistency of a read operation. If set to <code>true</code>, then a strongly
     *             consistent read is used; otherwise, an eventually consistent read is used.</p>
     * @public
     */
    ConsistentRead?: boolean | undefined;
    /**
     * <p>Set this value to get remaining results, if <code>NextToken</code> was returned in the
     *             statement response.</p>
     * @public
     */
    NextToken?: string | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INDEXES</code> - The response includes the aggregate
     *                         <code>ConsumedCapacity</code> for the operation, together with
     *                         <code>ConsumedCapacity</code> for each table and secondary index that was
     *                     accessed.</p>
     *                <p>Note that some operations, such as <code>GetItem</code> and
     *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
     *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
     *                     information for table(s).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>TOTAL</code> - The response includes only the aggregate
     *                         <code>ConsumedCapacity</code> for the operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
     *                     response.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
    /**
     * <p>The maximum number of items to evaluate (not necessarily the number of matching
     *             items). If DynamoDB processes the number of items up to the limit while processing the
     *             results, it stops the operation and returns the matching values up to that point, along
     *             with a key in <code>LastEvaluatedKey</code> to apply in a subsequent operation so you
     *             can pick up where you left off. Also, if the processed dataset size exceeds 1 MB before
     *             DynamoDB reaches this limit, it stops the operation and returns the matching values up
     *             to the limit, and a key in <code>LastEvaluatedKey</code> to apply in a subsequent
     *             operation to continue the operation. </p>
     * @public
     */
    Limit?: number | undefined;
    /**
     * <p>An optional parameter that returns the item attributes for an
     *                 <code>ExecuteStatement</code> operation that failed a condition check.</p>
     *          <p>There is no additional cost associated with requesting a return value aside from the
     *             small network and processing overhead of receiving a larger response. No read capacity
     *             units are consumed.</p>
     * @public
     */
    ReturnValuesOnConditionCheckFailure?: ReturnValuesOnConditionCheckFailure | undefined;
}
/**
 * <p>Specifies an item and related attribute values to retrieve in a
 *                 <code>TransactGetItem</code> object.</p>
 * @public
 */
export interface Get {
    /**
     * <p>A map of attribute names to <code>AttributeValue</code> objects that specifies the
     *             primary key of the item to retrieve.</p>
     * @public
     */
    Key: Record<string, AttributeValue> | undefined;
    /**
     * <p>The name of the table from which to retrieve the specified item. You can also provide
     *             the Amazon Resource Name (ARN) of the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>A string that identifies one or more attributes of the specified item to retrieve from
     *             the table. The attributes in the expression must be separated by commas. If no attribute
     *             names are specified, then all attributes of the specified item are returned. If any of
     *             the requested attributes are not found, they do not appear in the result.</p>
     * @public
     */
    ProjectionExpression?: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in the ProjectionExpression
     *             parameter.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
}
/**
 * <p>Represents the input of a <code>GetItem</code> operation.</p>
 * @public
 */
export interface GetItemInput {
    /**
     * <p>The name of the table containing the requested item. You can also provide the
     *             Amazon Resource Name (ARN) of the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>A map of attribute names to <code>AttributeValue</code> objects, representing the
     *             primary key of the item to retrieve.</p>
     *          <p>For the primary key, you must provide all of the attributes. For example, with a
     *             simple primary key, you only need to provide a value for the partition key. For a
     *             composite primary key, you must provide values for both the partition key and the sort
     *             key.</p>
     * @public
     */
    Key: Record<string, AttributeValue> | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>ProjectionExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.AttributesToGet.html">AttributesToGet</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    AttributesToGet?: string[] | undefined;
    /**
     * <p>Determines the read consistency model: If set to <code>true</code>, then the operation
     *             uses strongly consistent reads; otherwise, the operation uses eventually consistent
     *             reads.</p>
     * @public
     */
    ConsistentRead?: boolean | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INDEXES</code> - The response includes the aggregate
     *                         <code>ConsumedCapacity</code> for the operation, together with
     *                         <code>ConsumedCapacity</code> for each table and secondary index that was
     *                     accessed.</p>
     *                <p>Note that some operations, such as <code>GetItem</code> and
     *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
     *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
     *                     information for table(s).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>TOTAL</code> - The response includes only the aggregate
     *                         <code>ConsumedCapacity</code> for the operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
     *                     response.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
    /**
     * <p>A string that identifies one or more attributes to retrieve from the table. These
     *             attributes can include scalars, sets, or elements of a JSON document. The attributes in
     *             the expression must be separated by commas.</p>
     *          <p>If no attribute names are specified, then all attributes are returned. If any of the
     *             requested attributes are not found, they do not appear in the result.</p>
     *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Specifying Item Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ProjectionExpression?: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in an expression. The following
     *             are some use cases for using <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>To access an attribute whose name conflicts with a DynamoDB reserved
     *                     word.</p>
     *             </li>
     *             <li>
     *                <p>To create a placeholder for repeating occurrences of an attribute name in an
     *                     expression.</p>
     *             </li>
     *             <li>
     *                <p>To prevent special characters in an attribute name from being misinterpreted
     *                     in an expression.</p>
     *             </li>
     *          </ul>
     *          <p>Use the <b>#</b> character in an expression to dereference
     *             an attribute name. For example, consider the following attribute name:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Percentile</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>The name of this attribute conflicts with a reserved word, so it cannot be used
     *             directly in an expression. (For the complete list of reserved words, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html">Reserved Words</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>). To work around this, you could specify the following for
     *                 <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>\{"#P":"Percentile"\}</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>You could then use this substitution in an expression, as in this example:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>#P = :val</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>Tokens that begin with the <b>:</b> character are
     *                     <i>expression attribute values</i>, which are placeholders for the
     *                 actual value at runtime.</p>
     *          </note>
     *          <p>For more information on expression attribute names, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Specifying Item Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
}
/**
 * <p>Represents the output of a <code>GetItem</code> operation.</p>
 * @public
 */
export interface GetItemOutput {
    /**
     * <p>A map of attribute names to <code>AttributeValue</code> objects, as specified by
     *                 <code>ProjectionExpression</code>.</p>
     * @public
     */
    Item?: Record<string, AttributeValue> | undefined;
    /**
     * <p>The capacity units consumed by the <code>GetItem</code> operation. The data returned
     *             includes the total provisioned throughput consumed, along with statistics for the table
     *             and any indexes involved in the operation. <code>ConsumedCapacity</code> is only
     *             returned if the <code>ReturnConsumedCapacity</code> parameter was specified. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/read-write-operations.html#read-operation-consumption">Capacity unit consumption for read operations</a> in the <i>Amazon
     *                 DynamoDB Developer Guide</i>.</p>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity | undefined;
}
/**
 * <p>Information about item collections, if any, that were affected by the operation.
 *                 <code>ItemCollectionMetrics</code> is only returned if the request asked for it. If
 *             the table does not have any local secondary indexes, this information is not returned in
 *             the response.</p>
 * @public
 */
export interface ItemCollectionMetrics {
    /**
     * <p>The partition key value of the item collection. This value is the same as the
     *             partition key value of the item.</p>
     * @public
     */
    ItemCollectionKey?: Record<string, AttributeValue> | undefined;
    /**
     * <p>An estimate of item collection size, in gigabytes. This value is a two-element array
     *             containing a lower bound and an upper bound for the estimate. The estimate includes the
     *             size of all the items in the table, plus the size of all attributes projected into all
     *             of the local secondary indexes on that table. Use this estimate to measure whether a
     *             local secondary index is approaching its size limit.</p>
     *          <p>The estimate is subject to change over time; therefore, do not rely on the precision
     *             or accuracy of the estimate.</p>
     * @public
     */
    SizeEstimateRangeGB?: number[] | undefined;
}
/**
 * <p>Details for the requested item.</p>
 * @public
 */
export interface ItemResponse {
    /**
     * <p>Map of attribute data consisting of the data type and attribute value.</p>
     * @public
     */
    Item?: Record<string, AttributeValue> | undefined;
}
/**
 * <p> Represents a PartiQL statement that uses parameters. </p>
 * @public
 */
export interface ParameterizedStatement {
    /**
     * <p> A PartiQL statement that uses parameters. </p>
     * @public
     */
    Statement: string | undefined;
    /**
     * <p> The parameter values. </p>
     * @public
     */
    Parameters?: AttributeValue[] | undefined;
    /**
     * <p>An optional parameter that returns the item attributes for a PartiQL
     *                 <code>ParameterizedStatement</code> operation that failed a condition check.</p>
     *          <p>There is no additional cost associated with requesting a return value aside from the
     *             small network and processing overhead of receiving a larger response. No read capacity
     *             units are consumed.</p>
     * @public
     */
    ReturnValuesOnConditionCheckFailure?: ReturnValuesOnConditionCheckFailure | undefined;
}
/**
 * <p>Represents a request to perform a <code>PutItem</code> operation on an item.</p>
 * @public
 */
export interface PutRequest {
    /**
     * <p>A map of attribute name to attribute values, representing the primary key of an item
     *             to be processed by <code>PutItem</code>. All of the table's primary key attributes must
     *             be specified, and their data types must match those of the table's key schema. If any
     *             attributes are present in the item that are part of an index key schema for the table,
     *             their types must match the index key schema.</p>
     * @public
     */
    Item: Record<string, AttributeValue> | undefined;
}
/**
 * <p>Represents a set of primary keys and, for each key, the attributes to retrieve from
 *             the table.</p>
 *          <p>For each primary key, you must provide <i>all</i> of the key attributes.
 *             For example, with a simple primary key, you only need to provide the partition key. For
 *             a composite primary key, you must provide <i>both</i> the partition key
 *             and the sort key.</p>
 * @public
 */
export interface KeysAndAttributes {
    /**
     * <p>The primary key attribute values that define the items and the attributes associated
     *             with the items.</p>
     * @public
     */
    Keys: Record<string, AttributeValue>[] | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>ProjectionExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.html">Legacy
     *                 Conditional Parameters</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    AttributesToGet?: string[] | undefined;
    /**
     * <p>The consistency of a read operation. If set to <code>true</code>, then a strongly
     *             consistent read is used; otherwise, an eventually consistent read is used.</p>
     * @public
     */
    ConsistentRead?: boolean | undefined;
    /**
     * <p>A string that identifies one or more attributes to retrieve from the table. These
     *             attributes can include scalars, sets, or elements of a JSON document. The attributes in
     *             the <code>ProjectionExpression</code> must be separated by commas.</p>
     *          <p>If no attribute names are specified, then all attributes will be returned. If any of
     *             the requested attributes are not found, they will not appear in the result.</p>
     *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Accessing Item Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ProjectionExpression?: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in an expression. The following
     *             are some use cases for using <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>To access an attribute whose name conflicts with a DynamoDB reserved
     *                     word.</p>
     *             </li>
     *             <li>
     *                <p>To create a placeholder for repeating occurrences of an attribute name in an
     *                     expression.</p>
     *             </li>
     *             <li>
     *                <p>To prevent special characters in an attribute name from being misinterpreted
     *                     in an expression.</p>
     *             </li>
     *          </ul>
     *          <p>Use the <b>#</b> character in an expression to dereference
     *             an attribute name. For example, consider the following attribute name:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Percentile</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>The name of this attribute conflicts with a reserved word, so it cannot be used
     *             directly in an expression. (For the complete list of reserved words, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html">Reserved Words</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>). To work around this, you could specify the following for
     *                 <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>\{"#P":"Percentile"\}</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>You could then use this substitution in an expression, as in this example:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>#P = :val</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>Tokens that begin with the <b>:</b> character are
     *                     <i>expression attribute values</i>, which are placeholders for the
     *                 actual value at runtime.</p>
     *          </note>
     *          <p>For more information on expression attribute names, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Accessing Item Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
}
/**
 * <p>Specifies an item to be retrieved as part of the transaction.</p>
 * @public
 */
export interface TransactGetItem {
    /**
     * <p>Contains the primary key that identifies the item to get, together with the name of
     *             the table that contains the item, and optionally the specific attributes of the item to
     *             retrieve.</p>
     * @public
     */
    Get: Get | undefined;
}
/**
 * @public
 */
export interface BatchExecuteStatementInput {
    /**
     * <p>The list of PartiQL statements representing the batch to run.</p>
     * @public
     */
    Statements: BatchStatementRequest[] | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INDEXES</code> - The response includes the aggregate
     *                         <code>ConsumedCapacity</code> for the operation, together with
     *                         <code>ConsumedCapacity</code> for each table and secondary index that was
     *                     accessed.</p>
     *                <p>Note that some operations, such as <code>GetItem</code> and
     *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
     *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
     *                     information for table(s).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>TOTAL</code> - The response includes only the aggregate
     *                         <code>ConsumedCapacity</code> for the operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
     *                     response.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
}
/**
 * @public
 */
export interface ExecuteTransactionInput {
    /**
     * <p>The list of PartiQL statements representing the transaction to run.</p>
     * @public
     */
    TransactStatements: ParameterizedStatement[] | undefined;
    /**
     * <p>Set this value to get remaining results, if <code>NextToken</code> was returned in the
     *             statement response.</p>
     * @public
     */
    ClientRequestToken?: string | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactGetItems.html">TransactGetItems</a> and <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html">TransactWriteItems</a>.</p>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
}
/**
 * @public
 */
export interface ExecuteTransactionOutput {
    /**
     * <p>The response to a PartiQL transaction.</p>
     * @public
     */
    Responses?: ItemResponse[] | undefined;
    /**
     * <p>The capacity units consumed by the entire operation. The values of the list are
     *             ordered according to the ordering of the statements.</p>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity[] | undefined;
}
/**
 * @public
 */
export interface TransactGetItemsOutput {
    /**
     * <p>If the <i>ReturnConsumedCapacity</i> value was <code>TOTAL</code>, this
     *             is an array of <code>ConsumedCapacity</code> objects, one for each table addressed by
     *                 <code>TransactGetItem</code> objects in the <i>TransactItems</i>
     *             parameter. These <code>ConsumedCapacity</code> objects report the read-capacity units
     *             consumed by the <code>TransactGetItems</code> call in that table.</p>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity[] | undefined;
    /**
     * <p>An ordered array of up to 100 <code>ItemResponse</code> objects, each of which
     *             corresponds to the <code>TransactGetItem</code> object in the same position in the
     *                 <i>TransactItems</i> array. Each <code>ItemResponse</code> object
     *             contains a Map of the name-value pairs that are the projected attributes of the
     *             requested item.</p>
     *          <p>If a requested item could not be retrieved, the corresponding
     *                 <code>ItemResponse</code> object is Null, or if the requested item has no projected
     *             attributes, the corresponding <code>ItemResponse</code> object is an empty Map. </p>
     * @public
     */
    Responses?: ItemResponse[] | undefined;
}
/**
 * <p>The entire transaction request was canceled.</p>
 *          <p>DynamoDB cancels a <code>TransactWriteItems</code> request under the following
 *             circumstances:</p>
 *          <ul>
 *             <li>
 *                <p>A condition in one of the condition expressions is not met.</p>
 *             </li>
 *             <li>
 *                <p>A table in the <code>TransactWriteItems</code> request is in a different
 *                     account or region.</p>
 *             </li>
 *             <li>
 *                <p>More than one action in the <code>TransactWriteItems</code> operation
 *                     targets the same item.</p>
 *             </li>
 *             <li>
 *                <p>There is insufficient provisioned capacity for the transaction to be
 *                     completed.</p>
 *             </li>
 *             <li>
 *                <p>An item size becomes too large (larger than 400 KB), or a local secondary
 *                     index (LSI) becomes too large, or a similar validation error occurs because of
 *                     changes made by the transaction.</p>
 *             </li>
 *             <li>
 *                <p>There is a user error, such as an invalid data format.</p>
 *             </li>
 *             <li>
 *                <p> There is an ongoing <code>TransactWriteItems</code> operation that
 *                     conflicts with a concurrent <code>TransactWriteItems</code> request. In this
 *                     case the <code>TransactWriteItems</code> operation fails with a
 *                         <code>TransactionCanceledException</code>. </p>
 *             </li>
 *          </ul>
 *          <p>DynamoDB cancels a <code>TransactGetItems</code> request under the
 *             following circumstances:</p>
 *          <ul>
 *             <li>
 *                <p>There is an ongoing <code>TransactGetItems</code> operation that conflicts
 *                     with a concurrent <code>PutItem</code>, <code>UpdateItem</code>,
 *                         <code>DeleteItem</code> or <code>TransactWriteItems</code> request. In this
 *                     case the <code>TransactGetItems</code> operation fails with a
 *                         <code>TransactionCanceledException</code>.</p>
 *             </li>
 *             <li>
 *                <p>A table in the <code>TransactGetItems</code> request is in a different
 *                     account or region.</p>
 *             </li>
 *             <li>
 *                <p>There is insufficient provisioned capacity for the transaction to be
 *                     completed.</p>
 *             </li>
 *             <li>
 *                <p>There is a user error, such as an invalid data format.</p>
 *             </li>
 *          </ul>
 *          <note>
 *             <p>If using Java, DynamoDB lists the cancellation reasons on the
 *                     <code>CancellationReasons</code> property. This property is not set for other
 *                 languages. Transaction cancellation reasons are ordered in the order of requested
 *                 items, if an item has no error it will have <code>None</code> code and
 *                     <code>Null</code> message.</p>
 *          </note>
 *          <p>Cancellation reason codes and possible error messages:</p>
 *          <ul>
 *             <li>
 *                <p>No Errors:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>None</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Message: <code>null</code>
 *                      </p>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Conditional Check Failed:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>ConditionalCheckFailed</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Message: The conditional request failed. </p>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Item Collection Size Limit Exceeded:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>ItemCollectionSizeLimitExceeded</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Message: Collection size exceeded.</p>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Transaction Conflict:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>TransactionConflict</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Message: Transaction is ongoing for the item.</p>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Provisioned Throughput Exceeded:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>ProvisionedThroughputExceeded</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Messages:</p>
 *                      <ul>
 *                         <li>
 *                            <p>The level of configured provisioned throughput for the
 *                                     table was exceeded. Consider increasing your provisioning level
 *                                     with the UpdateTable API.</p>
 *                            <note>
 *                               <p>This Message is received when provisioned throughput is
 *                                         exceeded is on a provisioned DynamoDB
 *                                         table.</p>
 *                            </note>
 *                         </li>
 *                         <li>
 *                            <p>The level of configured provisioned throughput for one or
 *                                     more global secondary indexes of the table was exceeded.
 *                                     Consider increasing your provisioning level for the
 *                                     under-provisioned global secondary indexes with the UpdateTable
 *                                     API.</p>
 *                            <note>
 *                               <p>This message is returned when provisioned throughput is
 *                                         exceeded is on a provisioned GSI.</p>
 *                            </note>
 *                         </li>
 *                      </ul>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Throttling Error:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>ThrottlingError</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Messages: </p>
 *                      <ul>
 *                         <li>
 *                            <p>Throughput exceeds the current capacity of your table or
 *                                     index. DynamoDB is automatically scaling your table or
 *                                     index so please try again shortly. If exceptions persist, check
 *                                     if you have a hot key:
 *                                     https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html.</p>
 *                            <note>
 *                               <p>This message is returned when writes get throttled on an
 *                                         On-Demand table as DynamoDB is automatically
 *                                         scaling the table.</p>
 *                            </note>
 *                         </li>
 *                         <li>
 *                            <p>Throughput exceeds the current capacity for one or more
 *                                     global secondary indexes. DynamoDB is automatically
 *                                     scaling your index so please try again shortly.</p>
 *                            <note>
 *                               <p>This message is returned when writes get throttled on an
 *                                         On-Demand GSI as DynamoDB is automatically scaling
 *                                         the GSI.</p>
 *                            </note>
 *                         </li>
 *                      </ul>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Validation Error:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>ValidationError</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Messages: </p>
 *                      <ul>
 *                         <li>
 *                            <p>One or more parameter values were invalid.</p>
 *                         </li>
 *                         <li>
 *                            <p>The update expression attempted to update the secondary
 *                                     index key beyond allowed size limits.</p>
 *                         </li>
 *                         <li>
 *                            <p>The update expression attempted to update the secondary
 *                                     index key to unsupported type.</p>
 *                         </li>
 *                         <li>
 *                            <p>An operand in the update expression has an incorrect data
 *                                     type.</p>
 *                         </li>
 *                         <li>
 *                            <p>Item size to update has exceeded the maximum allowed
 *                                     size.</p>
 *                         </li>
 *                         <li>
 *                            <p>Number overflow. Attempting to store a number with
 *                                     magnitude larger than supported range.</p>
 *                         </li>
 *                         <li>
 *                            <p>Type mismatch for attribute to update.</p>
 *                         </li>
 *                         <li>
 *                            <p>Nesting Levels have exceeded supported limits.</p>
 *                         </li>
 *                         <li>
 *                            <p>The document path provided in the update expression is
 *                                     invalid for update.</p>
 *                         </li>
 *                         <li>
 *                            <p>The provided expression refers to an attribute that does
 *                                     not exist in the item.</p>
 *                         </li>
 *                      </ul>
 *                   </li>
 *                </ul>
 *             </li>
 *          </ul>
 * @public
 */
export declare class TransactionCanceledException extends __BaseException {
    readonly name: "TransactionCanceledException";
    readonly $fault: "client";
    Message?: string | undefined;
    /**
     * <p>A list of cancellation reasons.</p>
     * @public
     */
    CancellationReasons?: CancellationReason[] | undefined;
    /**
     * @internal
     */
    constructor(opts: __ExceptionOptionType<TransactionCanceledException, __BaseException>);
}
/**
 * <p>Represents the input of a <code>BatchGetItem</code> operation.</p>
 * @public
 */
export interface BatchGetItemInput {
    /**
     * <p>A map of one or more table names or table ARNs and, for each table, a map that
     *             describes one or more items to retrieve from that table. Each table name or ARN can be
     *             used only once per <code>BatchGetItem</code> request.</p>
     *          <p>Each element in the map of items to retrieve consists of the following:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>ConsistentRead</code> - If <code>true</code>, a strongly consistent read
     *                     is used; if <code>false</code> (the default), an eventually consistent read is
     *                     used.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ExpressionAttributeNames</code> - One or more substitution tokens for
     *                     attribute names in the <code>ProjectionExpression</code> parameter. The
     *                     following are some use cases for using
     *                     <code>ExpressionAttributeNames</code>:</p>
     *                <ul>
     *                   <li>
     *                      <p>To access an attribute whose name conflicts with a DynamoDB reserved
     *                             word.</p>
     *                   </li>
     *                   <li>
     *                      <p>To create a placeholder for repeating occurrences of an attribute name
     *                             in an expression.</p>
     *                   </li>
     *                   <li>
     *                      <p>To prevent special characters in an attribute name from being
     *                             misinterpreted in an expression.</p>
     *                   </li>
     *                </ul>
     *                <p>Use the <b>#</b> character in an expression to
     *                     dereference an attribute name. For example, consider the following attribute
     *                     name:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>Percentile</code>
     *                      </p>
     *                   </li>
     *                </ul>
     *                <p>The name of this attribute conflicts with a reserved word, so it cannot be
     *                     used directly in an expression. (For the complete list of reserved words, see
     *                         <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html">Reserved
     *                         Words</a> in the <i>Amazon DynamoDB Developer Guide</i>).
     *                     To work around this, you could specify the following for
     *                         <code>ExpressionAttributeNames</code>:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>\{"#P":"Percentile"\}</code>
     *                      </p>
     *                   </li>
     *                </ul>
     *                <p>You could then use this substitution in an expression, as in this
     *                     example:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>#P = :val</code>
     *                      </p>
     *                   </li>
     *                </ul>
     *                <note>
     *                   <p>Tokens that begin with the <b>:</b> character
     *                         are <i>expression attribute values</i>, which are placeholders
     *                         for the actual value at runtime.</p>
     *                </note>
     *                <p>For more information about expression attribute names, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Accessing Item Attributes</a> in the <i>Amazon DynamoDB
     *                         Developer Guide</i>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>Keys</code> - An array of primary key attribute values that define
     *                     specific items in the table. For each primary key, you must provide
     *                         <i>all</i> of the key attributes. For example, with a simple
     *                     primary key, you only need to provide the partition key value. For a composite
     *                     key, you must provide <i>both</i> the partition key value and the
     *                     sort key value.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ProjectionExpression</code> - A string that identifies one or more
     *                     attributes to retrieve from the table. These attributes can include scalars,
     *                     sets, or elements of a JSON document. The attributes in the expression must be
     *                     separated by commas.</p>
     *                <p>If no attribute names are specified, then all attributes are returned. If any
     *                     of the requested attributes are not found, they do not appear in the
     *                     result.</p>
     *                <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Accessing Item Attributes</a> in the <i>Amazon DynamoDB
     *                         Developer Guide</i>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>AttributesToGet</code> - This is a legacy parameter. Use
     *                         <code>ProjectionExpression</code> instead. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.AttributesToGet.html">AttributesToGet</a> in the <i>Amazon DynamoDB Developer
     *                         Guide</i>. </p>
     *             </li>
     *          </ul>
     * @public
     */
    RequestItems: Record<string, KeysAndAttributes> | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INDEXES</code> - The response includes the aggregate
     *                         <code>ConsumedCapacity</code> for the operation, together with
     *                         <code>ConsumedCapacity</code> for each table and secondary index that was
     *                     accessed.</p>
     *                <p>Note that some operations, such as <code>GetItem</code> and
     *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
     *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
     *                     information for table(s).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>TOTAL</code> - The response includes only the aggregate
     *                         <code>ConsumedCapacity</code> for the operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
     *                     response.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
}
/**
 * <p>Represents a condition to be compared with an attribute value. This condition can be
 *             used with <code>DeleteItem</code>, <code>PutItem</code>, or <code>UpdateItem</code>
 *             operations; if the comparison evaluates to true, the operation succeeds; if not, the
 *             operation fails. You can use <code>ExpectedAttributeValue</code> in one of two different
 *             ways:</p>
 *          <ul>
 *             <li>
 *                <p>Use <code>AttributeValueList</code> to specify one or more values to compare
 *                     against an attribute. Use <code>ComparisonOperator</code> to specify how you
 *                     want to perform the comparison. If the comparison evaluates to true, then the
 *                     conditional operation succeeds.</p>
 *             </li>
 *             <li>
 *                <p>Use <code>Value</code> to specify a value that DynamoDB will compare against
 *                     an attribute. If the values match, then <code>ExpectedAttributeValue</code>
 *                     evaluates to true and the conditional operation succeeds. Optionally, you can
 *                     also set <code>Exists</code> to false, indicating that you <i>do
 *                         not</i> expect to find the attribute value in the table. In this
 *                     case, the conditional operation succeeds only if the comparison evaluates to
 *                     false.</p>
 *             </li>
 *          </ul>
 *          <p>
 *             <code>Value</code> and <code>Exists</code> are incompatible with
 *                 <code>AttributeValueList</code> and <code>ComparisonOperator</code>. Note that if
 *             you use both sets of parameters at once, DynamoDB will return a
 *                 <code>ValidationException</code> exception.</p>
 * @public
 */
export interface ExpectedAttributeValue {
    /**
     * <p>Represents the data for the expected attribute.</p>
     *          <p>Each attribute value is described as a name-value pair. The name is the data type, and
     *             the value is the data itself.</p>
     *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html#HowItWorks.DataTypes">Data Types</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    Value?: AttributeValue | undefined;
    /**
     * <p>Causes DynamoDB to evaluate the value before attempting a conditional
     *             operation:</p>
     *          <ul>
     *             <li>
     *                <p>If <code>Exists</code> is <code>true</code>, DynamoDB will check to
     *                     see if that attribute value already exists in the table. If it is found, then
     *                     the operation succeeds. If it is not found, the operation fails with a
     *                         <code>ConditionCheckFailedException</code>.</p>
     *             </li>
     *             <li>
     *                <p>If <code>Exists</code> is <code>false</code>, DynamoDB assumes that
     *                     the attribute value does not exist in the table. If in fact the value does not
     *                     exist, then the assumption is valid and the operation succeeds. If the value is
     *                     found, despite the assumption that it does not exist, the operation fails with a
     *                         <code>ConditionCheckFailedException</code>.</p>
     *             </li>
     *          </ul>
     *          <p>The default setting for <code>Exists</code> is <code>true</code>. If you supply a
     *                 <code>Value</code> all by itself, DynamoDB assumes the attribute exists:
     *             You don't have to set <code>Exists</code> to <code>true</code>, because it is
     *             implied.</p>
     *          <p>DynamoDB returns a <code>ValidationException</code> if:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Exists</code> is <code>true</code> but there is no <code>Value</code> to
     *                     check. (You expect a value to exist, but don't specify what that value
     *                     is.)</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>Exists</code> is <code>false</code> but you also provide a
     *                         <code>Value</code>. (You cannot expect an attribute to have a value, while
     *                     also expecting it not to exist.)</p>
     *             </li>
     *          </ul>
     * @public
     */
    Exists?: boolean | undefined;
    /**
     * <p>A comparator for evaluating attributes in the <code>AttributeValueList</code>. For
     *             example, equals, greater than, less than, etc.</p>
     *          <p>The following comparison operators are available:</p>
     *          <p>
     *             <code>EQ | NE | LE | LT | GE | GT | NOT_NULL | NULL | CONTAINS | NOT_CONTAINS |
     *                 BEGINS_WITH | IN | BETWEEN</code>
     *          </p>
     *          <p>The following are descriptions of each comparison operator.</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>EQ</code> : Equal. <code>EQ</code> is supported for all data types,
     *                     including lists and maps.</p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, Binary, String Set, Number Set, or Binary Set.
     *                     If an item contains an <code>AttributeValue</code> element of a different type
     *                     than the one provided in the request, the value does not match. For example,
     *                         <code>\{"S":"6"\}</code> does not equal <code>\{"N":"6"\}</code>. Also,
     *                         <code>\{"N":"6"\}</code> does not equal <code>\{"NS":["6", "2",
     *                     "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NE</code> : Not equal. <code>NE</code> is supported for all data types,
     *                     including lists and maps.</p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     of type String, Number, Binary, String Set, Number Set, or Binary Set. If an
     *                     item contains an <code>AttributeValue</code> of a different type than the one
     *                     provided in the request, the value does not match. For example,
     *                         <code>\{"S":"6"\}</code> does not equal <code>\{"N":"6"\}</code>. Also,
     *                         <code>\{"N":"6"\}</code> does not equal <code>\{"NS":["6", "2",
     *                     "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>LE</code> : Less than or equal. </p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, or Binary (not a set type). If an item contains
     *                     an <code>AttributeValue</code> element of a different type than the one provided
     *                     in the request, the value does not match. For example, <code>\{"S":"6"\}</code>
     *                     does not equal <code>\{"N":"6"\}</code>. Also, <code>\{"N":"6"\}</code> does not
     *                     compare to <code>\{"NS":["6", "2", "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>LT</code> : Less than. </p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     of type String, Number, or Binary (not a set type). If an item contains an
     *                         <code>AttributeValue</code> element of a different type than the one
     *                     provided in the request, the value does not match. For example,
     *                         <code>\{"S":"6"\}</code> does not equal <code>\{"N":"6"\}</code>. Also,
     *                         <code>\{"N":"6"\}</code> does not compare to <code>\{"NS":["6", "2",
     *                         "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>GE</code> : Greater than or equal. </p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, or Binary (not a set type). If an item contains
     *                     an <code>AttributeValue</code> element of a different type than the one provided
     *                     in the request, the value does not match. For example, <code>\{"S":"6"\}</code>
     *                     does not equal <code>\{"N":"6"\}</code>. Also, <code>\{"N":"6"\}</code> does not
     *                     compare to <code>\{"NS":["6", "2", "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>GT</code> : Greater than. </p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, or Binary (not a set type). If an item contains
     *                     an <code>AttributeValue</code> element of a different type than the one provided
     *                     in the request, the value does not match. For example, <code>\{"S":"6"\}</code>
     *                     does not equal <code>\{"N":"6"\}</code>. Also, <code>\{"N":"6"\}</code> does not
     *                     compare to <code>\{"NS":["6", "2", "1"]\}</code>.</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NOT_NULL</code> : The attribute exists. <code>NOT_NULL</code> is supported
     *                     for all data types, including lists and maps.</p>
     *                <note>
     *                   <p>This operator tests for the existence of an attribute, not its data type.
     *                         If the data type of attribute "<code>a</code>" is null, and you evaluate it
     *                         using <code>NOT_NULL</code>, the result is a Boolean <code>true</code>. This
     *                         result is because the attribute "<code>a</code>" exists; its data type is
     *                         not relevant to the <code>NOT_NULL</code> comparison operator.</p>
     *                </note>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NULL</code> : The attribute does not exist. <code>NULL</code> is supported
     *                     for all data types, including lists and maps.</p>
     *                <note>
     *                   <p>This operator tests for the nonexistence of an attribute, not its data
     *                         type. If the data type of attribute "<code>a</code>" is null, and you
     *                         evaluate it using <code>NULL</code>, the result is a Boolean
     *                             <code>false</code>. This is because the attribute "<code>a</code>"
     *                         exists; its data type is not relevant to the <code>NULL</code> comparison
     *                         operator.</p>
     *                </note>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>CONTAINS</code> : Checks for a subsequence, or value in a set.</p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, or Binary (not a set type). If the target
     *                     attribute of the comparison is of type String, then the operator checks for a
     *                     substring match. If the target attribute of the comparison is of type Binary,
     *                     then the operator looks for a subsequence of the target that matches the input.
     *                     If the target attribute of the comparison is a set ("<code>SS</code>",
     *                         "<code>NS</code>", or "<code>BS</code>"), then the operator evaluates to
     *                     true if it finds an exact match with any member of the set.</p>
     *                <p>CONTAINS is supported for lists: When evaluating "<code>a CONTAINS b</code>",
     *                         "<code>a</code>" can be a list; however, "<code>b</code>" cannot be a set, a
     *                     map, or a list.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NOT_CONTAINS</code> : Checks for absence of a subsequence, or absence of a
     *                     value in a set.</p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     element of type String, Number, or Binary (not a set type). If the target
     *                     attribute of the comparison is a String, then the operator checks for the
     *                     absence of a substring match. If the target attribute of the comparison is
     *                     Binary, then the operator checks for the absence of a subsequence of the target
     *                     that matches the input. If the target attribute of the comparison is a set
     *                         ("<code>SS</code>", "<code>NS</code>", or "<code>BS</code>"), then the
     *                     operator evaluates to true if it <i>does not</i> find an exact
     *                     match with any member of the set.</p>
     *                <p>NOT_CONTAINS is supported for lists: When evaluating "<code>a NOT CONTAINS
     *                         b</code>", "<code>a</code>" can be a list; however, "<code>b</code>" cannot
     *                     be a set, a map, or a list.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>BEGINS_WITH</code> : Checks for a prefix. </p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain only one <code>AttributeValue</code>
     *                     of type String or Binary (not a Number or a set type). The target attribute of
     *                     the comparison must be of type String or Binary (not a Number or a set
     *                     type).</p>
     *                <p></p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>IN</code> : Checks for matching elements in a list.</p>
     *                <p>
     *                   <code>AttributeValueList</code> can contain one or more
     *                         <code>AttributeValue</code> elements of type String, Number, or Binary.
     *                     These attributes are compared against an existing attribute of an item. If any
     *                     elements of the input are equal to the item attribute, the expression evaluates
     *                     to true.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>BETWEEN</code> : Greater than or equal to the first value, and less than
     *                     or equal to the second value. </p>
     *                <p>
     *                   <code>AttributeValueList</code> must contain two <code>AttributeValue</code>
     *                     elements of the same type, either String, Number, or Binary (not a set type). A
     *                     target attribute matches if the target value is greater than, or equal to, the
     *                     first element and less than, or equal to, the second element. If an item
     *                     contains an <code>AttributeValue</code> element of a different type than the one
     *                     provided in the request, the value does not match. For example,
     *                         <code>\{"S":"6"\}</code> does not compare to <code>\{"N":"6"\}</code>. Also,
     *                         <code>\{"N":"6"\}</code> does not compare to <code>\{"NS":["6", "2",
     *                         "1"]\}</code>
     *                </p>
     *             </li>
     *          </ul>
     * @public
     */
    ComparisonOperator?: ComparisonOperator | undefined;
    /**
     * <p>One or more values to evaluate against the supplied attribute. The number of values in
     *             the list depends on the <code>ComparisonOperator</code> being used.</p>
     *          <p>For type Number, value comparisons are numeric.</p>
     *          <p>String value comparisons for greater than, equals, or less than are based on ASCII
     *             character code values. For example, <code>a</code> is greater than <code>A</code>, and
     *                 <code>a</code> is greater than <code>B</code>. For a list of code values, see <a href="http://en.wikipedia.org/wiki/ASCII#ASCII_printable_characters">http://en.wikipedia.org/wiki/ASCII#ASCII_printable_characters</a>.</p>
     *          <p>For Binary, DynamoDB treats each byte of the binary data as unsigned when it
     *             compares binary values.</p>
     *          <p>For information on specifying data types in JSON, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DataFormat.html">JSON Data Format</a>
     *             in the <i>Amazon DynamoDB Developer Guide</i>.</p>
     * @public
     */
    AttributeValueList?: AttributeValue[] | undefined;
}
/**
 * @public
 */
export interface TransactGetItemsInput {
    /**
     * <p>An ordered array of up to 100 <code>TransactGetItem</code> objects, each of which
     *             contains a <code>Get</code> structure.</p>
     * @public
     */
    TransactItems: TransactGetItem[] | undefined;
    /**
     * <p>A value of <code>TOTAL</code> causes consumed capacity information to be returned, and
     *             a value of <code>NONE</code> prevents that information from being returned. No other
     *             value is valid.</p>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
}
/**
 * @public
 */
export interface TransactWriteItemsOutput {
    /**
     * <p>The capacity units consumed by the entire <code>TransactWriteItems</code> operation.
     *             The values of the list are ordered according to the ordering of the
     *                 <code>TransactItems</code> request parameter. </p>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity[] | undefined;
    /**
     * <p>A list of tables that were processed by <code>TransactWriteItems</code> and, for each
     *             table, information about any item collections that were affected by individual
     *                 <code>UpdateItem</code>, <code>PutItem</code>, or <code>DeleteItem</code>
     *             operations. </p>
     * @public
     */
    ItemCollectionMetrics?: Record<string, ItemCollectionMetrics[]> | undefined;
}
/**
 * <p>Represents a request to perform a check that an item exists or to check the condition
 *             of specific attributes of the item.</p>
 * @public
 */
export interface ConditionCheck {
    /**
     * <p>The primary key of the item to be checked. Each element consists of an attribute name
     *             and a value for that attribute.</p>
     * @public
     */
    Key: Record<string, AttributeValue> | undefined;
    /**
     * <p>Name of the table for the check item request. You can also provide the Amazon Resource Name (ARN) of
     *             the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>A condition that must be satisfied in order for a conditional update to succeed. For
     *             more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html">Condition expressions</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ConditionExpression: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in an expression. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ExpressionAttributeNames.html">Expression attribute names</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
    /**
     * <p>One or more values that can be substituted in an expression. For more information, see
     *                 <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html">Condition expressions</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
    /**
     * <p>Use <code>ReturnValuesOnConditionCheckFailure</code> to get the item attributes if the
     *                 <code>ConditionCheck</code> condition fails. For
     *                 <code>ReturnValuesOnConditionCheckFailure</code>, the valid values are: NONE and
     *             ALL_OLD.</p>
     * @public
     */
    ReturnValuesOnConditionCheckFailure?: ReturnValuesOnConditionCheckFailure | undefined;
}
/**
 * <p>Represents a request to perform a <code>DeleteItem</code> operation.</p>
 * @public
 */
export interface Delete {
    /**
     * <p>The primary key of the item to be deleted. Each element consists of an attribute name
     *             and a value for that attribute.</p>
     * @public
     */
    Key: Record<string, AttributeValue> | undefined;
    /**
     * <p>Name of the table in which the item to be deleted resides. You can also provide the
     *             Amazon Resource Name (ARN) of the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>A condition that must be satisfied in order for a conditional delete to
     *             succeed.</p>
     * @public
     */
    ConditionExpression?: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in an expression.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
    /**
     * <p>One or more values that can be substituted in an expression.</p>
     * @public
     */
    ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
    /**
     * <p>Use <code>ReturnValuesOnConditionCheckFailure</code> to get the item attributes if the
     *                 <code>Delete</code> condition fails. For
     *                 <code>ReturnValuesOnConditionCheckFailure</code>, the valid values are: NONE and
     *             ALL_OLD.</p>
     * @public
     */
    ReturnValuesOnConditionCheckFailure?: ReturnValuesOnConditionCheckFailure | undefined;
}
/**
 * <p>Represents a request to perform a <code>PutItem</code> operation.</p>
 * @public
 */
export interface Put {
    /**
     * <p>A map of attribute name to attribute values, representing the primary key of the item
     *             to be written by <code>PutItem</code>. All of the table's primary key attributes must be
     *             specified, and their data types must match those of the table's key schema. If any
     *             attributes are present in the item that are part of an index key schema for the table,
     *             their types must match the index key schema. </p>
     * @public
     */
    Item: Record<string, AttributeValue> | undefined;
    /**
     * <p>Name of the table in which to write the item. You can also provide the Amazon Resource Name (ARN) of
     *             the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>A condition that must be satisfied in order for a conditional update to
     *             succeed.</p>
     * @public
     */
    ConditionExpression?: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in an expression.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
    /**
     * <p>One or more values that can be substituted in an expression.</p>
     * @public
     */
    ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
    /**
     * <p>Use <code>ReturnValuesOnConditionCheckFailure</code> to get the item attributes if the
     *                 <code>Put</code> condition fails. For
     *                 <code>ReturnValuesOnConditionCheckFailure</code>, the valid values are: NONE and
     *             ALL_OLD.</p>
     * @public
     */
    ReturnValuesOnConditionCheckFailure?: ReturnValuesOnConditionCheckFailure | undefined;
}
/**
 * <p>Represents a request to perform an <code>UpdateItem</code> operation.</p>
 * @public
 */
export interface Update {
    /**
     * <p>The primary key of the item to be updated. Each element consists of an attribute name
     *             and a value for that attribute.</p>
     * @public
     */
    Key: Record<string, AttributeValue> | undefined;
    /**
     * <p>An expression that defines one or more attributes to be updated, the action to be
     *             performed on them, and new value(s) for them.</p>
     * @public
     */
    UpdateExpression: string | undefined;
    /**
     * <p>Name of the table for the <code>UpdateItem</code> request. You can also provide the
     *             Amazon Resource Name (ARN) of the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>A condition that must be satisfied in order for a conditional update to
     *             succeed.</p>
     * @public
     */
    ConditionExpression?: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in an expression.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
    /**
     * <p>One or more values that can be substituted in an expression.</p>
     * @public
     */
    ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
    /**
     * <p>Use <code>ReturnValuesOnConditionCheckFailure</code> to get the item attributes if the
     *                 <code>Update</code> condition fails. For
     *                 <code>ReturnValuesOnConditionCheckFailure</code>, the valid values are: NONE and
     *             ALL_OLD.</p>
     * @public
     */
    ReturnValuesOnConditionCheckFailure?: ReturnValuesOnConditionCheckFailure | undefined;
}
/**
 * <p> A PartiQL batch statement response.. </p>
 * @public
 */
export interface BatchStatementResponse {
    /**
     * <p> The error associated with a failed PartiQL batch statement. </p>
     * @public
     */
    Error?: BatchStatementError | undefined;
    /**
     * <p> The table name associated with a failed PartiQL batch statement. </p>
     * @public
     */
    TableName?: string | undefined;
    /**
     * <p> A DynamoDB item associated with a BatchStatementResponse </p>
     * @public
     */
    Item?: Record<string, AttributeValue> | undefined;
}
/**
 * <p>Represents the output of a <code>DeleteItem</code> operation.</p>
 * @public
 */
export interface DeleteItemOutput {
    /**
     * <p>A map of attribute names to <code>AttributeValue</code> objects, representing the item
     *             as it appeared before the <code>DeleteItem</code> operation. This map appears in the
     *             response only if <code>ReturnValues</code> was specified as <code>ALL_OLD</code> in the
     *             request.</p>
     * @public
     */
    Attributes?: Record<string, AttributeValue> | undefined;
    /**
     * <p>The capacity units consumed by the <code>DeleteItem</code> operation. The data
     *             returned includes the total provisioned throughput consumed, along with statistics for
     *             the table and any indexes involved in the operation. <code>ConsumedCapacity</code> is
     *             only returned if the <code>ReturnConsumedCapacity</code> parameter was specified. For
     *             more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/provisioned-capacity-mode.html">Provisioned capacity mode</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity | undefined;
    /**
     * <p>Information about item collections, if any, that were affected by the
     *                 <code>DeleteItem</code> operation. <code>ItemCollectionMetrics</code> is only
     *             returned if the <code>ReturnItemCollectionMetrics</code> parameter was specified. If the
     *             table does not have any local secondary indexes, this information is not returned in the
     *             response.</p>
     *          <p>Each <code>ItemCollectionMetrics</code> element consists of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>ItemCollectionKey</code> - The partition key value of the item collection.
     *                     This is the same as the partition key value of the item itself.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>SizeEstimateRangeGB</code> - An estimate of item collection size, in
     *                     gigabytes. This value is a two-element array containing a lower bound and an
     *                     upper bound for the estimate. The estimate includes the size of all the items in
     *                     the table, plus the size of all attributes projected into all of the local
     *                     secondary indexes on that table. Use this estimate to measure whether a local
     *                     secondary index is approaching its size limit.</p>
     *                <p>The estimate is subject to change over time; therefore, do not rely on the
     *                     precision or accuracy of the estimate.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ItemCollectionMetrics?: ItemCollectionMetrics | undefined;
}
/**
 * @public
 */
export interface ExecuteStatementOutput {
    /**
     * <p>If a read operation was used, this property will contain the result of the read
     *             operation; a map of attribute names and their values. For the write operations this
     *             value will be empty.</p>
     * @public
     */
    Items?: Record<string, AttributeValue>[] | undefined;
    /**
     * <p>If the response of a read request exceeds the response payload limit DynamoDB will set
     *             this value in the response. If set, you can use that this value in the subsequent
     *             request to get the remaining results.</p>
     * @public
     */
    NextToken?: string | undefined;
    /**
     * <p>The capacity units consumed by an operation. The data returned includes the total
     *             provisioned throughput consumed, along with statistics for the table and any indexes
     *             involved in the operation. <code>ConsumedCapacity</code> is only returned if the request
     *             asked for it. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/provisioned-capacity-mode.html">Provisioned capacity mode</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity | undefined;
    /**
     * <p>The primary key of the item where the operation stopped, inclusive of the previous
     *             result set. Use this value to start a new operation, excluding this value in the new
     *             request. If <code>LastEvaluatedKey</code> is empty, then the "last page" of results has
     *             been processed and there is no more data to be retrieved. If
     *                 <code>LastEvaluatedKey</code> is not empty, it does not necessarily mean that there
     *             is more data in the result set. The only way to know when you have reached the end of
     *             the result set is when <code>LastEvaluatedKey</code> is empty. </p>
     * @public
     */
    LastEvaluatedKey?: Record<string, AttributeValue> | undefined;
}
/**
 * <p>Represents the output of a <code>PutItem</code> operation.</p>
 * @public
 */
export interface PutItemOutput {
    /**
     * <p>The attribute values as they appeared before the <code>PutItem</code> operation, but
     *             only if <code>ReturnValues</code> is specified as <code>ALL_OLD</code> in the request.
     *             Each element consists of an attribute name and an attribute value.</p>
     * @public
     */
    Attributes?: Record<string, AttributeValue> | undefined;
    /**
     * <p>The capacity units consumed by the <code>PutItem</code> operation. The data returned
     *             includes the total provisioned throughput consumed, along with statistics for the table
     *             and any indexes involved in the operation. <code>ConsumedCapacity</code> is only
     *             returned if the <code>ReturnConsumedCapacity</code> parameter was specified. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/read-write-operations.html#write-operation-consumption">Capacity unity consumption for write operations</a> in the <i>Amazon
     *                 DynamoDB Developer Guide</i>.</p>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity | undefined;
    /**
     * <p>Information about item collections, if any, that were affected by the
     *                 <code>PutItem</code> operation. <code>ItemCollectionMetrics</code> is only returned
     *             if the <code>ReturnItemCollectionMetrics</code> parameter was specified. If the table
     *             does not have any local secondary indexes, this information is not returned in the
     *             response.</p>
     *          <p>Each <code>ItemCollectionMetrics</code> element consists of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>ItemCollectionKey</code> - The partition key value of the item collection.
     *                     This is the same as the partition key value of the item itself.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>SizeEstimateRangeGB</code> - An estimate of item collection size, in
     *                     gigabytes. This value is a two-element array containing a lower bound and an
     *                     upper bound for the estimate. The estimate includes the size of all the items in
     *                     the table, plus the size of all attributes projected into all of the local
     *                     secondary indexes on that table. Use this estimate to measure whether a local
     *                     secondary index is approaching its size limit.</p>
     *                <p>The estimate is subject to change over time; therefore, do not rely on the
     *                     precision or accuracy of the estimate.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ItemCollectionMetrics?: ItemCollectionMetrics | undefined;
}
/**
 * <p>Represents the output of a <code>Query</code> operation.</p>
 * @public
 */
export interface QueryOutput {
    /**
     * <p>An array of item attributes that match the query criteria. Each element in this array
     *             consists of an attribute name and the value for that attribute.</p>
     * @public
     */
    Items?: Record<string, AttributeValue>[] | undefined;
    /**
     * <p>The number of items in the response.</p>
     *          <p>If you used a <code>QueryFilter</code> in the request, then <code>Count</code> is the
     *             number of items returned after the filter was applied, and <code>ScannedCount</code> is
     *             the number of matching items before the filter was applied.</p>
     *          <p>If you did not use a filter in the request, then <code>Count</code> and
     *                 <code>ScannedCount</code> are the same.</p>
     * @public
     */
    Count?: number | undefined;
    /**
     * <p>The number of items evaluated, before any <code>QueryFilter</code> is applied. A high
     *                 <code>ScannedCount</code> value with few, or no, <code>Count</code> results
     *             indicates an inefficient <code>Query</code> operation. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html#Scan.Count">Count and ScannedCount</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     *          <p>If you did not use a filter in the request, then <code>ScannedCount</code> is the same
     *             as <code>Count</code>.</p>
     * @public
     */
    ScannedCount?: number | undefined;
    /**
     * <p>The primary key of the item where the operation stopped, inclusive of the previous
     *             result set. Use this value to start a new operation, excluding this value in the new
     *             request.</p>
     *          <p>If <code>LastEvaluatedKey</code> is empty, then the "last page" of results has been
     *             processed and there is no more data to be retrieved.</p>
     *          <p>If <code>LastEvaluatedKey</code> is not empty, it does not necessarily mean that there
     *             is more data in the result set. The only way to know when you have reached the end of
     *             the result set is when <code>LastEvaluatedKey</code> is empty.</p>
     * @public
     */
    LastEvaluatedKey?: Record<string, AttributeValue> | undefined;
    /**
     * <p>The capacity units consumed by the <code>Query</code> operation. The data returned
     *             includes the total provisioned throughput consumed, along with statistics for the table
     *             and any indexes involved in the operation. <code>ConsumedCapacity</code> is only
     *             returned if the <code>ReturnConsumedCapacity</code> parameter was specified. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/read-write-operations.html#read-operation-consumption">Capacity unit consumption for read operations</a> in the <i>Amazon
     *                 DynamoDB Developer Guide</i>.</p>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity | undefined;
}
/**
 * <p>Represents the output of a <code>Scan</code> operation.</p>
 * @public
 */
export interface ScanOutput {
    /**
     * <p>An array of item attributes that match the scan criteria. Each element in this array
     *             consists of an attribute name and the value for that attribute.</p>
     * @public
     */
    Items?: Record<string, AttributeValue>[] | undefined;
    /**
     * <p>The number of items in the response.</p>
     *          <p>If you set <code>ScanFilter</code> in the request, then <code>Count</code> is the
     *             number of items returned after the filter was applied, and <code>ScannedCount</code> is
     *             the number of matching items before the filter was applied.</p>
     *          <p>If you did not use a filter in the request, then <code>Count</code> is the same as
     *                 <code>ScannedCount</code>.</p>
     * @public
     */
    Count?: number | undefined;
    /**
     * <p>The number of items evaluated, before any <code>ScanFilter</code> is applied. A high
     *                 <code>ScannedCount</code> value with few, or no, <code>Count</code> results
     *             indicates an inefficient <code>Scan</code> operation. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/QueryAndScan.html#Count">Count and
     *                 ScannedCount</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     *          <p>If you did not use a filter in the request, then <code>ScannedCount</code> is the same
     *             as <code>Count</code>.</p>
     * @public
     */
    ScannedCount?: number | undefined;
    /**
     * <p>The primary key of the item where the operation stopped, inclusive of the previous
     *             result set. Use this value to start a new operation, excluding this value in the new
     *             request.</p>
     *          <p>If <code>LastEvaluatedKey</code> is empty, then the "last page" of results has been
     *             processed and there is no more data to be retrieved.</p>
     *          <p>If <code>LastEvaluatedKey</code> is not empty, it does not necessarily mean that there
     *             is more data in the result set. The only way to know when you have reached the end of
     *             the result set is when <code>LastEvaluatedKey</code> is empty.</p>
     * @public
     */
    LastEvaluatedKey?: Record<string, AttributeValue> | undefined;
    /**
     * <p>The capacity units consumed by the <code>Scan</code> operation. The data returned
     *             includes the total provisioned throughput consumed, along with statistics for the table
     *             and any indexes involved in the operation. <code>ConsumedCapacity</code> is only
     *             returned if the <code>ReturnConsumedCapacity</code> parameter was specified. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/read-write-operations.html#read-operation-consumption">Capacity unit consumption for read operations</a> in the <i>Amazon
     *                 DynamoDB Developer Guide</i>.</p>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity | undefined;
}
/**
 * <p>Represents the output of an <code>UpdateItem</code> operation.</p>
 * @public
 */
export interface UpdateItemOutput {
    /**
     * <p>A map of attribute values as they appear before or after the <code>UpdateItem</code>
     *             operation, as determined by the <code>ReturnValues</code> parameter.</p>
     *          <p>The <code>Attributes</code> map is only present if the update was successful and
     *                 <code>ReturnValues</code> was specified as something other than <code>NONE</code> in
     *             the request. Each element represents one attribute.</p>
     * @public
     */
    Attributes?: Record<string, AttributeValue> | undefined;
    /**
     * <p>The capacity units consumed by the <code>UpdateItem</code> operation. The data
     *             returned includes the total provisioned throughput consumed, along with statistics for
     *             the table and any indexes involved in the operation. <code>ConsumedCapacity</code> is
     *             only returned if the <code>ReturnConsumedCapacity</code> parameter was specified. For
     *             more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/read-write-operations.html#write-operation-consumption">Capacity unity consumption for write operations</a> in the <i>Amazon
     *                 DynamoDB Developer Guide</i>.</p>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity | undefined;
    /**
     * <p>Information about item collections, if any, that were affected by the
     *                 <code>UpdateItem</code> operation. <code>ItemCollectionMetrics</code> is only
     *             returned if the <code>ReturnItemCollectionMetrics</code> parameter was specified. If the
     *             table does not have any local secondary indexes, this information is not returned in the
     *             response.</p>
     *          <p>Each <code>ItemCollectionMetrics</code> element consists of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>ItemCollectionKey</code> - The partition key value of the item collection.
     *                     This is the same as the partition key value of the item itself.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>SizeEstimateRangeGB</code> - An estimate of item collection size, in
     *                     gigabytes. This value is a two-element array containing a lower bound and an
     *                     upper bound for the estimate. The estimate includes the size of all the items in
     *                     the table, plus the size of all attributes projected into all of the local
     *                     secondary indexes on that table. Use this estimate to measure whether a local
     *                     secondary index is approaching its size limit.</p>
     *                <p>The estimate is subject to change over time; therefore, do not rely on the
     *                     precision or accuracy of the estimate.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ItemCollectionMetrics?: ItemCollectionMetrics | undefined;
}
/**
 * <p>Represents an operation to perform - either <code>DeleteItem</code> or
 *                 <code>PutItem</code>. You can only request one of these operations, not both, in a
 *             single <code>WriteRequest</code>. If you do need to perform both of these operations,
 *             you need to provide two separate <code>WriteRequest</code> objects.</p>
 * @public
 */
export interface WriteRequest {
    /**
     * <p>A request to perform a <code>PutItem</code> operation.</p>
     * @public
     */
    PutRequest?: PutRequest | undefined;
    /**
     * <p>A request to perform a <code>DeleteItem</code> operation.</p>
     * @public
     */
    DeleteRequest?: DeleteRequest | undefined;
}
/**
 * @public
 */
export interface BatchExecuteStatementOutput {
    /**
     * <p>The response to each PartiQL statement in the batch. The values of the list are
     *             ordered according to the ordering of the request statements.</p>
     * @public
     */
    Responses?: BatchStatementResponse[] | undefined;
    /**
     * <p>The capacity units consumed by the entire operation. The values of the list are
     *             ordered according to the ordering of the statements.</p>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity[] | undefined;
}
/**
 * <p>Represents the output of a <code>BatchGetItem</code> operation.</p>
 * @public
 */
export interface BatchGetItemOutput {
    /**
     * <p>A map of table name or table ARN to a list of items. Each object in
     *                 <code>Responses</code> consists of a table name or ARN, along with a map of
     *             attribute data consisting of the data type and attribute value.</p>
     * @public
     */
    Responses?: Record<string, Record<string, AttributeValue>[]> | undefined;
    /**
     * <p>A map of tables and their respective keys that were not processed with the current
     *             response. The <code>UnprocessedKeys</code> value is in the same form as
     *                 <code>RequestItems</code>, so the value can be provided directly to a subsequent
     *                 <code>BatchGetItem</code> operation. For more information, see
     *                 <code>RequestItems</code> in the Request Parameters section.</p>
     *          <p>Each element consists of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Keys</code> - An array of primary key attribute values that define
     *                     specific items in the table.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ProjectionExpression</code> - One or more attributes to be retrieved from
     *                     the table or index. By default, all attributes are returned. If a requested
     *                     attribute is not found, it does not appear in the result.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ConsistentRead</code> - The consistency of a read operation. If set to
     *                         <code>true</code>, then a strongly consistent read is used; otherwise, an
     *                     eventually consistent read is used.</p>
     *             </li>
     *          </ul>
     *          <p>If there are no unprocessed keys remaining, the response contains an empty
     *                 <code>UnprocessedKeys</code> map.</p>
     * @public
     */
    UnprocessedKeys?: Record<string, KeysAndAttributes> | undefined;
    /**
     * <p>The read capacity units consumed by the entire <code>BatchGetItem</code>
     *             operation.</p>
     *          <p>Each element consists of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>TableName</code> - The table that consumed the provisioned
     *                     throughput.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>CapacityUnits</code> - The total number of capacity units consumed.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity[] | undefined;
}
/**
 * <p>Represents the input of a <code>Scan</code> operation.</p>
 * @public
 */
export interface ScanInput {
    /**
     * <p>The name of the table containing the requested items or if you provide
     *                 <code>IndexName</code>, the name of the table to which that index belongs.</p>
     *          <p>You can also provide the Amazon Resource Name (ARN) of the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>The name of a secondary index to scan. This index can be any local secondary index or
     *             global secondary index. Note that if you use the <code>IndexName</code> parameter, you
     *             must also provide <code>TableName</code>.</p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>ProjectionExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.AttributesToGet.html">AttributesToGet</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    AttributesToGet?: string[] | undefined;
    /**
     * <p>The maximum number of items to evaluate (not necessarily the number of matching
     *             items). If DynamoDB processes the number of items up to the limit while processing the
     *             results, it stops the operation and returns the matching values up to that point, and a
     *             key in <code>LastEvaluatedKey</code> to apply in a subsequent operation, so that you can
     *             pick up where you left off. Also, if the processed dataset size exceeds 1 MB before
     *             DynamoDB reaches this limit, it stops the operation and returns the matching values up
     *             to the limit, and a key in <code>LastEvaluatedKey</code> to apply in a subsequent
     *             operation to continue the operation. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/QueryAndScan.html">Working with Queries</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    Limit?: number | undefined;
    /**
     * <p>The attributes to be returned in the result. You can retrieve all item attributes,
     *             specific item attributes, the count of matching items, or in the case of an index, some
     *             or all of the attributes projected into the index.</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>ALL_ATTRIBUTES</code> - Returns all of the item attributes from the
     *                     specified table or index. If you query a local secondary index, then for each
     *                     matching item in the index, DynamoDB fetches the entire item from the parent
     *                     table. If the index is configured to project all item attributes, then all of
     *                     the data can be obtained from the local secondary index, and no fetching is
     *                     required.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ALL_PROJECTED_ATTRIBUTES</code> - Allowed only when querying an index.
     *                     Retrieves all attributes that have been projected into the index. If the index
     *                     is configured to project all attributes, this return value is equivalent to
     *                     specifying <code>ALL_ATTRIBUTES</code>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>COUNT</code> - Returns the number of matching items, rather than the
     *                     matching items themselves. Note that this uses the same quantity of read
     *                     capacity units as getting the items, and is subject to the same item size
     *                     calculations.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>SPECIFIC_ATTRIBUTES</code> - Returns only the attributes listed in
     *                         <code>ProjectionExpression</code>. This return value is equivalent to
     *                     specifying <code>ProjectionExpression</code> without specifying any value for
     *                         <code>Select</code>.</p>
     *                <p>If you query or scan a local secondary index and request only attributes that
     *                     are projected into that index, the operation reads only the index and not the
     *                     table. If any of the requested attributes are not projected into the local
     *                     secondary index, DynamoDB fetches each of these attributes from the parent
     *                     table. This extra fetching incurs additional throughput cost and latency.</p>
     *                <p>If you query or scan a global secondary index, you can only request attributes
     *                     that are projected into the index. Global secondary index queries cannot fetch
     *                     attributes from the parent table.</p>
     *             </li>
     *          </ul>
     *          <p>If neither <code>Select</code> nor <code>ProjectionExpression</code> are specified,
     *             DynamoDB defaults to <code>ALL_ATTRIBUTES</code> when accessing a table, and
     *                 <code>ALL_PROJECTED_ATTRIBUTES</code> when accessing an index. You cannot use both
     *                 <code>Select</code> and <code>ProjectionExpression</code> together in a single
     *             request, unless the value for <code>Select</code> is <code>SPECIFIC_ATTRIBUTES</code>.
     *             (This usage is equivalent to specifying <code>ProjectionExpression</code> without any
     *             value for <code>Select</code>.)</p>
     *          <note>
     *             <p>If you use the <code>ProjectionExpression</code> parameter, then the value for
     *                     <code>Select</code> can only be <code>SPECIFIC_ATTRIBUTES</code>. Any other
     *                 value for <code>Select</code> will return an error.</p>
     *          </note>
     * @public
     */
    Select?: Select | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>FilterExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.ScanFilter.html">ScanFilter</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    ScanFilter?: Record<string, Condition> | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>FilterExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.ConditionalOperator.html">ConditionalOperator</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ConditionalOperator?: ConditionalOperator | undefined;
    /**
     * <p>The primary key of the first item that this operation will evaluate. Use the value
     *             that was returned for <code>LastEvaluatedKey</code> in the previous operation.</p>
     *          <p>The data type for <code>ExclusiveStartKey</code> must be String, Number or Binary. No
     *             set data types are allowed.</p>
     *          <p>In a parallel scan, a <code>Scan</code> request that includes
     *                 <code>ExclusiveStartKey</code> must specify the same segment whose previous
     *                 <code>Scan</code> returned the corresponding value of
     *             <code>LastEvaluatedKey</code>.</p>
     * @public
     */
    ExclusiveStartKey?: Record<string, AttributeValue> | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INDEXES</code> - The response includes the aggregate
     *                         <code>ConsumedCapacity</code> for the operation, together with
     *                         <code>ConsumedCapacity</code> for each table and secondary index that was
     *                     accessed.</p>
     *                <p>Note that some operations, such as <code>GetItem</code> and
     *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
     *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
     *                     information for table(s).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>TOTAL</code> - The response includes only the aggregate
     *                         <code>ConsumedCapacity</code> for the operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
     *                     response.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
    /**
     * <p>For a parallel <code>Scan</code> request, <code>TotalSegments</code> represents the
     *             total number of segments into which the <code>Scan</code> operation will be divided. The
     *             value of <code>TotalSegments</code> corresponds to the number of application workers
     *             that will perform the parallel scan. For example, if you want to use four application
     *             threads to scan a table or an index, specify a <code>TotalSegments</code> value of
     *             4.</p>
     *          <p>The value for <code>TotalSegments</code> must be greater than or equal to 1, and less
     *             than or equal to 1000000. If you specify a <code>TotalSegments</code> value of 1, the
     *                 <code>Scan</code> operation will be sequential rather than parallel.</p>
     *          <p>If you specify <code>TotalSegments</code>, you must also specify
     *             <code>Segment</code>.</p>
     * @public
     */
    TotalSegments?: number | undefined;
    /**
     * <p>For a parallel <code>Scan</code> request, <code>Segment</code> identifies an
     *             individual segment to be scanned by an application worker.</p>
     *          <p>Segment IDs are zero-based, so the first segment is always 0. For example, if you want
     *             to use four application threads to scan a table or an index, then the first thread
     *             specifies a <code>Segment</code> value of 0, the second thread specifies 1, and so
     *             on.</p>
     *          <p>The value of <code>LastEvaluatedKey</code> returned from a parallel <code>Scan</code>
     *             request must be used as <code>ExclusiveStartKey</code> with the same segment ID in a
     *             subsequent <code>Scan</code> operation.</p>
     *          <p>The value for <code>Segment</code> must be greater than or equal to 0, and less than
     *             the value provided for <code>TotalSegments</code>.</p>
     *          <p>If you provide <code>Segment</code>, you must also provide
     *             <code>TotalSegments</code>.</p>
     * @public
     */
    Segment?: number | undefined;
    /**
     * <p>A string that identifies one or more attributes to retrieve from the specified table
     *             or index. These attributes can include scalars, sets, or elements of a JSON document.
     *             The attributes in the expression must be separated by commas.</p>
     *          <p>If no attribute names are specified, then all attributes will be returned. If any of
     *             the requested attributes are not found, they will not appear in the result.</p>
     *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Specifying Item Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ProjectionExpression?: string | undefined;
    /**
     * <p>A string that contains conditions that DynamoDB applies after the <code>Scan</code>
     *             operation, but before the data is returned to you. Items that do not satisfy the
     *                 <code>FilterExpression</code> criteria are not returned.</p>
     *          <note>
     *             <p>A <code>FilterExpression</code> is applied after the items have already been read;
     *                 the process of filtering does not consume any additional read capacity units.</p>
     *          </note>
     *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html#Scan.FilterExpression">Filter
     *                 Expressions</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    FilterExpression?: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in an expression. The following
     *             are some use cases for using <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>To access an attribute whose name conflicts with a DynamoDB reserved
     *                     word.</p>
     *             </li>
     *             <li>
     *                <p>To create a placeholder for repeating occurrences of an attribute name in an
     *                     expression.</p>
     *             </li>
     *             <li>
     *                <p>To prevent special characters in an attribute name from being misinterpreted
     *                     in an expression.</p>
     *             </li>
     *          </ul>
     *          <p>Use the <b>#</b> character in an expression to dereference
     *             an attribute name. For example, consider the following attribute name:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Percentile</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>The name of this attribute conflicts with a reserved word, so it cannot be used
     *             directly in an expression. (For the complete list of reserved words, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html">Reserved Words</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>). To work around this, you could specify the following for
     *                 <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>\{"#P":"Percentile"\}</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>You could then use this substitution in an expression, as in this example:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>#P = :val</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>Tokens that begin with the <b>:</b> character are
     *                     <i>expression attribute values</i>, which are placeholders for the
     *                 actual value at runtime.</p>
     *          </note>
     *          <p>For more information on expression attribute names, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Specifying Item Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
    /**
     * <p>One or more values that can be substituted in an expression.</p>
     *          <p>Use the <b>:</b> (colon) character in an expression to
     *             dereference an attribute value. For example, suppose that you wanted to check whether
     *             the value of the <code>ProductStatus</code> attribute was one of the following: </p>
     *          <p>
     *             <code>Available | Backordered | Discontinued</code>
     *          </p>
     *          <p>You would first need to specify <code>ExpressionAttributeValues</code> as
     *             follows:</p>
     *          <p>
     *             <code>\{ ":avail":\{"S":"Available"\}, ":back":\{"S":"Backordered"\},
     *                 ":disc":\{"S":"Discontinued"\} \}</code>
     *          </p>
     *          <p>You could then use these values in an expression, such as this:</p>
     *          <p>
     *             <code>ProductStatus IN (:avail, :back, :disc)</code>
     *          </p>
     *          <p>For more information on expression attribute values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.SpecifyingConditions.html">Condition Expressions</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
    /**
     * <p>A Boolean value that determines the read consistency model during the scan:</p>
     *          <ul>
     *             <li>
     *                <p>If <code>ConsistentRead</code> is <code>false</code>, then the data returned
     *                     from <code>Scan</code> might not contain the results from other recently
     *                     completed write operations (<code>PutItem</code>, <code>UpdateItem</code>, or
     *                         <code>DeleteItem</code>).</p>
     *             </li>
     *             <li>
     *                <p>If <code>ConsistentRead</code> is <code>true</code>, then all of the write
     *                     operations that completed before the <code>Scan</code> began are guaranteed to
     *                     be contained in the <code>Scan</code> response.</p>
     *             </li>
     *          </ul>
     *          <p>The default setting for <code>ConsistentRead</code> is <code>false</code>.</p>
     *          <p>The <code>ConsistentRead</code> parameter is not supported on global secondary
     *             indexes. If you scan a global secondary index with <code>ConsistentRead</code> set to
     *             true, you will receive a <code>ValidationException</code>.</p>
     * @public
     */
    ConsistentRead?: boolean | undefined;
}
/**
 * <p>Represents the input of a <code>BatchWriteItem</code> operation.</p>
 * @public
 */
export interface BatchWriteItemInput {
    /**
     * <p>A map of one or more table names or table ARNs and, for each table, a list of
     *             operations to be performed (<code>DeleteRequest</code> or <code>PutRequest</code>). Each
     *             element in the map consists of the following:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>DeleteRequest</code> - Perform a <code>DeleteItem</code> operation on the
     *                     specified item. The item to be deleted is identified by a <code>Key</code>
     *                     subelement:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>Key</code> - A map of primary key attribute values that uniquely
     *                             identify the item. Each entry in this map consists of an attribute name
     *                             and an attribute value. For each primary key, you must provide
     *                                 <i>all</i> of the key attributes. For example, with a
     *                             simple primary key, you only need to provide a value for the partition
     *                             key. For a composite primary key, you must provide values for
     *                                 <i>both</i> the partition key and the sort key.</p>
     *                   </li>
     *                </ul>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>PutRequest</code> - Perform a <code>PutItem</code> operation on the
     *                     specified item. The item to be put is identified by an <code>Item</code>
     *                     subelement:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>Item</code> - A map of attributes and their values. Each entry in
     *                             this map consists of an attribute name and an attribute value. Attribute
     *                             values must not be null; string and binary type attributes must have
     *                             lengths greater than zero; and set type attributes must not be empty.
     *                             Requests that contain empty values are rejected with a
     *                                 <code>ValidationException</code> exception.</p>
     *                      <p>If you specify any attributes that are part of an index key, then the
     *                             data types for those attributes must match those of the schema in the
     *                             table's attribute definition.</p>
     *                   </li>
     *                </ul>
     *             </li>
     *          </ul>
     * @public
     */
    RequestItems: Record<string, WriteRequest[]> | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INDEXES</code> - The response includes the aggregate
     *                         <code>ConsumedCapacity</code> for the operation, together with
     *                         <code>ConsumedCapacity</code> for each table and secondary index that was
     *                     accessed.</p>
     *                <p>Note that some operations, such as <code>GetItem</code> and
     *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
     *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
     *                     information for table(s).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>TOTAL</code> - The response includes only the aggregate
     *                         <code>ConsumedCapacity</code> for the operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
     *                     response.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
    /**
     * <p>Determines whether item collection metrics are returned. If set to <code>SIZE</code>,
     *             the response includes statistics about item collections, if any, that were modified
     *             during the operation are returned in the response. If set to <code>NONE</code> (the
     *             default), no statistics are returned.</p>
     * @public
     */
    ReturnItemCollectionMetrics?: ReturnItemCollectionMetrics | undefined;
}
/**
 * <p>Represents the input of a <code>DeleteItem</code> operation.</p>
 * @public
 */
export interface DeleteItemInput {
    /**
     * <p>The name of the table from which to delete the item. You can also provide the
     *             Amazon Resource Name (ARN) of the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>A map of attribute names to <code>AttributeValue</code> objects, representing the
     *             primary key of the item to delete.</p>
     *          <p>For the primary key, you must provide all of the key attributes. For example, with a
     *             simple primary key, you only need to provide a value for the partition key. For a
     *             composite primary key, you must provide values for both the partition key and the sort
     *             key.</p>
     * @public
     */
    Key: Record<string, AttributeValue> | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>ConditionExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.Expected.html">Expected</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    Expected?: Record<string, ExpectedAttributeValue> | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>ConditionExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.ConditionalOperator.html">ConditionalOperator</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ConditionalOperator?: ConditionalOperator | undefined;
    /**
     * <p>Use <code>ReturnValues</code> if you want to get the item attributes as they appeared
     *             before they were deleted. For <code>DeleteItem</code>, the valid values are:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - If <code>ReturnValues</code> is not specified, or if its
     *                     value is <code>NONE</code>, then nothing is returned. (This setting is the
     *                     default for <code>ReturnValues</code>.)</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ALL_OLD</code> - The content of the old item is returned.</p>
     *             </li>
     *          </ul>
     *          <p>There is no additional cost associated with requesting a return value aside from the
     *             small network and processing overhead of receiving a larger response. No read capacity
     *             units are consumed.</p>
     *          <note>
     *             <p>The <code>ReturnValues</code> parameter is used by several DynamoDB operations;
     *                 however, <code>DeleteItem</code> does not recognize any values other than
     *                     <code>NONE</code> or <code>ALL_OLD</code>.</p>
     *          </note>
     * @public
     */
    ReturnValues?: ReturnValue | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INDEXES</code> - The response includes the aggregate
     *                         <code>ConsumedCapacity</code> for the operation, together with
     *                         <code>ConsumedCapacity</code> for each table and secondary index that was
     *                     accessed.</p>
     *                <p>Note that some operations, such as <code>GetItem</code> and
     *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
     *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
     *                     information for table(s).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>TOTAL</code> - The response includes only the aggregate
     *                         <code>ConsumedCapacity</code> for the operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
     *                     response.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
    /**
     * <p>Determines whether item collection metrics are returned. If set to <code>SIZE</code>,
     *             the response includes statistics about item collections, if any, that were modified
     *             during the operation are returned in the response. If set to <code>NONE</code> (the
     *             default), no statistics are returned.</p>
     * @public
     */
    ReturnItemCollectionMetrics?: ReturnItemCollectionMetrics | undefined;
    /**
     * <p>A condition that must be satisfied in order for a conditional <code>DeleteItem</code>
     *             to succeed.</p>
     *          <p>An expression can contain any of the following:</p>
     *          <ul>
     *             <li>
     *                <p>Functions: <code>attribute_exists | attribute_not_exists | attribute_type |
     *                         contains | begins_with | size</code>
     *                </p>
     *                <p>These function names are case-sensitive.</p>
     *             </li>
     *             <li>
     *                <p>Comparison operators: <code>= | <> |
     *             < | > | <= | >= |
     *             BETWEEN | IN </code>
     *                </p>
     *             </li>
     *             <li>
     *                <p> Logical operators: <code>AND | OR | NOT</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>For more information about condition expressions, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.SpecifyingConditions.html">Condition Expressions</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ConditionExpression?: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in an expression. The following
     *             are some use cases for using <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>To access an attribute whose name conflicts with a DynamoDB reserved
     *                     word.</p>
     *             </li>
     *             <li>
     *                <p>To create a placeholder for repeating occurrences of an attribute name in an
     *                     expression.</p>
     *             </li>
     *             <li>
     *                <p>To prevent special characters in an attribute name from being misinterpreted
     *                     in an expression.</p>
     *             </li>
     *          </ul>
     *          <p>Use the <b>#</b> character in an expression to dereference
     *             an attribute name. For example, consider the following attribute name:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Percentile</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>The name of this attribute conflicts with a reserved word, so it cannot be used
     *             directly in an expression. (For the complete list of reserved words, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html">Reserved Words</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>). To work around this, you could specify the following for
     *                 <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>\{"#P":"Percentile"\}</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>You could then use this substitution in an expression, as in this example:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>#P = :val</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>Tokens that begin with the <b>:</b> character are
     *                     <i>expression attribute values</i>, which are placeholders for the
     *                 actual value at runtime.</p>
     *          </note>
     *          <p>For more information on expression attribute names, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Specifying Item Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
    /**
     * <p>One or more values that can be substituted in an expression.</p>
     *          <p>Use the <b>:</b> (colon) character in an expression to
     *             dereference an attribute value. For example, suppose that you wanted to check whether
     *             the value of the <i>ProductStatus</i> attribute was one of the following: </p>
     *          <p>
     *             <code>Available | Backordered | Discontinued</code>
     *          </p>
     *          <p>You would first need to specify <code>ExpressionAttributeValues</code> as
     *             follows:</p>
     *          <p>
     *             <code>\{ ":avail":\{"S":"Available"\}, ":back":\{"S":"Backordered"\},
     *                 ":disc":\{"S":"Discontinued"\} \}</code>
     *          </p>
     *          <p>You could then use these values in an expression, such as this:</p>
     *          <p>
     *             <code>ProductStatus IN (:avail, :back, :disc)</code>
     *          </p>
     *          <p>For more information on expression attribute values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.SpecifyingConditions.html">Condition Expressions</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
    /**
     * <p>An optional parameter that returns the item attributes for a <code>DeleteItem</code>
     *             operation that failed a condition check.</p>
     *          <p>There is no additional cost associated with requesting a return value aside from the
     *             small network and processing overhead of receiving a larger response. No read capacity
     *             units are consumed.</p>
     * @public
     */
    ReturnValuesOnConditionCheckFailure?: ReturnValuesOnConditionCheckFailure | undefined;
}
/**
 * <p>Represents the input of a <code>PutItem</code> operation.</p>
 * @public
 */
export interface PutItemInput {
    /**
     * <p>The name of the table to contain the item. You can also provide the Amazon Resource Name (ARN) of the
     *             table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>A map of attribute name/value pairs, one for each attribute. Only the primary key
     *             attributes are required; you can optionally provide other attribute name-value pairs for
     *             the item.</p>
     *          <p>You must provide all of the attributes for the primary key. For example, with a simple
     *             primary key, you only need to provide a value for the partition key. For a composite
     *             primary key, you must provide both values for both the partition key and the sort
     *             key.</p>
     *          <p>If you specify any attributes that are part of an index key, then the data types for
     *             those attributes must match those of the schema in the table's attribute
     *             definition.</p>
     *          <p>Empty String and Binary attribute values are allowed. Attribute values of type String
     *             and Binary must have a length greater than zero if the attribute is used as a key
     *             attribute for a table or index.</p>
     *          <p>For more information about primary keys, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html#HowItWorks.CoreComponents.PrimaryKey">Primary Key</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     *          <p>Each element in the <code>Item</code> map is an <code>AttributeValue</code>
     *             object.</p>
     * @public
     */
    Item: Record<string, AttributeValue> | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>ConditionExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.Expected.html">Expected</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    Expected?: Record<string, ExpectedAttributeValue> | undefined;
    /**
     * <p>Use <code>ReturnValues</code> if you want to get the item attributes as they appeared
     *             before they were updated with the <code>PutItem</code> request. For
     *             <code>PutItem</code>, the valid values are:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - If <code>ReturnValues</code> is not specified, or if its
     *                     value is <code>NONE</code>, then nothing is returned. (This setting is the
     *                     default for <code>ReturnValues</code>.)</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ALL_OLD</code> - If <code>PutItem</code> overwrote an attribute name-value
     *                     pair, then the content of the old item is returned.</p>
     *             </li>
     *          </ul>
     *          <p>The values returned are strongly consistent.</p>
     *          <p>There is no additional cost associated with requesting a return value aside from the
     *             small network and processing overhead of receiving a larger response. No read capacity
     *             units are consumed.</p>
     *          <note>
     *             <p>The <code>ReturnValues</code> parameter is used by several DynamoDB operations;
     *                 however, <code>PutItem</code> does not recognize any values other than
     *                     <code>NONE</code> or <code>ALL_OLD</code>.</p>
     *          </note>
     * @public
     */
    ReturnValues?: ReturnValue | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INDEXES</code> - The response includes the aggregate
     *                         <code>ConsumedCapacity</code> for the operation, together with
     *                         <code>ConsumedCapacity</code> for each table and secondary index that was
     *                     accessed.</p>
     *                <p>Note that some operations, such as <code>GetItem</code> and
     *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
     *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
     *                     information for table(s).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>TOTAL</code> - The response includes only the aggregate
     *                         <code>ConsumedCapacity</code> for the operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
     *                     response.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
    /**
     * <p>Determines whether item collection metrics are returned. If set to <code>SIZE</code>,
     *             the response includes statistics about item collections, if any, that were modified
     *             during the operation are returned in the response. If set to <code>NONE</code> (the
     *             default), no statistics are returned.</p>
     * @public
     */
    ReturnItemCollectionMetrics?: ReturnItemCollectionMetrics | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>ConditionExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.ConditionalOperator.html">ConditionalOperator</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ConditionalOperator?: ConditionalOperator | undefined;
    /**
     * <p>A condition that must be satisfied in order for a conditional <code>PutItem</code>
     *             operation to succeed.</p>
     *          <p>An expression can contain any of the following:</p>
     *          <ul>
     *             <li>
     *                <p>Functions: <code>attribute_exists | attribute_not_exists | attribute_type |
     *                         contains | begins_with | size</code>
     *                </p>
     *                <p>These function names are case-sensitive.</p>
     *             </li>
     *             <li>
     *                <p>Comparison operators: <code>= | <> |
     *             < | > | <= | >= |
     *             BETWEEN | IN </code>
     *                </p>
     *             </li>
     *             <li>
     *                <p> Logical operators: <code>AND | OR | NOT</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>For more information on condition expressions, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.SpecifyingConditions.html">Condition Expressions</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ConditionExpression?: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in an expression. The following
     *             are some use cases for using <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>To access an attribute whose name conflicts with a DynamoDB reserved
     *                     word.</p>
     *             </li>
     *             <li>
     *                <p>To create a placeholder for repeating occurrences of an attribute name in an
     *                     expression.</p>
     *             </li>
     *             <li>
     *                <p>To prevent special characters in an attribute name from being misinterpreted
     *                     in an expression.</p>
     *             </li>
     *          </ul>
     *          <p>Use the <b>#</b> character in an expression to dereference
     *             an attribute name. For example, consider the following attribute name:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Percentile</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>The name of this attribute conflicts with a reserved word, so it cannot be used
     *             directly in an expression. (For the complete list of reserved words, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html">Reserved Words</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>). To work around this, you could specify the following for
     *                 <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>\{"#P":"Percentile"\}</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>You could then use this substitution in an expression, as in this example:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>#P = :val</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>Tokens that begin with the <b>:</b> character are
     *                     <i>expression attribute values</i>, which are placeholders for the
     *                 actual value at runtime.</p>
     *          </note>
     *          <p>For more information on expression attribute names, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Specifying Item Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
    /**
     * <p>One or more values that can be substituted in an expression.</p>
     *          <p>Use the <b>:</b> (colon) character in an expression to
     *             dereference an attribute value. For example, suppose that you wanted to check whether
     *             the value of the <i>ProductStatus</i> attribute was one of the following: </p>
     *          <p>
     *             <code>Available | Backordered | Discontinued</code>
     *          </p>
     *          <p>You would first need to specify <code>ExpressionAttributeValues</code> as
     *             follows:</p>
     *          <p>
     *             <code>\{ ":avail":\{"S":"Available"\}, ":back":\{"S":"Backordered"\},
     *                 ":disc":\{"S":"Discontinued"\} \}</code>
     *          </p>
     *          <p>You could then use these values in an expression, such as this:</p>
     *          <p>
     *             <code>ProductStatus IN (:avail, :back, :disc)</code>
     *          </p>
     *          <p>For more information on expression attribute values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.SpecifyingConditions.html">Condition Expressions</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
    /**
     * <p>An optional parameter that returns the item attributes for a <code>PutItem</code>
     *             operation that failed a condition check.</p>
     *          <p>There is no additional cost associated with requesting a return value aside from the
     *             small network and processing overhead of receiving a larger response. No read capacity
     *             units are consumed.</p>
     * @public
     */
    ReturnValuesOnConditionCheckFailure?: ReturnValuesOnConditionCheckFailure | undefined;
}
/**
 * <p>Represents the input of a <code>Query</code> operation.</p>
 * @public
 */
export interface QueryInput {
    /**
     * <p>The name of the table containing the requested items. You can also provide the
     *             Amazon Resource Name (ARN) of the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>The name of an index to query. This index can be any local secondary index or global
     *             secondary index on the table. Note that if you use the <code>IndexName</code> parameter,
     *             you must also provide <code>TableName.</code>
     *          </p>
     * @public
     */
    IndexName?: string | undefined;
    /**
     * <p>The attributes to be returned in the result. You can retrieve all item attributes,
     *             specific item attributes, the count of matching items, or in the case of an index, some
     *             or all of the attributes projected into the index.</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>ALL_ATTRIBUTES</code> - Returns all of the item attributes from the
     *                     specified table or index. If you query a local secondary index, then for each
     *                     matching item in the index, DynamoDB fetches the entire item from the parent
     *                     table. If the index is configured to project all item attributes, then all of
     *                     the data can be obtained from the local secondary index, and no fetching is
     *                     required.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ALL_PROJECTED_ATTRIBUTES</code> - Allowed only when querying an index.
     *                     Retrieves all attributes that have been projected into the index. If the index
     *                     is configured to project all attributes, this return value is equivalent to
     *                     specifying <code>ALL_ATTRIBUTES</code>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>COUNT</code> - Returns the number of matching items, rather than the
     *                     matching items themselves. Note that this uses the same quantity of read
     *                     capacity units as getting the items, and is subject to the same item size
     *                     calculations.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>SPECIFIC_ATTRIBUTES</code> - Returns only the attributes listed in
     *                         <code>ProjectionExpression</code>. This return value is equivalent to
     *                     specifying <code>ProjectionExpression</code> without specifying any value for
     *                         <code>Select</code>.</p>
     *                <p>If you query or scan a local secondary index and request only attributes that
     *                     are projected into that index, the operation will read only the index and not
     *                     the table. If any of the requested attributes are not projected into the local
     *                     secondary index, DynamoDB fetches each of these attributes from the parent
     *                     table. This extra fetching incurs additional throughput cost and latency.</p>
     *                <p>If you query or scan a global secondary index, you can only request attributes
     *                     that are projected into the index. Global secondary index queries cannot fetch
     *                     attributes from the parent table.</p>
     *             </li>
     *          </ul>
     *          <p>If neither <code>Select</code> nor <code>ProjectionExpression</code> are specified,
     *             DynamoDB defaults to <code>ALL_ATTRIBUTES</code> when accessing a table, and
     *                 <code>ALL_PROJECTED_ATTRIBUTES</code> when accessing an index. You cannot use both
     *                 <code>Select</code> and <code>ProjectionExpression</code> together in a single
     *             request, unless the value for <code>Select</code> is <code>SPECIFIC_ATTRIBUTES</code>.
     *             (This usage is equivalent to specifying <code>ProjectionExpression</code> without any
     *             value for <code>Select</code>.)</p>
     *          <note>
     *             <p>If you use the <code>ProjectionExpression</code> parameter, then the value for
     *                     <code>Select</code> can only be <code>SPECIFIC_ATTRIBUTES</code>. Any other
     *                 value for <code>Select</code> will return an error.</p>
     *          </note>
     * @public
     */
    Select?: Select | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>ProjectionExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.AttributesToGet.html">AttributesToGet</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    AttributesToGet?: string[] | undefined;
    /**
     * <p>The maximum number of items to evaluate (not necessarily the number of matching
     *             items). If DynamoDB processes the number of items up to the limit while processing the
     *             results, it stops the operation and returns the matching values up to that point, and a
     *             key in <code>LastEvaluatedKey</code> to apply in a subsequent operation, so that you can
     *             pick up where you left off. Also, if the processed dataset size exceeds 1 MB before
     *             DynamoDB reaches this limit, it stops the operation and returns the matching values up
     *             to the limit, and a key in <code>LastEvaluatedKey</code> to apply in a subsequent
     *             operation to continue the operation. For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/QueryAndScan.html">Query and Scan</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    Limit?: number | undefined;
    /**
     * <p>Determines the read consistency model: If set to <code>true</code>, then the operation
     *             uses strongly consistent reads; otherwise, the operation uses eventually consistent
     *             reads.</p>
     *          <p>Strongly consistent reads are not supported on global secondary indexes. If you query
     *             a global secondary index with <code>ConsistentRead</code> set to <code>true</code>, you
     *             will receive a <code>ValidationException</code>.</p>
     * @public
     */
    ConsistentRead?: boolean | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>KeyConditionExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.KeyConditions.html">KeyConditions</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    KeyConditions?: Record<string, Condition> | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>FilterExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.QueryFilter.html">QueryFilter</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    QueryFilter?: Record<string, Condition> | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>FilterExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.ConditionalOperator.html">ConditionalOperator</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ConditionalOperator?: ConditionalOperator | undefined;
    /**
     * <p>Specifies the order for index traversal: If <code>true</code> (default), the traversal
     *             is performed in ascending order; if <code>false</code>, the traversal is performed in
     *             descending order. </p>
     *          <p>Items with the same partition key value are stored in sorted order by sort key. If the
     *             sort key data type is Number, the results are stored in numeric order. For type String,
     *             the results are stored in order of UTF-8 bytes. For type Binary, DynamoDB treats each
     *             byte of the binary data as unsigned.</p>
     *          <p>If <code>ScanIndexForward</code> is <code>true</code>, DynamoDB returns the results in
     *             the order in which they are stored (by sort key value). This is the default behavior. If
     *                 <code>ScanIndexForward</code> is <code>false</code>, DynamoDB reads the results in
     *             reverse order by sort key value, and then returns the results to the client.</p>
     * @public
     */
    ScanIndexForward?: boolean | undefined;
    /**
     * <p>The primary key of the first item that this operation will evaluate. Use the value
     *             that was returned for <code>LastEvaluatedKey</code> in the previous operation.</p>
     *          <p>The data type for <code>ExclusiveStartKey</code> must be String, Number, or Binary. No
     *             set data types are allowed.</p>
     * @public
     */
    ExclusiveStartKey?: Record<string, AttributeValue> | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INDEXES</code> - The response includes the aggregate
     *                         <code>ConsumedCapacity</code> for the operation, together with
     *                         <code>ConsumedCapacity</code> for each table and secondary index that was
     *                     accessed.</p>
     *                <p>Note that some operations, such as <code>GetItem</code> and
     *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
     *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
     *                     information for table(s).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>TOTAL</code> - The response includes only the aggregate
     *                         <code>ConsumedCapacity</code> for the operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
     *                     response.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
    /**
     * <p>A string that identifies one or more attributes to retrieve from the table. These
     *             attributes can include scalars, sets, or elements of a JSON document. The attributes in
     *             the expression must be separated by commas.</p>
     *          <p>If no attribute names are specified, then all attributes will be returned. If any of
     *             the requested attributes are not found, they will not appear in the result.</p>
     *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Accessing Item Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ProjectionExpression?: string | undefined;
    /**
     * <p>A string that contains conditions that DynamoDB applies after the <code>Query</code>
     *             operation, but before the data is returned to you. Items that do not satisfy the
     *                 <code>FilterExpression</code> criteria are not returned.</p>
     *          <p>A <code>FilterExpression</code> does not allow key attributes. You cannot define a
     *             filter expression based on a partition key or a sort key.</p>
     *          <note>
     *             <p>A <code>FilterExpression</code> is applied after the items have already been read;
     *                 the process of filtering does not consume any additional read capacity units.</p>
     *          </note>
     *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.FilterExpression.html">Filter
     *                 Expressions</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    FilterExpression?: string | undefined;
    /**
     * <p>The condition that specifies the key values for items to be retrieved by the
     *                 <code>Query</code> action.</p>
     *          <p>The condition must perform an equality test on a single partition key value.</p>
     *          <p>The condition can optionally perform one of several comparison tests on a single sort
     *             key value. This allows <code>Query</code> to retrieve one item with a given partition
     *             key value and sort key value, or several items that have the same partition key value
     *             but different sort key values.</p>
     *          <p>The partition key equality test is required, and must be specified in the following
     *             format:</p>
     *          <p>
     *             <code>partitionKeyName</code>
     *             <i>=</i>
     *             <code>:partitionkeyval</code>
     *          </p>
     *          <p>If you also want to provide a condition for the sort key, it must be combined using
     *                 <code>AND</code> with the condition for the sort key. Following is an example, using
     *             the <b>=</b> comparison operator for the sort key:</p>
     *          <p>
     *             <code>partitionKeyName</code>
     *             <code>=</code>
     *             <code>:partitionkeyval</code>
     *             <code>AND</code>
     *             <code>sortKeyName</code>
     *             <code>=</code>
     *             <code>:sortkeyval</code>
     *          </p>
     *          <p>Valid comparisons for the sort key condition are as follows:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>sortKeyName</code>
     *                   <code>=</code>
     *                   <code>:sortkeyval</code> - true if the sort key value is equal to
     *                         <code>:sortkeyval</code>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>sortKeyName</code>
     *                   <code><</code>
     *                   <code>:sortkeyval</code> - true if the sort key value is less than
     *                         <code>:sortkeyval</code>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>sortKeyName</code>
     *                   <code><=</code>
     *                   <code>:sortkeyval</code> - true if the sort key value is less than or equal to
     *                         <code>:sortkeyval</code>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>sortKeyName</code>
     *                   <code>></code>
     *                   <code>:sortkeyval</code> - true if the sort key value is greater than
     *                         <code>:sortkeyval</code>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>sortKeyName</code>
     *                   <code>>= </code>
     *                   <code>:sortkeyval</code> - true if the sort key value is greater than or equal
     *                     to <code>:sortkeyval</code>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>sortKeyName</code>
     *                   <code>BETWEEN</code>
     *                   <code>:sortkeyval1</code>
     *                   <code>AND</code>
     *                   <code>:sortkeyval2</code> - true if the sort key value is greater than or equal
     *                     to <code>:sortkeyval1</code>, and less than or equal to
     *                         <code>:sortkeyval2</code>.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>begins_with (</code>
     *                   <code>sortKeyName</code>, <code>:sortkeyval</code>
     *                   <code>)</code> - true if the sort key value begins with a particular operand.
     *                     (You cannot use this function with a sort key that is of type Number.) Note that
     *                     the function name <code>begins_with</code> is case-sensitive.</p>
     *             </li>
     *          </ul>
     *          <p>Use the <code>ExpressionAttributeValues</code> parameter to replace tokens such as
     *                 <code>:partitionval</code> and <code>:sortval</code> with actual values at
     *             runtime.</p>
     *          <p>You can optionally use the <code>ExpressionAttributeNames</code> parameter to replace
     *             the names of the partition key and sort key with placeholder tokens. This option might
     *             be necessary if an attribute name conflicts with a DynamoDB reserved word. For example,
     *             the following <code>KeyConditionExpression</code> parameter causes an error because
     *                 <i>Size</i> is a reserved word:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Size = :myval</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>To work around this, define a placeholder (such a <code>#S</code>) to represent the
     *             attribute name <i>Size</i>. <code>KeyConditionExpression</code> then is as
     *             follows:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>#S = :myval</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>For a list of reserved words, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html">Reserved Words</a>
     *             in the <i>Amazon DynamoDB Developer Guide</i>.</p>
     *          <p>For more information on <code>ExpressionAttributeNames</code> and
     *                 <code>ExpressionAttributeValues</code>, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ExpressionPlaceholders.html">Using
     *                 Placeholders for Attribute Names and Values</a> in the <i>Amazon DynamoDB
     *                 Developer Guide</i>.</p>
     * @public
     */
    KeyConditionExpression?: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in an expression. The following
     *             are some use cases for using <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>To access an attribute whose name conflicts with a DynamoDB reserved
     *                     word.</p>
     *             </li>
     *             <li>
     *                <p>To create a placeholder for repeating occurrences of an attribute name in an
     *                     expression.</p>
     *             </li>
     *             <li>
     *                <p>To prevent special characters in an attribute name from being misinterpreted
     *                     in an expression.</p>
     *             </li>
     *          </ul>
     *          <p>Use the <b>#</b> character in an expression to dereference
     *             an attribute name. For example, consider the following attribute name:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Percentile</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>The name of this attribute conflicts with a reserved word, so it cannot be used
     *             directly in an expression. (For the complete list of reserved words, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html">Reserved Words</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>). To work around this, you could specify the following for
     *                 <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>\{"#P":"Percentile"\}</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>You could then use this substitution in an expression, as in this example:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>#P = :val</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>Tokens that begin with the <b>:</b> character are
     *                     <i>expression attribute values</i>, which are placeholders for the
     *                 actual value at runtime.</p>
     *          </note>
     *          <p>For more information on expression attribute names, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Specifying Item Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
    /**
     * <p>One or more values that can be substituted in an expression.</p>
     *          <p>Use the <b>:</b> (colon) character in an expression to
     *             dereference an attribute value. For example, suppose that you wanted to check whether
     *             the value of the <i>ProductStatus</i> attribute was one of the following: </p>
     *          <p>
     *             <code>Available | Backordered | Discontinued</code>
     *          </p>
     *          <p>You would first need to specify <code>ExpressionAttributeValues</code> as
     *             follows:</p>
     *          <p>
     *             <code>\{ ":avail":\{"S":"Available"\}, ":back":\{"S":"Backordered"\},
     *                 ":disc":\{"S":"Discontinued"\} \}</code>
     *          </p>
     *          <p>You could then use these values in an expression, such as this:</p>
     *          <p>
     *             <code>ProductStatus IN (:avail, :back, :disc)</code>
     *          </p>
     *          <p>For more information on expression attribute values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.SpecifyingConditions.html">Specifying Conditions</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
}
/**
 * <p>Represents the output of a <code>BatchWriteItem</code> operation.</p>
 * @public
 */
export interface BatchWriteItemOutput {
    /**
     * <p>A map of tables and requests against those tables that were not processed. The
     *                 <code>UnprocessedItems</code> value is in the same form as
     *             <code>RequestItems</code>, so you can provide this value directly to a subsequent
     *                 <code>BatchWriteItem</code> operation. For more information, see
     *                 <code>RequestItems</code> in the Request Parameters section.</p>
     *          <p>Each <code>UnprocessedItems</code> entry consists of a table name or table ARN
     *             and, for that table, a list of operations to perform (<code>DeleteRequest</code> or
     *                 <code>PutRequest</code>).</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>DeleteRequest</code> - Perform a <code>DeleteItem</code> operation on the
     *                     specified item. The item to be deleted is identified by a <code>Key</code>
     *                     subelement:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>Key</code> - A map of primary key attribute values that uniquely
     *                             identify the item. Each entry in this map consists of an attribute name
     *                             and an attribute value.</p>
     *                   </li>
     *                </ul>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>PutRequest</code> - Perform a <code>PutItem</code> operation on the
     *                     specified item. The item to be put is identified by an <code>Item</code>
     *                     subelement:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>Item</code> - A map of attributes and their values. Each entry in
     *                             this map consists of an attribute name and an attribute value. Attribute
     *                             values must not be null; string and binary type attributes must have
     *                             lengths greater than zero; and set type attributes must not be empty.
     *                             Requests that contain empty values will be rejected with a
     *                                 <code>ValidationException</code> exception.</p>
     *                      <p>If you specify any attributes that are part of an index key, then the
     *                             data types for those attributes must match those of the schema in the
     *                             table's attribute definition.</p>
     *                   </li>
     *                </ul>
     *             </li>
     *          </ul>
     *          <p>If there are no unprocessed items remaining, the response contains an empty
     *                 <code>UnprocessedItems</code> map.</p>
     * @public
     */
    UnprocessedItems?: Record<string, WriteRequest[]> | undefined;
    /**
     * <p>A list of tables that were processed by <code>BatchWriteItem</code> and, for each
     *             table, information about any item collections that were affected by individual
     *                 <code>DeleteItem</code> or <code>PutItem</code> operations.</p>
     *          <p>Each entry consists of the following subelements:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>ItemCollectionKey</code> - The partition key value of the item collection.
     *                     This is the same as the partition key value of the item.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>SizeEstimateRangeGB</code> - An estimate of item collection size,
     *                     expressed in GB. This is a two-element array containing a lower bound and an
     *                     upper bound for the estimate. The estimate includes the size of all the items in
     *                     the table, plus the size of all attributes projected into all of the local
     *                     secondary indexes on the table. Use this estimate to measure whether a local
     *                     secondary index is approaching its size limit.</p>
     *                <p>The estimate is subject to change over time; therefore, do not rely on the
     *                     precision or accuracy of the estimate.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ItemCollectionMetrics?: Record<string, ItemCollectionMetrics[]> | undefined;
    /**
     * <p>The capacity units consumed by the entire <code>BatchWriteItem</code>
     *             operation.</p>
     *          <p>Each element consists of:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>TableName</code> - The table that consumed the provisioned
     *                     throughput.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>CapacityUnits</code> - The total number of capacity units consumed.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ConsumedCapacity?: ConsumedCapacity[] | undefined;
}
/**
 * <p>Represents the input of an <code>UpdateItem</code> operation.</p>
 * @public
 */
export interface UpdateItemInput {
    /**
     * <p>The name of the table containing the item to update. You can also provide the
     *             Amazon Resource Name (ARN) of the table in this parameter.</p>
     * @public
     */
    TableName: string | undefined;
    /**
     * <p>The primary key of the item to be updated. Each element consists of an attribute name
     *             and a value for that attribute.</p>
     *          <p>For the primary key, you must provide all of the attributes. For example, with a
     *             simple primary key, you only need to provide a value for the partition key. For a
     *             composite primary key, you must provide values for both the partition key and the sort
     *             key.</p>
     * @public
     */
    Key: Record<string, AttributeValue> | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>UpdateExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.AttributeUpdates.html">AttributeUpdates</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    AttributeUpdates?: Record<string, AttributeValueUpdate> | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>ConditionExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.Expected.html">Expected</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.</p>
     * @public
     */
    Expected?: Record<string, ExpectedAttributeValue> | undefined;
    /**
     * <p>This is a legacy parameter. Use <code>ConditionExpression</code> instead. For more
     *             information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LegacyConditionalParameters.ConditionalOperator.html">ConditionalOperator</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ConditionalOperator?: ConditionalOperator | undefined;
    /**
     * <p>Use <code>ReturnValues</code> if you want to get the item attributes as they appear
     *             before or after they are successfully updated. For <code>UpdateItem</code>, the valid
     *             values are:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - If <code>ReturnValues</code> is not specified, or if its
     *                     value is <code>NONE</code>, then nothing is returned. (This setting is the
     *                     default for <code>ReturnValues</code>.)</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ALL_OLD</code> - Returns all of the attributes of the item, as they
     *                     appeared before the UpdateItem operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATED_OLD</code> - Returns only the updated attributes, as they appeared
     *                     before the UpdateItem operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ALL_NEW</code> - Returns all of the attributes of the item, as they appear
     *                     after the UpdateItem operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>UPDATED_NEW</code> - Returns only the updated attributes, as they appear
     *                     after the UpdateItem operation.</p>
     *             </li>
     *          </ul>
     *          <p>There is no additional cost associated with requesting a return value aside from the
     *             small network and processing overhead of receiving a larger response. No read capacity
     *             units are consumed.</p>
     *          <p>The values returned are strongly consistent.</p>
     * @public
     */
    ReturnValues?: ReturnValue | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INDEXES</code> - The response includes the aggregate
     *                         <code>ConsumedCapacity</code> for the operation, together with
     *                         <code>ConsumedCapacity</code> for each table and secondary index that was
     *                     accessed.</p>
     *                <p>Note that some operations, such as <code>GetItem</code> and
     *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
     *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
     *                     information for table(s).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>TOTAL</code> - The response includes only the aggregate
     *                         <code>ConsumedCapacity</code> for the operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
     *                     response.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
    /**
     * <p>Determines whether item collection metrics are returned. If set to <code>SIZE</code>,
     *             the response includes statistics about item collections, if any, that were modified
     *             during the operation are returned in the response. If set to <code>NONE</code> (the
     *             default), no statistics are returned.</p>
     * @public
     */
    ReturnItemCollectionMetrics?: ReturnItemCollectionMetrics | undefined;
    /**
     * <p>An expression that defines one or more attributes to be updated, the action to be
     *             performed on them, and new values for them.</p>
     *          <p>The following action values are available for <code>UpdateExpression</code>.</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>SET</code> - Adds one or more attributes and values to an item. If any of
     *                     these attributes already exist, they are replaced by the new values. You can
     *                     also use <code>SET</code> to add or subtract from an attribute that is of type
     *                     Number. For example: <code>SET myNum = myNum + :val</code>
     *                </p>
     *                <p>
     *                   <code>SET</code> supports the following functions:</p>
     *                <ul>
     *                   <li>
     *                      <p>
     *                         <code>if_not_exists (path, operand)</code> - if the item does not
     *                             contain an attribute at the specified path, then
     *                                 <code>if_not_exists</code> evaluates to operand; otherwise, it
     *                             evaluates to path. You can use this function to avoid overwriting an
     *                             attribute that may already be present in the item.</p>
     *                   </li>
     *                   <li>
     *                      <p>
     *                         <code>list_append (operand, operand)</code> - evaluates to a list with a
     *                             new element added to it. You can append the new element to the start or
     *                             the end of the list by reversing the order of the operands.</p>
     *                   </li>
     *                </ul>
     *                <p>These function names are case-sensitive.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>REMOVE</code> - Removes one or more attributes from an item.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>ADD</code> - Adds the specified value to the item, if the attribute does
     *                     not already exist. If the attribute does exist, then the behavior of
     *                         <code>ADD</code> depends on the data type of the attribute:</p>
     *                <ul>
     *                   <li>
     *                      <p>If the existing attribute is a number, and if <code>Value</code> is
     *                             also a number, then <code>Value</code> is mathematically added to the
     *                             existing attribute. If <code>Value</code> is a negative number, then it
     *                             is subtracted from the existing attribute.</p>
     *                      <note>
     *                         <p>If you use <code>ADD</code> to increment or decrement a number
     *                                 value for an item that doesn't exist before the update, DynamoDB
     *                                 uses <code>0</code> as the initial value.</p>
     *                         <p>Similarly, if you use <code>ADD</code> for an existing item to
     *                                 increment or decrement an attribute value that doesn't exist before
     *                                 the update, DynamoDB uses <code>0</code> as the initial value. For
     *                                 example, suppose that the item you want to update doesn't have an
     *                                 attribute named <code>itemcount</code>, but you decide to
     *                                     <code>ADD</code> the number <code>3</code> to this attribute
     *                                 anyway. DynamoDB will create the <code>itemcount</code> attribute,
     *                                 set its initial value to <code>0</code>, and finally add
     *                                     <code>3</code> to it. The result will be a new
     *                                     <code>itemcount</code> attribute in the item, with a value of
     *                                     <code>3</code>.</p>
     *                      </note>
     *                   </li>
     *                   <li>
     *                      <p>If the existing data type is a set and if <code>Value</code> is also a
     *                             set, then <code>Value</code> is added to the existing set. For example,
     *                             if the attribute value is the set <code>[1,2]</code>, and the
     *                                 <code>ADD</code> action specified <code>[3]</code>, then the final
     *                             attribute value is <code>[1,2,3]</code>. An error occurs if an
     *                                 <code>ADD</code> action is specified for a set attribute and the
     *                             attribute type specified does not match the existing set type. </p>
     *                      <p>Both sets must have the same primitive data type. For example, if the
     *                             existing data type is a set of strings, the <code>Value</code> must also
     *                             be a set of strings.</p>
     *                   </li>
     *                </ul>
     *                <important>
     *                   <p>The <code>ADD</code> action only supports Number and set data types. In
     *                         addition, <code>ADD</code> can only be used on top-level attributes, not
     *                         nested attributes.</p>
     *                </important>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>DELETE</code> - Deletes an element from a set.</p>
     *                <p>If a set of values is specified, then those values are subtracted from the old
     *                     set. For example, if the attribute value was the set <code>[a,b,c]</code> and
     *                     the <code>DELETE</code> action specifies <code>[a,c]</code>, then the final
     *                     attribute value is <code>[b]</code>. Specifying an empty set is an error.</p>
     *                <important>
     *                   <p>The <code>DELETE</code> action only supports set data types. In addition,
     *                             <code>DELETE</code> can only be used on top-level attributes, not nested
     *                         attributes.</p>
     *                </important>
     *             </li>
     *          </ul>
     *          <p>You can have many actions in a single expression, such as the following: <code>SET
     *                 a=:value1, b=:value2 DELETE :value3, :value4, :value5</code>
     *          </p>
     *          <p>For more information on update expressions, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.Modifying.html">Modifying
     *                 Items and Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    UpdateExpression?: string | undefined;
    /**
     * <p>A condition that must be satisfied in order for a conditional update to
     *             succeed.</p>
     *          <p>An expression can contain any of the following:</p>
     *          <ul>
     *             <li>
     *                <p>Functions: <code>attribute_exists | attribute_not_exists | attribute_type |
     *                         contains | begins_with | size</code>
     *                </p>
     *                <p>These function names are case-sensitive.</p>
     *             </li>
     *             <li>
     *                <p>Comparison operators: <code>= | <> |
     *             < | > | <= | >= |
     *             BETWEEN | IN </code>
     *                </p>
     *             </li>
     *             <li>
     *                <p> Logical operators: <code>AND | OR | NOT</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>For more information about condition expressions, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.SpecifyingConditions.html">Specifying Conditions</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ConditionExpression?: string | undefined;
    /**
     * <p>One or more substitution tokens for attribute names in an expression. The following
     *             are some use cases for using <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>To access an attribute whose name conflicts with a DynamoDB reserved
     *                     word.</p>
     *             </li>
     *             <li>
     *                <p>To create a placeholder for repeating occurrences of an attribute name in an
     *                     expression.</p>
     *             </li>
     *             <li>
     *                <p>To prevent special characters in an attribute name from being misinterpreted
     *                     in an expression.</p>
     *             </li>
     *          </ul>
     *          <p>Use the <b>#</b> character in an expression to dereference
     *             an attribute name. For example, consider the following attribute name:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>Percentile</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>The name of this attribute conflicts with a reserved word, so it cannot be used
     *             directly in an expression. (For the complete list of reserved words, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html">Reserved Words</a> in the <i>Amazon DynamoDB Developer
     *             Guide</i>.) To work around this, you could specify the following for
     *                 <code>ExpressionAttributeNames</code>:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>\{"#P":"Percentile"\}</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <p>You could then use this substitution in an expression, as in this example:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>#P = :val</code>
     *                </p>
     *             </li>
     *          </ul>
     *          <note>
     *             <p>Tokens that begin with the <b>:</b> character are
     *                     <i>expression attribute values</i>, which are placeholders for the
     *                 actual value at runtime.</p>
     *          </note>
     *          <p>For more information about expression attribute names, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.AccessingItemAttributes.html">Specifying Item Attributes</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeNames?: Record<string, string> | undefined;
    /**
     * <p>One or more values that can be substituted in an expression.</p>
     *          <p>Use the <b>:</b> (colon) character in an expression to
     *             dereference an attribute value. For example, suppose that you wanted to check whether
     *             the value of the <code>ProductStatus</code> attribute was one of the following: </p>
     *          <p>
     *             <code>Available | Backordered | Discontinued</code>
     *          </p>
     *          <p>You would first need to specify <code>ExpressionAttributeValues</code> as
     *             follows:</p>
     *          <p>
     *             <code>\{ ":avail":\{"S":"Available"\}, ":back":\{"S":"Backordered"\},
     *                 ":disc":\{"S":"Discontinued"\} \}</code>
     *          </p>
     *          <p>You could then use these values in an expression, such as this:</p>
     *          <p>
     *             <code>ProductStatus IN (:avail, :back, :disc)</code>
     *          </p>
     *          <p>For more information on expression attribute values, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.SpecifyingConditions.html">Condition Expressions</a> in the <i>Amazon DynamoDB Developer
     *                 Guide</i>.</p>
     * @public
     */
    ExpressionAttributeValues?: Record<string, AttributeValue> | undefined;
    /**
     * <p>An optional parameter that returns the item attributes for an <code>UpdateItem</code>
     *             operation that failed a condition check.</p>
     *          <p>There is no additional cost associated with requesting a return value aside from the
     *             small network and processing overhead of receiving a larger response. No read capacity
     *             units are consumed.</p>
     * @public
     */
    ReturnValuesOnConditionCheckFailure?: ReturnValuesOnConditionCheckFailure | undefined;
}
/**
 * <p>A list of requests that can perform update, put, delete, or check operations on
 *             multiple items in one or more tables atomically.</p>
 * @public
 */
export interface TransactWriteItem {
    /**
     * <p>A request to perform a check item operation.</p>
     * @public
     */
    ConditionCheck?: ConditionCheck | undefined;
    /**
     * <p>A request to perform a <code>PutItem</code> operation.</p>
     * @public
     */
    Put?: Put | undefined;
    /**
     * <p>A request to perform a <code>DeleteItem</code> operation.</p>
     * @public
     */
    Delete?: Delete | undefined;
    /**
     * <p>A request to perform an <code>UpdateItem</code> operation.</p>
     * @public
     */
    Update?: Update | undefined;
}
