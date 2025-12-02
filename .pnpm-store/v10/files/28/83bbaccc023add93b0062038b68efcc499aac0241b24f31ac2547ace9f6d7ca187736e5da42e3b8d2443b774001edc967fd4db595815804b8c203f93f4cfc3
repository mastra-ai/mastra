import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { ListContributorInsightsInput, ListContributorInsightsOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link ListContributorInsightsCommand}.
 */
export interface ListContributorInsightsCommandInput extends ListContributorInsightsInput {
}
/**
 * @public
 *
 * The output of {@link ListContributorInsightsCommand}.
 */
export interface ListContributorInsightsCommandOutput extends ListContributorInsightsOutput, __MetadataBearer {
}
declare const ListContributorInsightsCommand_base: {
    new (input: ListContributorInsightsCommandInput): import("@smithy/smithy-client").CommandImpl<ListContributorInsightsCommandInput, ListContributorInsightsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (...[input]: [] | [ListContributorInsightsCommandInput]): import("@smithy/smithy-client").CommandImpl<ListContributorInsightsCommandInput, ListContributorInsightsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Returns a list of ContributorInsightsSummary for a table and all its global secondary
 *             indexes.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, ListContributorInsightsCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, ListContributorInsightsCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // ListContributorInsightsInput
 *   TableName: "STRING_VALUE",
 *   NextToken: "STRING_VALUE",
 *   MaxResults: Number("int"),
 * };
 * const command = new ListContributorInsightsCommand(input);
 * const response = await client.send(command);
 * // { // ListContributorInsightsOutput
 * //   ContributorInsightsSummaries: [ // ContributorInsightsSummaries
 * //     { // ContributorInsightsSummary
 * //       TableName: "STRING_VALUE",
 * //       IndexName: "STRING_VALUE",
 * //       ContributorInsightsStatus: "ENABLING" || "ENABLED" || "DISABLING" || "DISABLED" || "FAILED",
 * //       ContributorInsightsMode: "ACCESSED_AND_THROTTLED_KEYS" || "THROTTLED_KEYS",
 * //     },
 * //   ],
 * //   NextToken: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param ListContributorInsightsCommandInput - {@link ListContributorInsightsCommandInput}
 * @returns {@link ListContributorInsightsCommandOutput}
 * @see {@link ListContributorInsightsCommandInput} for command's `input` shape.
 * @see {@link ListContributorInsightsCommandOutput} for command's `response` shape.
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
export declare class ListContributorInsightsCommand extends ListContributorInsightsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ListContributorInsightsInput;
            output: ListContributorInsightsOutput;
        };
        sdk: {
            input: ListContributorInsightsCommandInput;
            output: ListContributorInsightsCommandOutput;
        };
    };
}
