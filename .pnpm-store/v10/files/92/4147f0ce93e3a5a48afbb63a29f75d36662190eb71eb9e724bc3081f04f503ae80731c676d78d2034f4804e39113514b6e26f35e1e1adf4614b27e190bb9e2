import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { UpdateContributorInsightsInput, UpdateContributorInsightsOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link UpdateContributorInsightsCommand}.
 */
export interface UpdateContributorInsightsCommandInput extends UpdateContributorInsightsInput {
}
/**
 * @public
 *
 * The output of {@link UpdateContributorInsightsCommand}.
 */
export interface UpdateContributorInsightsCommandOutput extends UpdateContributorInsightsOutput, __MetadataBearer {
}
declare const UpdateContributorInsightsCommand_base: {
    new (input: UpdateContributorInsightsCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateContributorInsightsCommandInput, UpdateContributorInsightsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: UpdateContributorInsightsCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateContributorInsightsCommandInput, UpdateContributorInsightsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Updates the status for contributor insights for a specific table or index. CloudWatch
 *             Contributor Insights for DynamoDB graphs display the partition key and (if applicable)
 *             sort key of frequently accessed items and frequently throttled items in plaintext. If
 *             you require the use of Amazon Web Services Key Management Service (KMS) to encrypt this
 *             table’s partition key and sort key data with an Amazon Web Services managed key or
 *             customer managed key, you should not enable CloudWatch Contributor Insights for DynamoDB
 *             for this table.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, UpdateContributorInsightsCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, UpdateContributorInsightsCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // UpdateContributorInsightsInput
 *   TableName: "STRING_VALUE", // required
 *   IndexName: "STRING_VALUE",
 *   ContributorInsightsAction: "ENABLE" || "DISABLE", // required
 *   ContributorInsightsMode: "ACCESSED_AND_THROTTLED_KEYS" || "THROTTLED_KEYS",
 * };
 * const command = new UpdateContributorInsightsCommand(input);
 * const response = await client.send(command);
 * // { // UpdateContributorInsightsOutput
 * //   TableName: "STRING_VALUE",
 * //   IndexName: "STRING_VALUE",
 * //   ContributorInsightsStatus: "ENABLING" || "ENABLED" || "DISABLING" || "DISABLED" || "FAILED",
 * //   ContributorInsightsMode: "ACCESSED_AND_THROTTLED_KEYS" || "THROTTLED_KEYS",
 * // };
 *
 * ```
 *
 * @param UpdateContributorInsightsCommandInput - {@link UpdateContributorInsightsCommandInput}
 * @returns {@link UpdateContributorInsightsCommandOutput}
 * @see {@link UpdateContributorInsightsCommandInput} for command's `input` shape.
 * @see {@link UpdateContributorInsightsCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
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
export declare class UpdateContributorInsightsCommand extends UpdateContributorInsightsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdateContributorInsightsInput;
            output: UpdateContributorInsightsOutput;
        };
        sdk: {
            input: UpdateContributorInsightsCommandInput;
            output: UpdateContributorInsightsCommandOutput;
        };
    };
}
