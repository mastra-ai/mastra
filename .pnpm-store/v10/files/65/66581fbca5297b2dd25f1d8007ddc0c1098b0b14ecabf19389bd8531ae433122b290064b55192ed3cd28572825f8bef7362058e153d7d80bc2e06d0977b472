import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { BatchGetItemInput, BatchGetItemOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link BatchGetItemCommand}.
 */
export interface BatchGetItemCommandInput extends BatchGetItemInput {
}
/**
 * @public
 *
 * The output of {@link BatchGetItemCommand}.
 */
export interface BatchGetItemCommandOutput extends BatchGetItemOutput, __MetadataBearer {
}
declare const BatchGetItemCommand_base: {
    new (input: BatchGetItemCommandInput): import("@smithy/smithy-client").CommandImpl<BatchGetItemCommandInput, BatchGetItemCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: BatchGetItemCommandInput): import("@smithy/smithy-client").CommandImpl<BatchGetItemCommandInput, BatchGetItemCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>The <code>BatchGetItem</code> operation returns the attributes of one or more items
 *             from one or more tables. You identify requested items by primary key.</p>
 *          <p>A single operation can retrieve up to 16 MB of data, which can contain as many as 100
 *             items. <code>BatchGetItem</code> returns a partial result if the response size limit is
 *             exceeded, the table's provisioned throughput is exceeded, more than 1MB per partition is
 *             requested, or an internal processing failure occurs. If a partial result is returned,
 *             the operation returns a value for <code>UnprocessedKeys</code>. You can use this value
 *             to retry the operation starting with the next item to get.</p>
 *          <important>
 *             <p>If you request more than 100 items, <code>BatchGetItem</code> returns a
 *                     <code>ValidationException</code> with the message "Too many items requested for
 *                 the BatchGetItem call."</p>
 *          </important>
 *          <p>For example, if you ask to retrieve 100 items, but each individual item is 300 KB in
 *             size, the system returns 52 items (so as not to exceed the 16 MB limit). It also returns
 *             an appropriate <code>UnprocessedKeys</code> value so you can get the next page of
 *             results. If desired, your application can include its own logic to assemble the pages of
 *             results into one dataset.</p>
 *          <p>If <i>none</i> of the items can be processed due to insufficient
 *             provisioned throughput on all of the tables in the request, then
 *                 <code>BatchGetItem</code> returns a
 *                 <code>ProvisionedThroughputExceededException</code>. If <i>at least
 *                 one</i> of the items is successfully processed, then
 *                 <code>BatchGetItem</code> completes successfully, while returning the keys of the
 *             unread items in <code>UnprocessedKeys</code>.</p>
 *          <important>
 *             <p>If DynamoDB returns any unprocessed items, you should retry the batch operation on
 *                 those items. However, <i>we strongly recommend that you use an exponential
 *                     backoff algorithm</i>. If you retry the batch operation immediately, the
 *                 underlying read or write requests can still fail due to throttling on the individual
 *                 tables. If you delay the batch operation using exponential backoff, the individual
 *                 requests in the batch are much more likely to succeed.</p>
 *             <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ErrorHandling.html#BatchOperations">Batch Operations and Error Handling</a> in the <i>Amazon DynamoDB
 *                     Developer Guide</i>.</p>
 *          </important>
 *          <p>By default, <code>BatchGetItem</code> performs eventually consistent reads on every
 *             table in the request. If you want strongly consistent reads instead, you can set
 *                 <code>ConsistentRead</code> to <code>true</code> for any or all tables.</p>
 *          <p>In order to minimize response latency, <code>BatchGetItem</code> may retrieve items in
 *             parallel.</p>
 *          <p>When designing your application, keep in mind that DynamoDB does not return items in
 *             any particular order. To help parse the response by item, include the primary key values
 *             for the items in your request in the <code>ProjectionExpression</code> parameter.</p>
 *          <p>If a requested item does not exist, it is not returned in the result. Requests for
 *             nonexistent items consume the minimum read capacity units according to the type of read.
 *             For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithTables.html#CapacityUnitCalculations">Working with Tables</a> in the <i>Amazon DynamoDB Developer
 *                 Guide</i>.</p>
 *          <note>
 *             <p>
 *                <code>BatchGetItem</code> will result in a <code>ValidationException</code> if the
 *                 same key is specified multiple times.</p>
 *          </note>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, BatchGetItemCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, BatchGetItemCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // BatchGetItemInput
 *   RequestItems: { // BatchGetRequestMap // required
 *     "<keys>": { // KeysAndAttributes
 *       Keys: [ // KeyList // required
 *         { // Key
 *           "<keys>": { // AttributeValue Union: only one key present
 *             S: "STRING_VALUE",
 *             N: "STRING_VALUE",
 *             B: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *             SS: [ // StringSetAttributeValue
 *               "STRING_VALUE",
 *             ],
 *             NS: [ // NumberSetAttributeValue
 *               "STRING_VALUE",
 *             ],
 *             BS: [ // BinarySetAttributeValue
 *               new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *             ],
 *             M: { // MapAttributeValue
 *               "<keys>": {//  Union: only one key present
 *                 S: "STRING_VALUE",
 *                 N: "STRING_VALUE",
 *                 B: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *                 SS: [
 *                   "STRING_VALUE",
 *                 ],
 *                 NS: [
 *                   "STRING_VALUE",
 *                 ],
 *                 BS: [
 *                   new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *                 ],
 *                 M: {
 *                   "<keys>": "<AttributeValue>",
 *                 },
 *                 L: [ // ListAttributeValue
 *                   "<AttributeValue>",
 *                 ],
 *                 NULL: true || false,
 *                 BOOL: true || false,
 *               },
 *             },
 *             L: [
 *               "<AttributeValue>",
 *             ],
 *             NULL: true || false,
 *             BOOL: true || false,
 *           },
 *         },
 *       ],
 *       AttributesToGet: [ // AttributeNameList
 *         "STRING_VALUE",
 *       ],
 *       ConsistentRead: true || false,
 *       ProjectionExpression: "STRING_VALUE",
 *       ExpressionAttributeNames: { // ExpressionAttributeNameMap
 *         "<keys>": "STRING_VALUE",
 *       },
 *     },
 *   },
 *   ReturnConsumedCapacity: "INDEXES" || "TOTAL" || "NONE",
 * };
 * const command = new BatchGetItemCommand(input);
 * const response = await client.send(command);
 * // { // BatchGetItemOutput
 * //   Responses: { // BatchGetResponseMap
 * //     "<keys>": [ // ItemList
 * //       { // AttributeMap
 * //         "<keys>": { // AttributeValue Union: only one key present
 * //           S: "STRING_VALUE",
 * //           N: "STRING_VALUE",
 * //           B: new Uint8Array(),
 * //           SS: [ // StringSetAttributeValue
 * //             "STRING_VALUE",
 * //           ],
 * //           NS: [ // NumberSetAttributeValue
 * //             "STRING_VALUE",
 * //           ],
 * //           BS: [ // BinarySetAttributeValue
 * //             new Uint8Array(),
 * //           ],
 * //           M: { // MapAttributeValue
 * //             "<keys>": {//  Union: only one key present
 * //               S: "STRING_VALUE",
 * //               N: "STRING_VALUE",
 * //               B: new Uint8Array(),
 * //               SS: [
 * //                 "STRING_VALUE",
 * //               ],
 * //               NS: [
 * //                 "STRING_VALUE",
 * //               ],
 * //               BS: [
 * //                 new Uint8Array(),
 * //               ],
 * //               M: {
 * //                 "<keys>": "<AttributeValue>",
 * //               },
 * //               L: [ // ListAttributeValue
 * //                 "<AttributeValue>",
 * //               ],
 * //               NULL: true || false,
 * //               BOOL: true || false,
 * //             },
 * //           },
 * //           L: [
 * //             "<AttributeValue>",
 * //           ],
 * //           NULL: true || false,
 * //           BOOL: true || false,
 * //         },
 * //       },
 * //     ],
 * //   },
 * //   UnprocessedKeys: { // BatchGetRequestMap
 * //     "<keys>": { // KeysAndAttributes
 * //       Keys: [ // KeyList // required
 * //         { // Key
 * //           "<keys>": "<AttributeValue>",
 * //         },
 * //       ],
 * //       AttributesToGet: [ // AttributeNameList
 * //         "STRING_VALUE",
 * //       ],
 * //       ConsistentRead: true || false,
 * //       ProjectionExpression: "STRING_VALUE",
 * //       ExpressionAttributeNames: { // ExpressionAttributeNameMap
 * //         "<keys>": "STRING_VALUE",
 * //       },
 * //     },
 * //   },
 * //   ConsumedCapacity: [ // ConsumedCapacityMultiple
 * //     { // ConsumedCapacity
 * //       TableName: "STRING_VALUE",
 * //       CapacityUnits: Number("double"),
 * //       ReadCapacityUnits: Number("double"),
 * //       WriteCapacityUnits: Number("double"),
 * //       Table: { // Capacity
 * //         ReadCapacityUnits: Number("double"),
 * //         WriteCapacityUnits: Number("double"),
 * //         CapacityUnits: Number("double"),
 * //       },
 * //       LocalSecondaryIndexes: { // SecondaryIndexesCapacityMap
 * //         "<keys>": {
 * //           ReadCapacityUnits: Number("double"),
 * //           WriteCapacityUnits: Number("double"),
 * //           CapacityUnits: Number("double"),
 * //         },
 * //       },
 * //       GlobalSecondaryIndexes: {
 * //         "<keys>": {
 * //           ReadCapacityUnits: Number("double"),
 * //           WriteCapacityUnits: Number("double"),
 * //           CapacityUnits: Number("double"),
 * //         },
 * //       },
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param BatchGetItemCommandInput - {@link BatchGetItemCommandInput}
 * @returns {@link BatchGetItemCommandOutput}
 * @see {@link BatchGetItemCommandInput} for command's `input` shape.
 * @see {@link BatchGetItemCommandOutput} for command's `response` shape.
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
 * @example To retrieve multiple items from a table
 * ```javascript
 * // This example reads multiple items from the Music table using a batch of three GetItem requests.  Only the AlbumTitle attribute is returned.
 * const input = {
 *   RequestItems: {
 *     Music: {
 *       Keys: [
 *         {
 *           Artist: {
 *             S: "No One You Know"
 *           },
 *           SongTitle: {
 *             S: "Call Me Today"
 *           }
 *         },
 *         {
 *           Artist: {
 *             S: "Acme Band"
 *           },
 *           SongTitle: {
 *             S: "Happy Day"
 *           }
 *         },
 *         {
 *           Artist: {
 *             S: "No One You Know"
 *           },
 *           SongTitle: {
 *             S: "Scared of My Shadow"
 *           }
 *         }
 *       ],
 *       ProjectionExpression: "AlbumTitle"
 *     }
 *   }
 * };
 * const command = new BatchGetItemCommand(input);
 * const response = await client.send(command);
 * /* response is
 * {
 *   Responses: {
 *     Music: [
 *       {
 *         AlbumTitle: {
 *           S: "Somewhat Famous"
 *         }
 *       },
 *       {
 *         AlbumTitle: {
 *           S: "Blue Sky Blues"
 *         }
 *       },
 *       {
 *         AlbumTitle: {
 *           S: "Louder Than Ever"
 *         }
 *       }
 *     ]
 *   }
 * }
 * *\/
 * ```
 *
 * @public
 */
export declare class BatchGetItemCommand extends BatchGetItemCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: BatchGetItemInput;
            output: BatchGetItemOutput;
        };
        sdk: {
            input: BatchGetItemCommandInput;
            output: BatchGetItemCommandOutput;
        };
    };
}
