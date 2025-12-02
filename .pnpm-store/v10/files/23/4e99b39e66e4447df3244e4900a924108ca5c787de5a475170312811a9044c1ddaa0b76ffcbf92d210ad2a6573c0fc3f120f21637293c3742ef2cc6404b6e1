import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { DescribeBackupInput, DescribeBackupOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link DescribeBackupCommand}.
 */
export interface DescribeBackupCommandInput extends DescribeBackupInput {
}
/**
 * @public
 *
 * The output of {@link DescribeBackupCommand}.
 */
export interface DescribeBackupCommandOutput extends DescribeBackupOutput, __MetadataBearer {
}
declare const DescribeBackupCommand_base: {
    new (input: DescribeBackupCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeBackupCommandInput, DescribeBackupCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: DescribeBackupCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeBackupCommandInput, DescribeBackupCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Describes an existing backup of a table.</p>
 *          <p>You can call <code>DescribeBackup</code> at a maximum rate of 10 times per
 *             second.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, DescribeBackupCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, DescribeBackupCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // DescribeBackupInput
 *   BackupArn: "STRING_VALUE", // required
 * };
 * const command = new DescribeBackupCommand(input);
 * const response = await client.send(command);
 * // { // DescribeBackupOutput
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
 * @param DescribeBackupCommandInput - {@link DescribeBackupCommandInput}
 * @returns {@link DescribeBackupCommandOutput}
 * @see {@link DescribeBackupCommandInput} for command's `input` shape.
 * @see {@link DescribeBackupCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link BackupNotFoundException} (client fault)
 *  <p>Backup not found for the given BackupARN. </p>
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
 *
 * @throws {@link InvalidEndpointException} (client fault)
 *
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @public
 */
export declare class DescribeBackupCommand extends DescribeBackupCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DescribeBackupInput;
            output: DescribeBackupOutput;
        };
        sdk: {
            input: DescribeBackupCommandInput;
            output: DescribeBackupCommandOutput;
        };
    };
}
