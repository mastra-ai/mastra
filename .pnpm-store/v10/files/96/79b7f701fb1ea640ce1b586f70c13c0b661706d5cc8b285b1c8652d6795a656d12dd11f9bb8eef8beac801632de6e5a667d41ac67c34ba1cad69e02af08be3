import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { DescribeKinesisStreamingDestinationInput, DescribeKinesisStreamingDestinationOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link DescribeKinesisStreamingDestinationCommand}.
 */
export interface DescribeKinesisStreamingDestinationCommandInput extends DescribeKinesisStreamingDestinationInput {
}
/**
 * @public
 *
 * The output of {@link DescribeKinesisStreamingDestinationCommand}.
 */
export interface DescribeKinesisStreamingDestinationCommandOutput extends DescribeKinesisStreamingDestinationOutput, __MetadataBearer {
}
declare const DescribeKinesisStreamingDestinationCommand_base: {
    new (input: DescribeKinesisStreamingDestinationCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeKinesisStreamingDestinationCommandInput, DescribeKinesisStreamingDestinationCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: DescribeKinesisStreamingDestinationCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeKinesisStreamingDestinationCommandInput, DescribeKinesisStreamingDestinationCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Returns information about the status of Kinesis streaming.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, DescribeKinesisStreamingDestinationCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, DescribeKinesisStreamingDestinationCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // DescribeKinesisStreamingDestinationInput
 *   TableName: "STRING_VALUE", // required
 * };
 * const command = new DescribeKinesisStreamingDestinationCommand(input);
 * const response = await client.send(command);
 * // { // DescribeKinesisStreamingDestinationOutput
 * //   TableName: "STRING_VALUE",
 * //   KinesisDataStreamDestinations: [ // KinesisDataStreamDestinations
 * //     { // KinesisDataStreamDestination
 * //       StreamArn: "STRING_VALUE",
 * //       DestinationStatus: "ENABLING" || "ACTIVE" || "DISABLING" || "DISABLED" || "ENABLE_FAILED" || "UPDATING",
 * //       DestinationStatusDescription: "STRING_VALUE",
 * //       ApproximateCreationDateTimePrecision: "MILLISECOND" || "MICROSECOND",
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param DescribeKinesisStreamingDestinationCommandInput - {@link DescribeKinesisStreamingDestinationCommandInput}
 * @returns {@link DescribeKinesisStreamingDestinationCommandOutput}
 * @see {@link DescribeKinesisStreamingDestinationCommandInput} for command's `input` shape.
 * @see {@link DescribeKinesisStreamingDestinationCommandOutput} for command's `response` shape.
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
export declare class DescribeKinesisStreamingDestinationCommand extends DescribeKinesisStreamingDestinationCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DescribeKinesisStreamingDestinationInput;
            output: DescribeKinesisStreamingDestinationOutput;
        };
        sdk: {
            input: DescribeKinesisStreamingDestinationCommandInput;
            output: DescribeKinesisStreamingDestinationCommandOutput;
        };
    };
}
