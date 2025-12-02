import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { GetItemInput, GetItemOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link GetItemCommand}.
 */
export interface GetItemCommandInput extends GetItemInput {
}
/**
 * @public
 *
 * The output of {@link GetItemCommand}.
 */
export interface GetItemCommandOutput extends GetItemOutput, __MetadataBearer {
}
declare const GetItemCommand_base: {
    new (input: GetItemCommandInput): import("@smithy/smithy-client").CommandImpl<GetItemCommandInput, GetItemCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: GetItemCommandInput): import("@smithy/smithy-client").CommandImpl<GetItemCommandInput, GetItemCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>The <code>GetItem</code> operation returns a set of attributes for the item with the
 *             given primary key. If there is no matching item, <code>GetItem</code> does not return
 *             any data and there will be no <code>Item</code> element in the response.</p>
 *          <p>
 *             <code>GetItem</code> provides an eventually consistent read by default. If your
 *             application requires a strongly consistent read, set <code>ConsistentRead</code> to
 *                 <code>true</code>. Although a strongly consistent read might take more time than an
 *             eventually consistent read, it always returns the last updated value.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // GetItemInput
 *   TableName: "STRING_VALUE", // required
 *   Key: { // Key // required
 *     "<keys>": { // AttributeValue Union: only one key present
 *       S: "STRING_VALUE",
 *       N: "STRING_VALUE",
 *       B: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *       SS: [ // StringSetAttributeValue
 *         "STRING_VALUE",
 *       ],
 *       NS: [ // NumberSetAttributeValue
 *         "STRING_VALUE",
 *       ],
 *       BS: [ // BinarySetAttributeValue
 *         new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *       ],
 *       M: { // MapAttributeValue
 *         "<keys>": {//  Union: only one key present
 *           S: "STRING_VALUE",
 *           N: "STRING_VALUE",
 *           B: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *           SS: [
 *             "STRING_VALUE",
 *           ],
 *           NS: [
 *             "STRING_VALUE",
 *           ],
 *           BS: [
 *             new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *           ],
 *           M: {
 *             "<keys>": "<AttributeValue>",
 *           },
 *           L: [ // ListAttributeValue
 *             "<AttributeValue>",
 *           ],
 *           NULL: true || false,
 *           BOOL: true || false,
 *         },
 *       },
 *       L: [
 *         "<AttributeValue>",
 *       ],
 *       NULL: true || false,
 *       BOOL: true || false,
 *     },
 *   },
 *   AttributesToGet: [ // AttributeNameList
 *     "STRING_VALUE",
 *   ],
 *   ConsistentRead: true || false,
 *   ReturnConsumedCapacity: "INDEXES" || "TOTAL" || "NONE",
 *   ProjectionExpression: "STRING_VALUE",
 *   ExpressionAttributeNames: { // ExpressionAttributeNameMap
 *     "<keys>": "STRING_VALUE",
 *   },
 * };
 * const command = new GetItemCommand(input);
 * const response = await client.send(command);
 * // { // GetItemOutput
 * //   Item: { // AttributeMap
 * //     "<keys>": { // AttributeValue Union: only one key present
 * //       S: "STRING_VALUE",
 * //       N: "STRING_VALUE",
 * //       B: new Uint8Array(),
 * //       SS: [ // StringSetAttributeValue
 * //         "STRING_VALUE",
 * //       ],
 * //       NS: [ // NumberSetAttributeValue
 * //         "STRING_VALUE",
 * //       ],
 * //       BS: [ // BinarySetAttributeValue
 * //         new Uint8Array(),
 * //       ],
 * //       M: { // MapAttributeValue
 * //         "<keys>": {//  Union: only one key present
 * //           S: "STRING_VALUE",
 * //           N: "STRING_VALUE",
 * //           B: new Uint8Array(),
 * //           SS: [
 * //             "STRING_VALUE",
 * //           ],
 * //           NS: [
 * //             "STRING_VALUE",
 * //           ],
 * //           BS: [
 * //             new Uint8Array(),
 * //           ],
 * //           M: {
 * //             "<keys>": "<AttributeValue>",
 * //           },
 * //           L: [ // ListAttributeValue
 * //             "<AttributeValue>",
 * //           ],
 * //           NULL: true || false,
 * //           BOOL: true || false,
 * //         },
 * //       },
 * //       L: [
 * //         "<AttributeValue>",
 * //       ],
 * //       NULL: true || false,
 * //       BOOL: true || false,
 * //     },
 * //   },
 * //   ConsumedCapacity: { // ConsumedCapacity
 * //     TableName: "STRING_VALUE",
 * //     CapacityUnits: Number("double"),
 * //     ReadCapacityUnits: Number("double"),
 * //     WriteCapacityUnits: Number("double"),
 * //     Table: { // Capacity
 * //       ReadCapacityUnits: Number("double"),
 * //       WriteCapacityUnits: Number("double"),
 * //       CapacityUnits: Number("double"),
 * //     },
 * //     LocalSecondaryIndexes: { // SecondaryIndexesCapacityMap
 * //       "<keys>": {
 * //         ReadCapacityUnits: Number("double"),
 * //         WriteCapacityUnits: Number("double"),
 * //         CapacityUnits: Number("double"),
 * //       },
 * //     },
 * //     GlobalSecondaryIndexes: {
 * //       "<keys>": {
 * //         ReadCapacityUnits: Number("double"),
 * //         WriteCapacityUnits: Number("double"),
 * //         CapacityUnits: Number("double"),
 * //       },
 * //     },
 * //   },
 * // };
 *
 * ```
 *
 * @param GetItemCommandInput - {@link GetItemCommandInput}
 * @returns {@link GetItemCommandOutput}
 * @see {@link GetItemCommandInput} for command's `input` shape.
 * @see {@link GetItemCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
 *
 * @throws {@link InvalidEndpointException} (client fault)
 *
 * @throws {@link ProvisionedThroughputExceededException} (client fault)
 *  <p>The request was denied due to request throttling. For detailed information about
 *             why the request was throttled and the ARN of the impacted resource, find the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ThrottlingReason.html">ThrottlingReason</a> field in the returned exception. The Amazon Web Services
 *             SDKs for DynamoDB automatically retry requests that receive this exception.
 *             Your request is eventually successful, unless your retry queue is too large to finish.
 *             Reduce the frequency of requests and use exponential backoff. For more information, go
 *             to <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.Errors.html#Programming.Errors.RetryAndBackoff">Error Retries and Exponential Backoff</a> in the <i>Amazon DynamoDB Developer Guide</i>.</p>
 *
 * @throws {@link RequestLimitExceeded} (client fault)
 *  <p>Throughput exceeds the current throughput quota for your account. For detailed
 *             information about why the request was throttled and the ARN of the impacted resource,
 *             find the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ThrottlingReason.html">ThrottlingReason</a> field in the returned exception. Contact <a href="https://aws.amazon.com/support">Amazon Web Services Support</a> to request a quota
 *             increase.</p>
 *
 * @throws {@link ResourceNotFoundException} (client fault)
 *  <p>The operation tried to access a nonexistent table or index. The resource might not
 *             be specified correctly, or its status might not be <code>ACTIVE</code>.</p>
 *
 * @throws {@link ThrottlingException} (client fault)
 *  <p>The request was denied due to request throttling. For detailed information about why
 *             the request was throttled and the ARN of the impacted resource, find the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ThrottlingReason.html">ThrottlingReason</a> field in the returned exception.</p>
 *
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @example To read an item from a table
 * ```javascript
 * // This example retrieves an item from the Music table. The table has a partition key and a sort key (Artist and SongTitle), so you must specify both of these attributes.
 * const input = {
 *   Key: {
 *     Artist: {
 *       S: "Acme Band"
 *     },
 *     SongTitle: {
 *       S: "Happy Day"
 *     }
 *   },
 *   TableName: "Music"
 * };
 * const command = new GetItemCommand(input);
 * const response = await client.send(command);
 * /* response is
 * {
 *   Item: {
 *     AlbumTitle: {
 *       S: "Songs About Life"
 *     },
 *     Artist: {
 *       S: "Acme Band"
 *     },
 *     SongTitle: {
 *       S: "Happy Day"
 *     }
 *   }
 * }
 * *\/
 * ```
 *
 * @public
 */
export declare class GetItemCommand extends GetItemCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: GetItemInput;
            output: GetItemOutput;
        };
        sdk: {
            input: GetItemCommandInput;
            output: GetItemCommandOutput;
        };
    };
}
