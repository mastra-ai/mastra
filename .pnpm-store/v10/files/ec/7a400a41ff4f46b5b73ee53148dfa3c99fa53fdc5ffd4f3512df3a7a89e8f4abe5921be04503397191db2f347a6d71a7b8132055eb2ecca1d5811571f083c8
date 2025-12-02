import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { DescribeContributorInsightsInput, DescribeContributorInsightsOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link DescribeContributorInsightsCommand}.
 */
export interface DescribeContributorInsightsCommandInput extends DescribeContributorInsightsInput {
}
/**
 * @public
 *
 * The output of {@link DescribeContributorInsightsCommand}.
 */
export interface DescribeContributorInsightsCommandOutput extends DescribeContributorInsightsOutput, __MetadataBearer {
}
declare const DescribeContributorInsightsCommand_base: {
    new (input: DescribeContributorInsightsCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeContributorInsightsCommandInput, DescribeContributorInsightsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: DescribeContributorInsightsCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeContributorInsightsCommandInput, DescribeContributorInsightsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Returns information about contributor insights for a given table or global secondary
 *             index.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, DescribeContributorInsightsCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, DescribeContributorInsightsCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // DescribeContributorInsightsInput
 *   TableName: "STRING_VALUE", // required
 *   IndexName: "STRING_VALUE",
 * };
 * const command = new DescribeContributorInsightsCommand(input);
 * const response = await client.send(command);
 * // { // DescribeContributorInsightsOutput
 * //   TableName: "STRING_VALUE",
 * //   IndexName: "STRING_VALUE",
 * //   ContributorInsightsRuleList: [ // ContributorInsightsRuleList
 * //     "STRING_VALUE",
 * //   ],
 * //   ContributorInsightsStatus: "ENABLING" || "ENABLED" || "DISABLING" || "DISABLED" || "FAILED",
 * //   LastUpdateDateTime: new Date("TIMESTAMP"),
 * //   FailureException: { // FailureException
 * //     ExceptionName: "STRING_VALUE",
 * //     ExceptionDescription: "STRING_VALUE",
 * //   },
 * //   ContributorInsightsMode: "ACCESSED_AND_THROTTLED_KEYS" || "THROTTLED_KEYS",
 * // };
 *
 * ```
 *
 * @param DescribeContributorInsightsCommandInput - {@link DescribeContributorInsightsCommandInput}
 * @returns {@link DescribeContributorInsightsCommandOutput}
 * @see {@link DescribeContributorInsightsCommandInput} for command's `input` shape.
 * @see {@link DescribeContributorInsightsCommandOutput} for command's `response` shape.
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
export declare class DescribeContributorInsightsCommand extends DescribeContributorInsightsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DescribeContributorInsightsInput;
            output: DescribeContributorInsightsOutput;
        };
        sdk: {
            input: DescribeContributorInsightsCommandInput;
            output: DescribeContributorInsightsCommandOutput;
        };
    };
}
