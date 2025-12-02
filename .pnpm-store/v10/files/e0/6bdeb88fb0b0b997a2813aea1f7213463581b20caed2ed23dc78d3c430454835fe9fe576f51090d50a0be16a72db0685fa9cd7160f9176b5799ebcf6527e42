import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { DeleteBackupInput, DeleteBackupOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link DeleteBackupCommand}.
 */
export interface DeleteBackupCommandInput extends DeleteBackupInput {
}
/**
 * @public
 *
 * The output of {@link DeleteBackupCommand}.
 */
export interface DeleteBackupCommandOutput extends DeleteBackupOutput, __MetadataBearer {
}
declare const DeleteBackupCommand_base: {
    new (input: DeleteBackupCommandInput): import("@smithy/smithy-client").CommandImpl<DeleteBackupCommandInput, DeleteBackupCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: DeleteBackupCommandInput): import("@smithy/smithy-client").CommandImpl<DeleteBackupCommandInput, DeleteBackupCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Deletes an existing backup of a table.</p>
 *          <p>You can call <code>DeleteBackup</code> at a maximum rate of 10 times per
 *             second.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, DeleteBackupCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, DeleteBackupCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // DeleteBackupInput
 *   BackupArn: "STRING_VALUE", // required
 * };
 * const command = new DeleteBackupCommand(input);
 * const response = await client.send(command);
 * // { // DeleteBackupOutput
 * //   BackupDescription: { // BackupDescription
 * //     BackupDetails: { // BackupDetails
 * //       BackupArn: "STRING_VALUE", // required
 * //       BackupName: "STRING_VALUE", // required
 * //       BackupSizeBytes: Number("long"),
 * //       BackupStatus: "CREATING" || "DELETED" || "AVAILABLE", // required
 * //       BackupType: "USER" || "SYSTEM" || "AWS_BACKUP", // required
 * //       BackupCreationDateTime: new Date("TIMESTAMP"), // required
 * //       BackupExpiryDateTime: new Date("TIMESTAMP"),
 * //     },
 * //     SourceTableDetails: { // SourceTableDetails
 * //       TableName: "STRING_VALUE", // required
 * //       TableId: "STRING_VALUE", // required
 * //       TableArn: "STRING_VALUE",
 * //       TableSizeBytes: Number("long"),
 * //       KeySchema: [ // KeySchema // required
 * //         { // KeySchemaElement
 * //           AttributeName: "STRING_VALUE", // required
 * //           KeyType: "HASH" || "RANGE", // required
 * //         },
 * //       ],
 * //       TableCreationDateTime: new Date("TIMESTAMP"), // required
 * //       ProvisionedThroughput: { // ProvisionedThroughput
 * //         ReadCapacityUnits: Number("long"), // required
 * //         WriteCapacityUnits: Number("long"), // required
 * //       },
 * //       OnDemandThroughput: { // OnDemandThroughput
 * //         MaxReadRequestUnits: Number("long"),
 * //         MaxWriteRequestUnits: Number("long"),
 * //       },
 * //       ItemCount: Number("long"),
 * //       BillingMode: "PROVISIONED" || "PAY_PER_REQUEST",
 * //     },
 * //     SourceTableFeatureDetails: { // SourceTableFeatureDetails
 * //       LocalSecondaryIndexes: [ // LocalSecondaryIndexes
 * //         { // LocalSecondaryIndexInfo
 * //           IndexName: "STRING_VALUE",
 * //           KeySchema: [
 * //             {
 * //               AttributeName: "STRING_VALUE", // required
 * //               KeyType: "HASH" || "RANGE", // required
 * //             },
 * //           ],
 * //           Projection: { // Projection
 * //             ProjectionType: "ALL" || "KEYS_ONLY" || "INCLUDE",
 * //             NonKeyAttributes: [ // NonKeyAttributeNameList
 * //               "STRING_VALUE",
 * //             ],
 * //           },
 * //         },
 * //       ],
 * //       GlobalSecondaryIndexes: [ // GlobalSecondaryIndexes
 * //         { // GlobalSecondaryIndexInfo
 * //           IndexName: "STRING_VALUE",
 * //           KeySchema: [
 * //             {
 * //               AttributeName: "STRING_VALUE", // required
 * //               KeyType: "HASH" || "RANGE", // required
 * //             },
 * //           ],
 * //           Projection: {
 * //             ProjectionType: "ALL" || "KEYS_ONLY" || "INCLUDE",
 * //             NonKeyAttributes: [
 * //               "STRING_VALUE",
 * //             ],
 * //           },
 * //           ProvisionedThroughput: {
 * //             ReadCapacityUnits: Number("long"), // required
 * //             WriteCapacityUnits: Number("long"), // required
 * //           },
 * //           OnDemandThroughput: {
 * //             MaxReadRequestUnits: Number("long"),
 * //             MaxWriteRequestUnits: Number("long"),
 * //           },
 * //         },
 * //       ],
 * //       StreamDescription: { // StreamSpecification
 * //         StreamEnabled: true || false, // required
 * //         StreamViewType: "NEW_IMAGE" || "OLD_IMAGE" || "NEW_AND_OLD_IMAGES" || "KEYS_ONLY",
 * //       },
 * //       TimeToLiveDescription: { // TimeToLiveDescription
 * //         TimeToLiveStatus: "ENABLING" || "DISABLING" || "ENABLED" || "DISABLED",
 * //         AttributeName: "STRING_VALUE",
 * //       },
 * //       SSEDescription: { // SSEDescription
 * //         Status: "ENABLING" || "ENABLED" || "DISABLING" || "DISABLED" || "UPDATING",
 * //         SSEType: "AES256" || "KMS",
 * //         KMSMasterKeyArn: "STRING_VALUE",
 * //         InaccessibleEncryptionDateTime: new Date("TIMESTAMP"),
 * //       },
 * //     },
 * //   },
 * // };
 *
 * ```
 *
 * @param DeleteBackupCommandInput - {@link DeleteBackupCommandInput}
 * @returns {@link DeleteBackupCommandOutput}
 * @see {@link DeleteBackupCommandInput} for command's `input` shape.
 * @see {@link DeleteBackupCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link BackupInUseException} (client fault)
 *  <p>There is another ongoing conflicting backup control plane operation on the table.
 *             The backup is either being created, deleted or restored to a table.</p>
 *
 * @throws {@link BackupNotFoundException} (client fault)
 *  <p>Backup not found for the given BackupARN. </p>
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
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @public
 */
export declare class DeleteBackupCommand extends DeleteBackupCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DeleteBackupInput;
            output: DeleteBackupOutput;
        };
        sdk: {
            input: DeleteBackupCommandInput;
            output: DeleteBackupCommandOutput;
        };
    };
}
