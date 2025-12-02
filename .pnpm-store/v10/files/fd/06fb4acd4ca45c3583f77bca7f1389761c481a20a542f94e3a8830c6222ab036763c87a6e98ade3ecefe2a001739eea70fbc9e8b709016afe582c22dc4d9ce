import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { DescribeTableInput, DescribeTableOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link DescribeTableCommand}.
 */
export interface DescribeTableCommandInput extends DescribeTableInput {
}
/**
 * @public
 *
 * The output of {@link DescribeTableCommand}.
 */
export interface DescribeTableCommandOutput extends DescribeTableOutput, __MetadataBearer {
}
declare const DescribeTableCommand_base: {
    new (input: DescribeTableCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeTableCommandInput, DescribeTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: DescribeTableCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeTableCommandInput, DescribeTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Returns information about the table, including the current status of the table, when
 *             it was created, the primary key schema, and any indexes on the table.</p>
 *          <note>
 *             <p>If you issue a <code>DescribeTable</code> request immediately after a
 *                     <code>CreateTable</code> request, DynamoDB might return a
 *                     <code>ResourceNotFoundException</code>. This is because
 *                     <code>DescribeTable</code> uses an eventually consistent query, and the metadata
 *                 for your table might not be available at that moment. Wait for a few seconds, and
 *                 then try the <code>DescribeTable</code> request again.</p>
 *          </note>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, DescribeTableCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // DescribeTableInput
 *   TableName: "STRING_VALUE", // required
 * };
 * const command = new DescribeTableCommand(input);
 * const response = await client.send(command);
 * // { // DescribeTableOutput
 * //   Table: { // TableDescription
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
 * @param DescribeTableCommandInput - {@link DescribeTableCommandInput}
 * @returns {@link DescribeTableCommandOutput}
 * @see {@link DescribeTableCommandInput} for command's `input` shape.
 * @see {@link DescribeTableCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
 *
 * @throws {@link InvalidEndpointException} (client fault)
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
export declare class DescribeTableCommand extends DescribeTableCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DescribeTableInput;
            output: DescribeTableOutput;
        };
        sdk: {
            input: DescribeTableCommandInput;
            output: DescribeTableCommandOutput;
        };
    };
}
