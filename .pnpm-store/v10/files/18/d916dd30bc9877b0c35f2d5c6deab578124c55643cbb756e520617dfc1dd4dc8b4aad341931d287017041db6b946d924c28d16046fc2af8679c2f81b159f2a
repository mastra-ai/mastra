import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { DeleteTableInput, DeleteTableOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link DeleteTableCommand}.
 */
export interface DeleteTableCommandInput extends DeleteTableInput {
}
/**
 * @public
 *
 * The output of {@link DeleteTableCommand}.
 */
export interface DeleteTableCommandOutput extends DeleteTableOutput, __MetadataBearer {
}
declare const DeleteTableCommand_base: {
    new (input: DeleteTableCommandInput): import("@smithy/smithy-client").CommandImpl<DeleteTableCommandInput, DeleteTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: DeleteTableCommandInput): import("@smithy/smithy-client").CommandImpl<DeleteTableCommandInput, DeleteTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>The <code>DeleteTable</code> operation deletes a table and all of its items. After a
 *                 <code>DeleteTable</code> request, the specified table is in the
 *                 <code>DELETING</code> state until DynamoDB completes the deletion. If the table is
 *             in the <code>ACTIVE</code> state, you can delete it. If a table is in
 *                 <code>CREATING</code> or <code>UPDATING</code> states, then DynamoDB returns a
 *                 <code>ResourceInUseException</code>. If the specified table does not exist, DynamoDB
 *             returns a <code>ResourceNotFoundException</code>. If table is already in the
 *                 <code>DELETING</code> state, no error is returned. </p>
 *          <note>
 *             <p>DynamoDB might continue to accept data read and write operations, such as
 *                     <code>GetItem</code> and <code>PutItem</code>, on a table in the
 *                     <code>DELETING</code> state until the table deletion is complete. For the full
 *                 list of table states, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TableDescription.html#DDB-Type-TableDescription-TableStatus">TableStatus</a>.</p>
 *          </note>
 *          <p>When you delete a table, any indexes on that table are also deleted.</p>
 *          <p>If you have DynamoDB Streams enabled on the table, then the corresponding stream on
 *             that table goes into the <code>DISABLED</code> state, and the stream is automatically
 *             deleted after 24 hours.</p>
 *          <p>Use the <code>DescribeTable</code> action to check the status of the table. </p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, DeleteTableCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, DeleteTableCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // DeleteTableInput
 *   TableName: "STRING_VALUE", // required
 * };
 * const command = new DeleteTableCommand(input);
 * const response = await client.send(command);
 * // { // DeleteTableOutput
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
 * @param DeleteTableCommandInput - {@link DeleteTableCommandInput}
 * @returns {@link DeleteTableCommandOutput}
 * @see {@link DeleteTableCommandInput} for command's `input` shape.
 * @see {@link DeleteTableCommandOutput} for command's `response` shape.
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
 * @example To delete a table
 * ```javascript
 * // This example deletes the Music table.
 * const input = {
 *   TableName: "Music"
 * };
 * const command = new DeleteTableCommand(input);
 * const response = await client.send(command);
 * /* response is
 * {
 *   TableDescription: {
 *     ItemCount: 0,
 *     ProvisionedThroughput: {
 *       NumberOfDecreasesToday: 1,
 *       ReadCapacityUnits: 5,
 *       WriteCapacityUnits: 5
 *     },
 *     TableName: "Music",
 *     TableSizeBytes: 0,
 *     TableStatus: "DELETING"
 *   }
 * }
 * *\/
 * ```
 *
 * @public
 */
export declare class DeleteTableCommand extends DeleteTableCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DeleteTableInput;
            output: DeleteTableOutput;
        };
        sdk: {
            input: DeleteTableCommandInput;
            output: DeleteTableCommandOutput;
        };
    };
}
