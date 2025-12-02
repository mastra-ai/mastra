import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { UpdateTableInput, UpdateTableOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link UpdateTableCommand}.
 */
export interface UpdateTableCommandInput extends UpdateTableInput {
}
/**
 * @public
 *
 * The output of {@link UpdateTableCommand}.
 */
export interface UpdateTableCommandOutput extends UpdateTableOutput, __MetadataBearer {
}
declare const UpdateTableCommand_base: {
    new (input: UpdateTableCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateTableCommandInput, UpdateTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: UpdateTableCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateTableCommandInput, UpdateTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Modifies the provisioned throughput settings, global secondary indexes, or DynamoDB
 *             Streams settings for a given table.</p>
 *          <p>You can only perform one of the following operations at once:</p>
 *          <ul>
 *             <li>
 *                <p>Modify the provisioned throughput settings of the table.</p>
 *             </li>
 *             <li>
 *                <p>Remove a global secondary index from the table.</p>
 *             </li>
 *             <li>
 *                <p>Create a new global secondary index on the table. After the index begins
 *                     backfilling, you can use <code>UpdateTable</code> to perform other
 *                     operations.</p>
 *             </li>
 *          </ul>
 *          <p>
 *             <code>UpdateTable</code> is an asynchronous operation; while it's executing, the table
 *             status changes from <code>ACTIVE</code> to <code>UPDATING</code>. While it's
 *                 <code>UPDATING</code>, you can't issue another <code>UpdateTable</code> request.
 *             When the table returns to the <code>ACTIVE</code> state, the <code>UpdateTable</code>
 *             operation is complete.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, UpdateTableCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, UpdateTableCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // UpdateTableInput
 *   AttributeDefinitions: [ // AttributeDefinitions
 *     { // AttributeDefinition
 *       AttributeName: "STRING_VALUE", // required
 *       AttributeType: "S" || "N" || "B", // required
 *     },
 *   ],
 *   TableName: "STRING_VALUE", // required
 *   BillingMode: "PROVISIONED" || "PAY_PER_REQUEST",
 *   ProvisionedThroughput: { // ProvisionedThroughput
 *     ReadCapacityUnits: Number("long"), // required
 *     WriteCapacityUnits: Number("long"), // required
 *   },
 *   GlobalSecondaryIndexUpdates: [ // GlobalSecondaryIndexUpdateList
 *     { // GlobalSecondaryIndexUpdate
 *       Update: { // UpdateGlobalSecondaryIndexAction
 *         IndexName: "STRING_VALUE", // required
 *         ProvisionedThroughput: {
 *           ReadCapacityUnits: Number("long"), // required
 *           WriteCapacityUnits: Number("long"), // required
 *         },
 *         OnDemandThroughput: { // OnDemandThroughput
 *           MaxReadRequestUnits: Number("long"),
 *           MaxWriteRequestUnits: Number("long"),
 *         },
 *         WarmThroughput: { // WarmThroughput
 *           ReadUnitsPerSecond: Number("long"),
 *           WriteUnitsPerSecond: Number("long"),
 *         },
 *       },
 *       Create: { // CreateGlobalSecondaryIndexAction
 *         IndexName: "STRING_VALUE", // required
 *         KeySchema: [ // KeySchema // required
 *           { // KeySchemaElement
 *             AttributeName: "STRING_VALUE", // required
 *             KeyType: "HASH" || "RANGE", // required
 *           },
 *         ],
 *         Projection: { // Projection
 *           ProjectionType: "ALL" || "KEYS_ONLY" || "INCLUDE",
 *           NonKeyAttributes: [ // NonKeyAttributeNameList
 *             "STRING_VALUE",
 *           ],
 *         },
 *         ProvisionedThroughput: {
 *           ReadCapacityUnits: Number("long"), // required
 *           WriteCapacityUnits: Number("long"), // required
 *         },
 *         OnDemandThroughput: {
 *           MaxReadRequestUnits: Number("long"),
 *           MaxWriteRequestUnits: Number("long"),
 *         },
 *         WarmThroughput: {
 *           ReadUnitsPerSecond: Number("long"),
 *           WriteUnitsPerSecond: Number("long"),
 *         },
 *       },
 *       Delete: { // DeleteGlobalSecondaryIndexAction
 *         IndexName: "STRING_VALUE", // required
 *       },
 *     },
 *   ],
 *   StreamSpecification: { // StreamSpecification
 *     StreamEnabled: true || false, // required
 *     StreamViewType: "NEW_IMAGE" || "OLD_IMAGE" || "NEW_AND_OLD_IMAGES" || "KEYS_ONLY",
 *   },
 *   SSESpecification: { // SSESpecification
 *     Enabled: true || false,
 *     SSEType: "AES256" || "KMS",
 *     KMSMasterKeyId: "STRING_VALUE",
 *   },
 *   ReplicaUpdates: [ // ReplicationGroupUpdateList
 *     { // ReplicationGroupUpdate
 *       Create: { // CreateReplicationGroupMemberAction
 *         RegionName: "STRING_VALUE", // required
 *         KMSMasterKeyId: "STRING_VALUE",
 *         ProvisionedThroughputOverride: { // ProvisionedThroughputOverride
 *           ReadCapacityUnits: Number("long"),
 *         },
 *         OnDemandThroughputOverride: { // OnDemandThroughputOverride
 *           MaxReadRequestUnits: Number("long"),
 *         },
 *         GlobalSecondaryIndexes: [ // ReplicaGlobalSecondaryIndexList
 *           { // ReplicaGlobalSecondaryIndex
 *             IndexName: "STRING_VALUE", // required
 *             ProvisionedThroughputOverride: {
 *               ReadCapacityUnits: Number("long"),
 *             },
 *             OnDemandThroughputOverride: {
 *               MaxReadRequestUnits: Number("long"),
 *             },
 *           },
 *         ],
 *         TableClassOverride: "STANDARD" || "STANDARD_INFREQUENT_ACCESS",
 *       },
 *       Update: { // UpdateReplicationGroupMemberAction
 *         RegionName: "STRING_VALUE", // required
 *         KMSMasterKeyId: "STRING_VALUE",
 *         ProvisionedThroughputOverride: {
 *           ReadCapacityUnits: Number("long"),
 *         },
 *         OnDemandThroughputOverride: {
 *           MaxReadRequestUnits: Number("long"),
 *         },
 *         GlobalSecondaryIndexes: [
 *           {
 *             IndexName: "STRING_VALUE", // required
 *             ProvisionedThroughputOverride: {
 *               ReadCapacityUnits: Number("long"),
 *             },
 *             OnDemandThroughputOverride: {
 *               MaxReadRequestUnits: Number("long"),
 *             },
 *           },
 *         ],
 *         TableClassOverride: "STANDARD" || "STANDARD_INFREQUENT_ACCESS",
 *       },
 *       Delete: { // DeleteReplicationGroupMemberAction
 *         RegionName: "STRING_VALUE", // required
 *       },
 *     },
 *   ],
 *   TableClass: "STANDARD" || "STANDARD_INFREQUENT_ACCESS",
 *   DeletionProtectionEnabled: true || false,
 *   MultiRegionConsistency: "EVENTUAL" || "STRONG",
 *   GlobalTableWitnessUpdates: [ // GlobalTableWitnessGroupUpdateList
 *     { // GlobalTableWitnessGroupUpdate
 *       Create: { // CreateGlobalTableWitnessGroupMemberAction
 *         RegionName: "STRING_VALUE", // required
 *       },
 *       Delete: { // DeleteGlobalTableWitnessGroupMemberAction
 *         RegionName: "STRING_VALUE", // required
 *       },
 *     },
 *   ],
 *   OnDemandThroughput: {
 *     MaxReadRequestUnits: Number("long"),
 *     MaxWriteRequestUnits: Number("long"),
 *   },
 *   WarmThroughput: {
 *     ReadUnitsPerSecond: Number("long"),
 *     WriteUnitsPerSecond: Number("long"),
 *   },
 * };
 * const command = new UpdateTableCommand(input);
 * const response = await client.send(command);
 * // { // UpdateTableOutput
 * //   TableDescription: { // TableDescription
 * //     AttributeDefinitions: [ // AttributeDefinitions
 * //       { // AttributeDefinition
 * //         AttributeName: "STRING_VALUE", // required
 * //         AttributeType: "S" || "N" || "B", // required
 * //       },
 * //     ],
 * //     TableName: "STRING_VALUE",
 * //     KeySchema: [ // KeySchema
 * //       { // KeySchemaElement
 * //         AttributeName: "STRING_VALUE", // required
 * //         KeyType: "HASH" || "RANGE", // required
 * //       },
 * //     ],
 * //     TableStatus: "CREATING" || "UPDATING" || "DELETING" || "ACTIVE" || "INACCESSIBLE_ENCRYPTION_CREDENTIALS" || "ARCHIVING" || "ARCHIVED" || "REPLICATION_NOT_AUTHORIZED",
 * //     CreationDateTime: new Date("TIMESTAMP"),
 * //     ProvisionedThroughput: { // ProvisionedThroughputDescription
 * //       LastIncreaseDateTime: new Date("TIMESTAMP"),
 * //       LastDecreaseDateTime: new Date("TIMESTAMP"),
 * //       NumberOfDecreasesToday: Number("long"),
 * //       ReadCapacityUnits: Number("long"),
 * //       WriteCapacityUnits: Number("long"),
 * //     },
 * //     TableSizeBytes: Number("long"),
 * //     ItemCount: Number("long"),
 * //     TableArn: "STRING_VALUE",
 * //     TableId: "STRING_VALUE",
 * //     BillingModeSummary: { // BillingModeSummary
 * //       BillingMode: "PROVISIONED" || "PAY_PER_REQUEST",
 * //       LastUpdateToPayPerRequestDateTime: new Date("TIMESTAMP"),
 * //     },
 * //     LocalSecondaryIndexes: [ // LocalSecondaryIndexDescriptionList
 * //       { // LocalSecondaryIndexDescription
 * //         IndexName: "STRING_VALUE",
 * //         KeySchema: [
 * //           {
 * //             AttributeName: "STRING_VALUE", // required
 * //             KeyType: "HASH" || "RANGE", // required
 * //           },
 * //         ],
 * //         Projection: { // Projection
 * //           ProjectionType: "ALL" || "KEYS_ONLY" || "INCLUDE",
 * //           NonKeyAttributes: [ // NonKeyAttributeNameList
 * //             "STRING_VALUE",
 * //           ],
 * //         },
 * //         IndexSizeBytes: Number("long"),
 * //         ItemCount: Number("long"),
 * //         IndexArn: "STRING_VALUE",
 * //       },
 * //     ],
 * //     GlobalSecondaryIndexes: [ // GlobalSecondaryIndexDescriptionList
 * //       { // GlobalSecondaryIndexDescription
 * //         IndexName: "STRING_VALUE",
 * //         KeySchema: [
 * //           {
 * //             AttributeName: "STRING_VALUE", // required
 * //             KeyType: "HASH" || "RANGE", // required
 * //           },
 * //         ],
 * //         Projection: {
 * //           ProjectionType: "ALL" || "KEYS_ONLY" || "INCLUDE",
 * //           NonKeyAttributes: [
 * //             "STRING_VALUE",
 * //           ],
 * //         },
 * //         IndexStatus: "CREATING" || "UPDATING" || "DELETING" || "ACTIVE",
 * //         Backfilling: true || false,
 * //         ProvisionedThroughput: {
 * //           LastIncreaseDateTime: new Date("TIMESTAMP"),
 * //           LastDecreaseDateTime: new Date("TIMESTAMP"),
 * //           NumberOfDecreasesToday: Number("long"),
 * //           ReadCapacityUnits: Number("long"),
 * //           WriteCapacityUnits: Number("long"),
 * //         },
 * //         IndexSizeBytes: Number("long"),
 * //         ItemCount: Number("long"),
 * //         IndexArn: "STRING_VALUE",
 * //         OnDemandThroughput: { // OnDemandThroughput
 * //           MaxReadRequestUnits: Number("long"),
 * //           MaxWriteRequestUnits: Number("long"),
 * //         },
 * //         WarmThroughput: { // GlobalSecondaryIndexWarmThroughputDescription
 * //           ReadUnitsPerSecond: Number("long"),
 * //           WriteUnitsPerSecond: Number("long"),
 * //           Status: "CREATING" || "UPDATING" || "DELETING" || "ACTIVE",
 * //         },
 * //       },
 * //     ],
 * //     StreamSpecification: { // StreamSpecification
 * //       StreamEnabled: true || false, // required
 * //       StreamViewType: "NEW_IMAGE" || "OLD_IMAGE" || "NEW_AND_OLD_IMAGES" || "KEYS_ONLY",
 * //     },
 * //     LatestStreamLabel: "STRING_VALUE",
 * //     LatestStreamArn: "STRING_VALUE",
 * //     GlobalTableVersion: "STRING_VALUE",
 * //     Replicas: [ // ReplicaDescriptionList
 * //       { // ReplicaDescription
 * //         RegionName: "STRING_VALUE",
 * //         ReplicaStatus: "CREATING" || "CREATION_FAILED" || "UPDATING" || "DELETING" || "ACTIVE" || "REGION_DISABLED" || "INACCESSIBLE_ENCRYPTION_CREDENTIALS" || "ARCHIVING" || "ARCHIVED" || "REPLICATION_NOT_AUTHORIZED",
 * //         ReplicaStatusDescription: "STRING_VALUE",
 * //         ReplicaStatusPercentProgress: "STRING_VALUE",
 * //         KMSMasterKeyId: "STRING_VALUE",
 * //         ProvisionedThroughputOverride: { // ProvisionedThroughputOverride
 * //           ReadCapacityUnits: Number("long"),
 * //         },
 * //         OnDemandThroughputOverride: { // OnDemandThroughputOverride
 * //           MaxReadRequestUnits: Number("long"),
 * //         },
 * //         WarmThroughput: { // TableWarmThroughputDescription
 * //           ReadUnitsPerSecond: Number("long"),
 * //           WriteUnitsPerSecond: Number("long"),
 * //           Status: "CREATING" || "UPDATING" || "DELETING" || "ACTIVE" || "INACCESSIBLE_ENCRYPTION_CREDENTIALS" || "ARCHIVING" || "ARCHIVED" || "REPLICATION_NOT_AUTHORIZED",
 * //         },
 * //         GlobalSecondaryIndexes: [ // ReplicaGlobalSecondaryIndexDescriptionList
 * //           { // ReplicaGlobalSecondaryIndexDescription
 * //             IndexName: "STRING_VALUE",
 * //             ProvisionedThroughputOverride: {
 * //               ReadCapacityUnits: Number("long"),
 * //             },
 * //             OnDemandThroughputOverride: {
 * //               MaxReadRequestUnits: Number("long"),
 * //             },
 * //             WarmThroughput: {
 * //               ReadUnitsPerSecond: Number("long"),
 * //               WriteUnitsPerSecond: Number("long"),
 * //               Status: "CREATING" || "UPDATING" || "DELETING" || "ACTIVE",
 * //             },
 * //           },
 * //         ],
 * //         ReplicaInaccessibleDateTime: new Date("TIMESTAMP"),
 * //         ReplicaTableClassSummary: { // TableClassSummary
 * //           TableClass: "STANDARD" || "STANDARD_INFREQUENT_ACCESS",
 * //           LastUpdateDateTime: new Date("TIMESTAMP"),
 * //         },
 * //       },
 * //     ],
 * //     GlobalTableWitnesses: [ // GlobalTableWitnessDescriptionList
 * //       { // GlobalTableWitnessDescription
 * //         RegionName: "STRING_VALUE",
 * //         WitnessStatus: "CREATING" || "DELETING" || "ACTIVE",
 * //       },
 * //     ],
 * //     RestoreSummary: { // RestoreSummary
 * //       SourceBackupArn: "STRING_VALUE",
 * //       SourceTableArn: "STRING_VALUE",
 * //       RestoreDateTime: new Date("TIMESTAMP"), // required
 * //       RestoreInProgress: true || false, // required
 * //     },
 * //     SSEDescription: { // SSEDescription
 * //       Status: "ENABLING" || "ENABLED" || "DISABLING" || "DISABLED" || "UPDATING",
 * //       SSEType: "AES256" || "KMS",
 * //       KMSMasterKeyArn: "STRING_VALUE",
 * //       InaccessibleEncryptionDateTime: new Date("TIMESTAMP"),
 * //     },
 * //     ArchivalSummary: { // ArchivalSummary
 * //       ArchivalDateTime: new Date("TIMESTAMP"),
 * //       ArchivalReason: "STRING_VALUE",
 * //       ArchivalBackupArn: "STRING_VALUE",
 * //     },
 * //     TableClassSummary: {
 * //       TableClass: "STANDARD" || "STANDARD_INFREQUENT_ACCESS",
 * //       LastUpdateDateTime: new Date("TIMESTAMP"),
 * //     },
 * //     DeletionProtectionEnabled: true || false,
 * //     OnDemandThroughput: {
 * //       MaxReadRequestUnits: Number("long"),
 * //       MaxWriteRequestUnits: Number("long"),
 * //     },
 * //     WarmThroughput: {
 * //       ReadUnitsPerSecond: Number("long"),
 * //       WriteUnitsPerSecond: Number("long"),
 * //       Status: "CREATING" || "UPDATING" || "DELETING" || "ACTIVE" || "INACCESSIBLE_ENCRYPTION_CREDENTIALS" || "ARCHIVING" || "ARCHIVED" || "REPLICATION_NOT_AUTHORIZED",
 * //     },
 * //     MultiRegionConsistency: "EVENTUAL" || "STRONG",
 * //   },
 * // };
 *
 * ```
 *
 * @param UpdateTableCommandInput - {@link UpdateTableCommandInput}
 * @returns {@link UpdateTableCommandOutput}
 * @see {@link UpdateTableCommandInput} for command's `input` shape.
 * @see {@link UpdateTableCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
 *
 * @throws {@link InvalidEndpointException} (client fault)
 *
 * @throws {@link LimitExceededException} (client fault)
 *  <p>There is no limit to the number of daily on-demand backups that can be taken. </p>
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
 *
 * @throws {@link ResourceInUseException} (client fault)
 *  <p>The operation conflicts with the resource's availability. For example:</p>
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
 *
 * @throws {@link ResourceNotFoundException} (client fault)
 *  <p>The operation tried to access a nonexistent table or index. The resource might not
 *             be specified correctly, or its status might not be <code>ACTIVE</code>.</p>
 *
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @public
 */
export declare class UpdateTableCommand extends UpdateTableCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdateTableInput;
            output: UpdateTableOutput;
        };
        sdk: {
            input: UpdateTableCommandInput;
            output: UpdateTableCommandOutput;
        };
    };
}
