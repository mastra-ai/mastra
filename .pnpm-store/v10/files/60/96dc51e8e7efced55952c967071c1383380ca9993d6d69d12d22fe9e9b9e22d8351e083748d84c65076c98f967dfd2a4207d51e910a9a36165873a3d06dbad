import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { UpdateTimeToLiveInput, UpdateTimeToLiveOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link UpdateTimeToLiveCommand}.
 */
export interface UpdateTimeToLiveCommandInput extends UpdateTimeToLiveInput {
}
/**
 * @public
 *
 * The output of {@link UpdateTimeToLiveCommand}.
 */
export interface UpdateTimeToLiveCommandOutput extends UpdateTimeToLiveOutput, __MetadataBearer {
}
declare const UpdateTimeToLiveCommand_base: {
    new (input: UpdateTimeToLiveCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateTimeToLiveCommandInput, UpdateTimeToLiveCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: UpdateTimeToLiveCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateTimeToLiveCommandInput, UpdateTimeToLiveCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>The <code>UpdateTimeToLive</code> method enables or disables Time to Live (TTL) for
 *             the specified table. A successful <code>UpdateTimeToLive</code> call returns the current
 *                 <code>TimeToLiveSpecification</code>. It can take up to one hour for the change to
 *             fully process. Any additional <code>UpdateTimeToLive</code> calls for the same table
 *             during this one hour duration result in a <code>ValidationException</code>. </p>
 *          <p>TTL compares the current time in epoch time format to the time stored in the TTL
 *             attribute of an item. If the epoch time value stored in the attribute is less than the
 *             current time, the item is marked as expired and subsequently deleted.</p>
 *          <note>
 *             <p> The epoch time format is the number of seconds elapsed since 12:00:00 AM January
 *                 1, 1970 UTC. </p>
 *          </note>
 *          <p>DynamoDB deletes expired items on a best-effort basis to ensure availability of
 *             throughput for other data operations. </p>
 *          <important>
 *             <p>DynamoDB typically deletes expired items within two days of expiration. The exact
 *                 duration within which an item gets deleted after expiration is specific to the
 *                 nature of the workload. Items that have expired and not been deleted will still show
 *                 up in reads, queries, and scans.</p>
 *          </important>
 *          <p>As items are deleted, they are removed from any local secondary index and global
 *             secondary index immediately in the same eventually consistent way as a standard delete
 *             operation.</p>
 *          <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html">Time To Live</a> in the
 *             Amazon DynamoDB Developer Guide. </p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, UpdateTimeToLiveCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, UpdateTimeToLiveCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // UpdateTimeToLiveInput
 *   TableName: "STRING_VALUE", // required
 *   TimeToLiveSpecification: { // TimeToLiveSpecification
 *     Enabled: true || false, // required
 *     AttributeName: "STRING_VALUE", // required
 *   },
 * };
 * const command = new UpdateTimeToLiveCommand(input);
 * const response = await client.send(command);
 * // { // UpdateTimeToLiveOutput
 * //   TimeToLiveSpecification: { // TimeToLiveSpecification
 * //     Enabled: true || false, // required
 * //     AttributeName: "STRING_VALUE", // required
 * //   },
 * // };
 *
 * ```
 *
 * @param UpdateTimeToLiveCommandInput - {@link UpdateTimeToLiveCommandInput}
 * @returns {@link UpdateTimeToLiveCommandOutput}
 * @see {@link UpdateTimeToLiveCommandInput} for command's `input` shape.
 * @see {@link UpdateTimeToLiveCommandOutput} for command's `response` shape.
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
export declare class UpdateTimeToLiveCommand extends UpdateTimeToLiveCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdateTimeToLiveInput;
            output: UpdateTimeToLiveOutput;
        };
        sdk: {
            input: UpdateTimeToLiveCommandInput;
            output: UpdateTimeToLiveCommandOutput;
        };
    };
}
