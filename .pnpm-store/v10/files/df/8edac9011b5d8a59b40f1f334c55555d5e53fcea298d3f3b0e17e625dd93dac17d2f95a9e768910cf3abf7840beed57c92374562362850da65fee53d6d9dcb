import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { GetResourcePolicyInput, GetResourcePolicyOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link GetResourcePolicyCommand}.
 */
export interface GetResourcePolicyCommandInput extends GetResourcePolicyInput {
}
/**
 * @public
 *
 * The output of {@link GetResourcePolicyCommand}.
 */
export interface GetResourcePolicyCommandOutput extends GetResourcePolicyOutput, __MetadataBearer {
}
declare const GetResourcePolicyCommand_base: {
    new (input: GetResourcePolicyCommandInput): import("@smithy/smithy-client").CommandImpl<GetResourcePolicyCommandInput, GetResourcePolicyCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: GetResourcePolicyCommandInput): import("@smithy/smithy-client").CommandImpl<GetResourcePolicyCommandInput, GetResourcePolicyCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Returns the resource-based policy document attached to the resource, which can be a
 *             table or stream, in JSON format.</p>
 *          <p>
 *             <code>GetResourcePolicy</code> follows an <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html">
 *                <i>eventually consistent</i>
 *             </a> model. The following list
 *             describes the outcomes when you issue the <code>GetResourcePolicy</code> request
 *             immediately after issuing another request:</p>
 *          <ul>
 *             <li>
 *                <p>If you issue a <code>GetResourcePolicy</code> request immediately after a
 *                         <code>PutResourcePolicy</code> request, DynamoDB might return a
 *                         <code>PolicyNotFoundException</code>.</p>
 *             </li>
 *             <li>
 *                <p>If you issue a <code>GetResourcePolicy</code>request immediately after a
 *                         <code>DeleteResourcePolicy</code> request, DynamoDB might return
 *                     the policy that was present before the deletion request.</p>
 *             </li>
 *             <li>
 *                <p>If you issue a <code>GetResourcePolicy</code> request immediately after a
 *                         <code>CreateTable</code> request, which includes a resource-based policy,
 *                         DynamoDB might return a <code>ResourceNotFoundException</code> or
 *                     a <code>PolicyNotFoundException</code>.</p>
 *             </li>
 *          </ul>
 *          <p>Because <code>GetResourcePolicy</code> uses an <i>eventually
 *                 consistent</i> query, the metadata for your policy or table might not be
 *             available at that moment. Wait for a few seconds, and then retry the
 *                 <code>GetResourcePolicy</code> request.</p>
 *          <p>After a <code>GetResourcePolicy</code> request returns a policy created using the
 *                 <code>PutResourcePolicy</code> request, the policy will be applied in the
 *             authorization of requests to the resource. Because this process is eventually
 *             consistent, it will take some time to apply the policy to all requests to a resource.
 *             Policies that you attach while creating a table using the <code>CreateTable</code>
 *             request will always be applied to all requests for that table.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, GetResourcePolicyCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, GetResourcePolicyCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // GetResourcePolicyInput
 *   ResourceArn: "STRING_VALUE", // required
 * };
 * const command = new GetResourcePolicyCommand(input);
 * const response = await client.send(command);
 * // { // GetResourcePolicyOutput
 * //   Policy: "STRING_VALUE",
 * //   RevisionId: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param GetResourcePolicyCommandInput - {@link GetResourcePolicyCommandInput}
 * @returns {@link GetResourcePolicyCommandOutput}
 * @see {@link GetResourcePolicyCommandInput} for command's `input` shape.
 * @see {@link GetResourcePolicyCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
 *
 * @throws {@link InvalidEndpointException} (client fault)
 *
 * @throws {@link PolicyNotFoundException} (client fault)
 *  <p>The operation tried to access a nonexistent resource-based policy.</p>
 *          <p>If you specified an <code>ExpectedRevisionId</code>, it's possible that a policy is
 *             present for the resource but its revision ID didn't match the expected value.</p>
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
export declare class GetResourcePolicyCommand extends GetResourcePolicyCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: GetResourcePolicyInput;
            output: GetResourcePolicyOutput;
        };
        sdk: {
            input: GetResourcePolicyCommandInput;
            output: GetResourcePolicyCommandOutput;
        };
    };
}
