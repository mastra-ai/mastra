import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { ListExportsInput, ListExportsOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link ListExportsCommand}.
 */
export interface ListExportsCommandInput extends ListExportsInput {
}
/**
 * @public
 *
 * The output of {@link ListExportsCommand}.
 */
export interface ListExportsCommandOutput extends ListExportsOutput, __MetadataBearer {
}
declare const ListExportsCommand_base: {
    new (input: ListExportsCommandInput): import("@smithy/smithy-client").CommandImpl<ListExportsCommandInput, ListExportsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (...[input]: [] | [ListExportsCommandInput]): import("@smithy/smithy-client").CommandImpl<ListExportsCommandInput, ListExportsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Lists completed exports within the past 90 days.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, ListExportsCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, ListExportsCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // ListExportsInput
 *   TableArn: "STRING_VALUE",
 *   MaxResults: Number("int"),
 *   NextToken: "STRING_VALUE",
 * };
 * const command = new ListExportsCommand(input);
 * const response = await client.send(command);
 * // { // ListExportsOutput
 * //   ExportSummaries: [ // ExportSummaries
 * //     { // ExportSummary
 * //       ExportArn: "STRING_VALUE",
 * //       ExportStatus: "IN_PROGRESS" || "COMPLETED" || "FAILED",
 * //       ExportType: "FULL_EXPORT" || "INCREMENTAL_EXPORT",
 * //     },
 * //   ],
 * //   NextToken: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param ListExportsCommandInput - {@link ListExportsCommandInput}
 * @returns {@link ListExportsCommandOutput}
 * @see {@link ListExportsCommandInput} for command's `input` shape.
 * @see {@link ListExportsCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
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
export declare class ListExportsCommand extends ListExportsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ListExportsInput;
            output: ListExportsOutput;
        };
        sdk: {
            input: ListExportsCommandInput;
            output: ListExportsCommandOutput;
        };
    };
}
