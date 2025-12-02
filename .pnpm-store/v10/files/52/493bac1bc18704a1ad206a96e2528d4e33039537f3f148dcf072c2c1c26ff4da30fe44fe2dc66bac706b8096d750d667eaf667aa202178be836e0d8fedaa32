import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { PutResourcePolicyInput, PutResourcePolicyOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link PutResourcePolicyCommand}.
 */
export interface PutResourcePolicyCommandInput extends PutResourcePolicyInput {
}
/**
 * @public
 *
 * The output of {@link PutResourcePolicyCommand}.
 */
export interface PutResourcePolicyCommandOutput extends PutResourcePolicyOutput, __MetadataBearer {
}
declare const PutResourcePolicyCommand_base: {
    new (input: PutResourcePolicyCommandInput): import("@smithy/smithy-client").CommandImpl<PutResourcePolicyCommandInput, PutResourcePolicyCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: PutResourcePolicyCommandInput): import("@smithy/smithy-client").CommandImpl<PutResourcePolicyCommandInput, PutResourcePolicyCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Attaches a resource-based policy document to the resource, which can be a table or
 *             stream. When you attach a resource-based policy using this API, the policy application
 *             is <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html">
 *                <i>eventually consistent</i>
 *             </a>.</p>
 *          <p>
 *             <code>PutResourcePolicy</code> is an idempotent operation; running it multiple times
 *             on the same resource using the same policy document will return the same revision ID. If
 *             you specify an <code>ExpectedRevisionId</code> that doesn't match the current policy's
 *                 <code>RevisionId</code>, the <code>PolicyNotFoundException</code> will be
 *             returned.</p>
 *          <note>
 *             <p>
 *                <code>PutResourcePolicy</code> is an asynchronous operation. If you issue a
 *                     <code>GetResourcePolicy</code> request immediately after a
 *                     <code>PutResourcePolicy</code> request, DynamoDB might return your
 *                 previous policy, if there was one, or return the
 *                     <code>PolicyNotFoundException</code>. This is because
 *                     <code>GetResourcePolicy</code> uses an eventually consistent query, and the
 *                 metadata for your policy or table might not be available at that moment. Wait for a
 *                 few seconds, and then try the <code>GetResourcePolicy</code> request again.</p>
 *          </note>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, PutResourcePolicyCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, PutResourcePolicyCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // PutResourcePolicyInput
 *   ResourceArn: "STRING_VALUE", // required
 *   Policy: "STRING_VALUE", // required
 *   ExpectedRevisionId: "STRING_VALUE",
 *   ConfirmRemoveSelfResourceAccess: true || false,
 * };
 * const command = new PutResourcePolicyCommand(input);
 * const response = await client.send(command);
 * // { // PutResourcePolicyOutput
 * //   RevisionId: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param PutResourcePolicyCommandInput - {@link PutResourcePolicyCommandInput}
 * @returns {@link PutResourcePolicyCommandOutput}
 * @see {@link PutResourcePolicyCommandInput} for command's `input` shape.
 * @see {@link PutResourcePolicyCommandOutput} for command's `response` shape.
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
 * @throws {@link PolicyNotFoundException} (client fault)
 *  <p>The operation tried to access a nonexistent resource-based policy.</p>
 *          <p>If you specified an <code>ExpectedRevisionId</code>, it's possible that a policy is
 *             present for the resource but its revision ID didn't match the expected value.</p>
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
export declare class PutResourcePolicyCommand extends PutResourcePolicyCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: PutResourcePolicyInput;
            output: PutResourcePolicyOutput;
        };
        sdk: {
            input: PutResourcePolicyCommandInput;
            output: PutResourcePolicyCommandOutput;
        };
    };
}
