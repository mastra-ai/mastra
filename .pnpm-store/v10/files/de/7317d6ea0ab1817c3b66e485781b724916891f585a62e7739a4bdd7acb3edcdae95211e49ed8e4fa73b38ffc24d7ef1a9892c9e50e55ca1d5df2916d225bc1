import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { DescribeImportInput, DescribeImportOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link DescribeImportCommand}.
 */
export interface DescribeImportCommandInput extends DescribeImportInput {
}
/**
 * @public
 *
 * The output of {@link DescribeImportCommand}.
 */
export interface DescribeImportCommandOutput extends DescribeImportOutput, __MetadataBearer {
}
declare const DescribeImportCommand_base: {
    new (input: DescribeImportCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeImportCommandInput, DescribeImportCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: DescribeImportCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeImportCommandInput, DescribeImportCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p> Represents the properties of the import. </p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, DescribeImportCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, DescribeImportCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // DescribeImportInput
 *   ImportArn: "STRING_VALUE", // required
 * };
 * const command = new DescribeImportCommand(input);
 * const response = await client.send(command);
 * // { // DescribeImportOutput
 * //   ImportTableDescription: { // ImportTableDescription
 * //     ImportArn: "STRING_VALUE",
 * //     ImportStatus: "IN_PROGRESS" || "COMPLETED" || "CANCELLING" || "CANCELLED" || "FAILED",
 * //     TableArn: "STRING_VALUE",
 * //     TableId: "STRING_VALUE",
 * //     ClientToken: "STRING_VALUE",
 * //     S3BucketSource: { // S3BucketSource
 * //       S3BucketOwner: "STRING_VALUE",
 * //       S3Bucket: "STRING_VALUE", // required
 * //       S3KeyPrefix: "STRING_VALUE",
 * //     },
 * //     ErrorCount: Number("long"),
 * //     CloudWatchLogGroupArn: "STRING_VALUE",
 * //     InputFormat: "DYNAMODB_JSON" || "ION" || "CSV",
 * //     InputFormatOptions: { // InputFormatOptions
 * //       Csv: { // CsvOptions
 * //         Delimiter: "STRING_VALUE",
 * //         HeaderList: [ // CsvHeaderList
 * //           "STRING_VALUE",
 * //         ],
 * //       },
 * //     },
 * //     InputCompressionType: "GZIP" || "ZSTD" || "NONE",
 * //     TableCreationParameters: { // TableCreationParameters
 * //       TableName: "STRING_VALUE", // required
 * //       AttributeDefinitions: [ // AttributeDefinitions // required
 * //         { // AttributeDefinition
 * //           AttributeName: "STRING_VALUE", // required
 * //           AttributeType: "S" || "N" || "B", // required
 * //         },
 * //       ],
 * //       KeySchema: [ // KeySchema // required
 * //         { // KeySchemaElement
 * //           AttributeName: "STRING_VALUE", // required
 * //           KeyType: "HASH" || "RANGE", // required
 * //         },
 * //       ],
 * //       BillingMode: "PROVISIONED" || "PAY_PER_REQUEST",
 * //       ProvisionedThroughput: { // ProvisionedThroughput
 * //         ReadCapacityUnits: Number("long"), // required
 * //         WriteCapacityUnits: Number("long"), // required
 * //       },
 * //       OnDemandThroughput: { // OnDemandThroughput
 * //         MaxReadRequestUnits: Number("long"),
 * //         MaxWriteRequestUnits: Number("long"),
 * //       },
 * //       SSESpecification: { // SSESpecification
 * //         Enabled: true || false,
 * //         SSEType: "AES256" || "KMS",
 * //         KMSMasterKeyId: "STRING_VALUE",
 * //       },
 * //       GlobalSecondaryIndexes: [ // GlobalSecondaryIndexList
 * //         { // GlobalSecondaryIndex
 * //           IndexName: "STRING_VALUE", // required
 * //           KeySchema: [ // required
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
 * //           ProvisionedThroughput: {
 * //             ReadCapacityUnits: Number("long"), // required
 * //             WriteCapacityUnits: Number("long"), // required
 * //           },
 * //           OnDemandThroughput: {
 * //             MaxReadRequestUnits: Number("long"),
 * //             MaxWriteRequestUnits: Number("long"),
 * //           },
 * //           WarmThroughput: { // WarmThroughput
 * //             ReadUnitsPerSecond: Number("long"),
 * //             WriteUnitsPerSecond: Number("long"),
 * //           },
 * //         },
 * //       ],
 * //     },
 * //     StartTime: new Date("TIMESTAMP"),
 * //     EndTime: new Date("TIMESTAMP"),
 * //     ProcessedSizeBytes: Number("long"),
 * //     ProcessedItemCount: Number("long"),
 * //     ImportedItemCount: Number("long"),
 * //     FailureCode: "STRING_VALUE",
 * //     FailureMessage: "STRING_VALUE",
 * //   },
 * // };
 *
 * ```
 *
 * @param DescribeImportCommandInput - {@link DescribeImportCommandInput}
 * @returns {@link DescribeImportCommandOutput}
 * @see {@link DescribeImportCommandInput} for command's `input` shape.
 * @see {@link DescribeImportCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link ImportNotFoundException} (client fault)
 *  <p> The specified import was not found. </p>
 *
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @public
 */
export declare class DescribeImportCommand extends DescribeImportCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DescribeImportInput;
            output: DescribeImportOutput;
        };
        sdk: {
            input: DescribeImportCommandInput;
            output: DescribeImportCommandOutput;
        };
    };
}
