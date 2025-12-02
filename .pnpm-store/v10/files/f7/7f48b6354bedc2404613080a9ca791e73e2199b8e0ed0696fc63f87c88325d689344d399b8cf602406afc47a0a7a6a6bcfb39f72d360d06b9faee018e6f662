import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { DescribeExportInput, DescribeExportOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link DescribeExportCommand}.
 */
export interface DescribeExportCommandInput extends DescribeExportInput {
}
/**
 * @public
 *
 * The output of {@link DescribeExportCommand}.
 */
export interface DescribeExportCommandOutput extends DescribeExportOutput, __MetadataBearer {
}
declare const DescribeExportCommand_base: {
    new (input: DescribeExportCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeExportCommandInput, DescribeExportCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: DescribeExportCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeExportCommandInput, DescribeExportCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Describes an existing table export.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, DescribeExportCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, DescribeExportCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // DescribeExportInput
 *   ExportArn: "STRING_VALUE", // required
 * };
 * const command = new DescribeExportCommand(input);
 * const response = await client.send(command);
 * // { // DescribeExportOutput
 * //   ExportDescription: { // ExportDescription
 * //     ExportArn: "STRING_VALUE",
 * //     ExportStatus: "IN_PROGRESS" || "COMPLETED" || "FAILED",
 * //     StartTime: new Date("TIMESTAMP"),
 * //     EndTime: new Date("TIMESTAMP"),
 * //     ExportManifest: "STRING_VALUE",
 * //     TableArn: "STRING_VALUE",
 * //     TableId: "STRING_VALUE",
 * //     ExportTime: new Date("TIMESTAMP"),
 * //     ClientToken: "STRING_VALUE",
 * //     S3Bucket: "STRING_VALUE",
 * //     S3BucketOwner: "STRING_VALUE",
 * //     S3Prefix: "STRING_VALUE",
 * //     S3SseAlgorithm: "AES256" || "KMS",
 * //     S3SseKmsKeyId: "STRING_VALUE",
 * //     FailureCode: "STRING_VALUE",
 * //     FailureMessage: "STRING_VALUE",
 * //     ExportFormat: "DYNAMODB_JSON" || "ION",
 * //     BilledSizeBytes: Number("long"),
 * //     ItemCount: Number("long"),
 * //     ExportType: "FULL_EXPORT" || "INCREMENTAL_EXPORT",
 * //     IncrementalExportSpecification: { // IncrementalExportSpecification
 * //       ExportFromTime: new Date("TIMESTAMP"),
 * //       ExportToTime: new Date("TIMESTAMP"),
 * //       ExportViewType: "NEW_IMAGE" || "NEW_AND_OLD_IMAGES",
 * //     },
 * //   },
 * // };
 *
 * ```
 *
 * @param DescribeExportCommandInput - {@link DescribeExportCommandInput}
 * @returns {@link DescribeExportCommandOutput}
 * @see {@link DescribeExportCommandInput} for command's `input` shape.
 * @see {@link DescribeExportCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link ExportNotFoundException} (client fault)
 *  <p>The specified export was not found.</p>
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
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
export declare class DescribeExportCommand extends DescribeExportCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DescribeExportInput;
            output: DescribeExportOutput;
        };
        sdk: {
            input: DescribeExportCommandInput;
            output: DescribeExportCommandOutput;
        };
    };
}
