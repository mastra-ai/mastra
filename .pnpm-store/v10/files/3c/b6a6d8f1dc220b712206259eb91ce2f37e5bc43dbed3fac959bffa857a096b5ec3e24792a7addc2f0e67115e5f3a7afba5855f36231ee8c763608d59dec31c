import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { UpdateKinesisStreamingDestinationInput, UpdateKinesisStreamingDestinationOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link UpdateKinesisStreamingDestinationCommand}.
 */
export interface UpdateKinesisStreamingDestinationCommandInput extends UpdateKinesisStreamingDestinationInput {
}
/**
 * @public
 *
 * The output of {@link UpdateKinesisStreamingDestinationCommand}.
 */
export interface UpdateKinesisStreamingDestinationCommandOutput extends UpdateKinesisStreamingDestinationOutput, __MetadataBearer {
}
declare const UpdateKinesisStreamingDestinationCommand_base: {
    new (input: UpdateKinesisStreamingDestinationCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateKinesisStreamingDestinationCommandInput, UpdateKinesisStreamingDestinationCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: UpdateKinesisStreamingDestinationCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateKinesisStreamingDestinationCommandInput, UpdateKinesisStreamingDestinationCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>The command to update the Kinesis stream destination.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, UpdateKinesisStreamingDestinationCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, UpdateKinesisStreamingDestinationCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // UpdateKinesisStreamingDestinationInput
 *   TableName: "STRING_VALUE", // required
 *   StreamArn: "STRING_VALUE", // required
 *   UpdateKinesisStreamingConfiguration: { // UpdateKinesisStreamingConfiguration
 *     ApproximateCreationDateTimePrecision: "MILLISECOND" || "MICROSECOND",
 *   },
 * };
 * const command = new UpdateKinesisStreamingDestinationCommand(input);
 * const response = await client.send(command);
 * // { // UpdateKinesisStreamingDestinationOutput
 * //   TableName: "STRING_VALUE",
 * //   StreamArn: "STRING_VALUE",
 * //   DestinationStatus: "ENABLING" || "ACTIVE" || "DISABLING" || "DISABLED" || "ENABLE_FAILED" || "UPDATING",
 * //   UpdateKinesisStreamingConfiguration: { // UpdateKinesisStreamingConfiguration
 * //     ApproximateCreationDateTimePrecision: "MILLISECOND" || "MICROSECOND",
 * //   },
 * // };
 *
 * ```
 *
 * @param UpdateKinesisStreamingDestinationCommandInput - {@link UpdateKinesisStreamingDestinationCommandInput}
 * @returns {@link UpdateKinesisStreamingDestinationCommandOutput}
 * @see {@link UpdateKinesisStreamingDestinationCommandInput} for command's `input` shape.
 * @see {@link UpdateKinesisStreamingDestinationCommandOutput} for command's `response` shape.
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
export declare class UpdateKinesisStreamingDestinationCommand extends UpdateKinesisStreamingDestinationCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdateKinesisStreamingDestinationInput;
            output: UpdateKinesisStreamingDestinationOutput;
        };
        sdk: {
            input: UpdateKinesisStreamingDestinationCommandInput;
            output: UpdateKinesisStreamingDestinationCommandOutput;
        };
    };
}
