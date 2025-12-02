import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { ListTagsOfResourceInput, ListTagsOfResourceOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link ListTagsOfResourceCommand}.
 */
export interface ListTagsOfResourceCommandInput extends ListTagsOfResourceInput {
}
/**
 * @public
 *
 * The output of {@link ListTagsOfResourceCommand}.
 */
export interface ListTagsOfResourceCommandOutput extends ListTagsOfResourceOutput, __MetadataBearer {
}
declare const ListTagsOfResourceCommand_base: {
    new (input: ListTagsOfResourceCommandInput): import("@smithy/smithy-client").CommandImpl<ListTagsOfResourceCommandInput, ListTagsOfResourceCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: ListTagsOfResourceCommandInput): import("@smithy/smithy-client").CommandImpl<ListTagsOfResourceCommandInput, ListTagsOfResourceCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>List all tags on an Amazon DynamoDB resource. You can call ListTagsOfResource up to 10
 *             times per second, per account.</p>
 *          <p>For an overview on tagging DynamoDB resources, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Tagging.html">Tagging for DynamoDB</a>
 *             in the <i>Amazon DynamoDB Developer Guide</i>.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, ListTagsOfResourceCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, ListTagsOfResourceCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // ListTagsOfResourceInput
 *   ResourceArn: "STRING_VALUE", // required
 *   NextToken: "STRING_VALUE",
 * };
 * const command = new ListTagsOfResourceCommand(input);
 * const response = await client.send(command);
 * // { // ListTagsOfResourceOutput
 * //   Tags: [ // TagList
 * //     { // Tag
 * //       Key: "STRING_VALUE", // required
 * //       Value: "STRING_VALUE", // required
 * //     },
 * //   ],
 * //   NextToken: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param ListTagsOfResourceCommandInput - {@link ListTagsOfResourceCommandInput}
 * @returns {@link ListTagsOfResourceCommandOutput}
 * @see {@link ListTagsOfResourceCommandInput} for command's `input` shape.
 * @see {@link ListTagsOfResourceCommandOutput} for command's `response` shape.
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
export declare class ListTagsOfResourceCommand extends ListTagsOfResourceCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ListTagsOfResourceInput;
            output: ListTagsOfResourceOutput;
        };
        sdk: {
            input: ListTagsOfResourceCommandInput;
            output: ListTagsOfResourceCommandOutput;
        };
    };
}
