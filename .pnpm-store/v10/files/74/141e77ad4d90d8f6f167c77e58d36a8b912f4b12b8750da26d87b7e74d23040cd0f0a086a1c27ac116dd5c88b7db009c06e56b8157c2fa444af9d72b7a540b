import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { CreateTableInput, CreateTableOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link CreateTableCommand}.
 */
export interface CreateTableCommandInput extends CreateTableInput {
}
/**
 * @public
 *
 * The output of {@link CreateTableCommand}.
 */
export interface CreateTableCommandOutput extends CreateTableOutput, __MetadataBearer {
}
declare const CreateTableCommand_base: {
    new (input: CreateTableCommandInput): import("@smithy/smithy-client").CommandImpl<CreateTableCommandInput, CreateTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: CreateTableCommandInput): import("@smithy/smithy-client").CommandImpl<CreateTableCommandInput, CreateTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>The <code>CreateTable</code> operation adds a new table to your account. In an Amazon Web Services account, table names must be unique within each Region. That is, you can
 *             have two tables with same name if you create the tables in different Regions.</p>
 *          <p>
 *             <code>CreateTable</code> is an asynchronous operation. Upon receiving a
 *                 <code>CreateTable</code> request, DynamoDB immediately returns a response with a
 *                 <code>TableStatus</code> of <code>CREATING</code>. After the table is created,
 *             DynamoDB sets the <code>TableStatus</code> to <code>ACTIVE</code>. You can perform read
 *             and write operations only on an <code>ACTIVE</code> table. </p>
 *          <p>You can optionally define secondary indexes on the new table, as part of the
 *                 <code>CreateTable</code> operation. If you want to create multiple tables with
 *             secondary indexes on them, you must create the tables sequentially. Only one table with
 *             secondary indexes can be in the <code>CREATING</code> state at any given time.</p>
 *          <p>You can use the <code>DescribeTable</code> action to check the table status.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // CreateTableInput
 *   AttributeDefinitions: [ // AttributeDefinitions // required
 *     { // AttributeDefinition
 *       AttributeName: "STRING_VALUE", // required
 *       AttributeType: "S" || "N" || "B", // required
 *     },
 *   ],
 *   TableName: "STRING_VALUE", // required
 *   KeySchema: [ // KeySchema // required
 *     { // KeySchemaElement
 *       AttributeName: "STRING_VALUE", // required
 *       KeyType: "HASH" || "RANGE", // required
 *     },
 *   ],
 *   LocalSecondaryIndexes: [ // LocalSecondaryIndexList
 *     { // LocalSecondaryIndex
 *       IndexName: "STRING_VALUE", // required
 *       KeySchema: [ // required
 *         {
 *           AttributeName: "STRING_VALUE", // required
 *           KeyType: "HASH" || "RANGE", // required
 *         },
 *       ],
 *       Projection: { // Projection
 *         ProjectionType: "ALL" || "KEYS_ONLY" || "INCLUDE",
 *         NonKeyAttributes: [ // NonKeyAttributeNameList
 *           "STRING_VALUE",
 *         ],
 *       },
 *     },
 *   ],
 *   GlobalSecondaryIndexes: [ // GlobalSecondaryIndexList
 *     { // GlobalSecondaryIndex
 *       IndexName: "STRING_VALUE", // required
 *       KeySchema: [ // required
 *         {
 *           AttributeName: "STRING_VALUE", // required
 *           KeyType: "HASH" || "RANGE", // required
 *         },
 *       ],
 *       Projection: {
 *         ProjectionType: "ALL" || "KEYS_ONLY" || "INCLUDE",
 *         NonKeyAttributes: [
 *           "STRING_VALUE",
 *         ],
 *       },
 *       ProvisionedThroughput: { // ProvisionedThroughput
 *         ReadCapacityUnits: Number("long"), // required
 *         WriteCapacityUnits: Number("long"), // required
 *       },
 *       OnDemandThroughput: { // OnDemandThroughput
 *         MaxReadRequestUnits: Number("long"),
 *         MaxWriteRequestUnits: Number("long"),
 *       },
 *       WarmThroughput: { // WarmThroughput
 *         ReadUnitsPerSecond: Number("long"),
 *         WriteUnitsPerSecond: Number("long"),
 *       },
 *     },
 *   ],
 *   BillingMode: "PROVISIONED" || "PAY_PER_REQUEST",
 *   ProvisionedThroughput: {
 *     ReadCapacityUnits: Number("long"), // required
 *     WriteCapacityUnits: Number("long"), // required
 *   },
 *   StreamSpecification: { // StreamSpecification
 *     StreamEnabled: true || false, // required
 *     StreamViewType: "NEW_IMAGE" || "OLD_IMAGE" || "NEW_AND_OLD_IMAGES" || "KEYS_ONLY",
 *   },
 *   SSESpecification: { // SSESpecification
 *     Enabled: true || false,
 *     SSEType: "AES256" || "KMS",
 *     KMSMasterKeyId: "STRING_VALUE",
 *   },
 *   Tags: [ // TagList
 *     { // Tag
 *       Key: "STRING_VALUE", // required
 *       Value: "STRING_VALUE", // required
 *     },
 *   ],
 *   TableClass: "STANDARD" || "STANDARD_INFREQUENT_ACCESS",
 *   DeletionProtectionEnabled: true || false,
 *   WarmThroughput: {
 *     ReadUnitsPerSecond: Number("long"),
 *     WriteUnitsPerSecond: Number("long"),
 *   },
 *   ResourcePolicy: "STRING_VALUE",
 *   OnDemandThroughput: {
 *     MaxReadRequestUnits: Number("long"),
 *     MaxWriteRequestUnits: Number("long"),
 *   },
 * };
 * const command = new CreateTableCommand(input);
 * const response = await client.send(command);
 * // { // CreateTableOutput
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
 * @param CreateTableCommandInput - {@link CreateTableCommandInput}
 * @returns {@link CreateTableCommandOutput}
 * @see {@link CreateTableCommandInput} for command's `input` shape.
 * @see {@link CreateTableCommandOutput} for command's `response` shape.
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
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @public
 */
export declare class CreateTableCommand extends CreateTableCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateTableInput;
            output: CreateTableOutput;
        };
        sdk: {
            input: CreateTableCommandInput;
            output: CreateTableCommandOutput;
        };
    };
}
