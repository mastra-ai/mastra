import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { BatchWriteItemInput, BatchWriteItemOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link BatchWriteItemCommand}.
 */
export interface BatchWriteItemCommandInput extends BatchWriteItemInput {
}
/**
 * @public
 *
 * The output of {@link BatchWriteItemCommand}.
 */
export interface BatchWriteItemCommandOutput extends BatchWriteItemOutput, __MetadataBearer {
}
declare const BatchWriteItemCommand_base: {
    new (input: BatchWriteItemCommandInput): import("@smithy/smithy-client").CommandImpl<BatchWriteItemCommandInput, BatchWriteItemCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: BatchWriteItemCommandInput): import("@smithy/smithy-client").CommandImpl<BatchWriteItemCommandInput, BatchWriteItemCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>The <code>BatchWriteItem</code> operation puts or deletes multiple items in one or
 *             more tables. A single call to <code>BatchWriteItem</code> can transmit up to 16MB of
 *             data over the network, consisting of up to 25 item put or delete operations. While
 *             individual items can be up to 400 KB once stored, it's important to note that an item's
 *             representation might be greater than 400KB while being sent in DynamoDB's JSON format
 *             for the API call. For more details on this distinction, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html">Naming Rules and Data Types</a>.</p>
 *          <note>
 *             <p>
 *                <code>BatchWriteItem</code> cannot update items. If you perform a
 *                     <code>BatchWriteItem</code> operation on an existing item, that item's values
 *                 will be overwritten by the operation and it will appear like it was updated. To
 *                 update items, we recommend you use the <code>UpdateItem</code> action.</p>
 *          </note>
 *          <p>The individual <code>PutItem</code> and <code>DeleteItem</code> operations specified
 *             in <code>BatchWriteItem</code> are atomic; however <code>BatchWriteItem</code> as a
 *             whole is not. If any requested operations fail because the table's provisioned
 *             throughput is exceeded or an internal processing failure occurs, the failed operations
 *             are returned in the <code>UnprocessedItems</code> response parameter. You can
 *             investigate and optionally resend the requests. Typically, you would call
 *                 <code>BatchWriteItem</code> in a loop. Each iteration would check for unprocessed
 *             items and submit a new <code>BatchWriteItem</code> request with those unprocessed items
 *             until all items have been processed.</p>
 *          <p>For tables and indexes with provisioned capacity, if none of the items can be
 *             processed due to insufficient provisioned throughput on all of the tables in the
 *             request, then <code>BatchWriteItem</code> returns a
 *                 <code>ProvisionedThroughputExceededException</code>. For all tables and indexes, if
 *             none of the items can be processed due to other throttling scenarios (such as exceeding
 *             partition level limits), then <code>BatchWriteItem</code> returns a
 *                 <code>ThrottlingException</code>.</p>
 *          <important>
 *             <p>If DynamoDB returns any unprocessed items, you should retry the batch operation on
 *                 those items. However, <i>we strongly recommend that you use an exponential
 *                     backoff algorithm</i>. If you retry the batch operation immediately, the
 *                 underlying read or write requests can still fail due to throttling on the individual
 *                 tables. If you delay the batch operation using exponential backoff, the individual
 *                 requests in the batch are much more likely to succeed.</p>
 *             <p>For more information, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ErrorHandling.html#Programming.Errors.BatchOperations">Batch Operations and Error Handling</a> in the <i>Amazon DynamoDB
 *                     Developer Guide</i>.</p>
 *          </important>
 *          <p>With <code>BatchWriteItem</code>, you can efficiently write or delete large amounts of
 *             data, such as from Amazon EMR, or copy data from another database into DynamoDB. In
 *             order to improve performance with these large-scale operations,
 *                 <code>BatchWriteItem</code> does not behave in the same way as individual
 *                 <code>PutItem</code> and <code>DeleteItem</code> calls would. For example, you
 *             cannot specify conditions on individual put and delete requests, and
 *                 <code>BatchWriteItem</code> does not return deleted items in the response.</p>
 *          <p>If you use a programming language that supports concurrency, you can use threads to
 *             write items in parallel. Your application must include the necessary logic to manage the
 *             threads. With languages that don't support threading, you must update or delete the
 *             specified items one at a time. In both situations, <code>BatchWriteItem</code> performs
 *             the specified put and delete operations in parallel, giving you the power of the thread
 *             pool approach without having to introduce complexity into your application.</p>
 *          <p>Parallel processing reduces latency, but each specified put and delete request
 *             consumes the same number of write capacity units whether it is processed in parallel or
 *             not. Delete operations on nonexistent items consume one write capacity unit.</p>
 *          <p>If one or more of the following is true, DynamoDB rejects the entire batch write
 *             operation:</p>
 *          <ul>
 *             <li>
 *                <p>One or more tables specified in the <code>BatchWriteItem</code> request does
 *                     not exist.</p>
 *             </li>
 *             <li>
 *                <p>Primary key attributes specified on an item in the request do not match those
 *                     in the corresponding table's primary key schema.</p>
 *             </li>
 *             <li>
 *                <p>You try to perform multiple operations on the same item in the same
 *                         <code>BatchWriteItem</code> request. For example, you cannot put and delete
 *                     the same item in the same <code>BatchWriteItem</code> request. </p>
 *             </li>
 *             <li>
 *                <p> Your request contains at least two items with identical hash and range keys
 *                     (which essentially is two put operations). </p>
 *             </li>
 *             <li>
 *                <p>There are more than 25 requests in the batch.</p>
 *             </li>
 *             <li>
 *                <p>Any individual item in a batch exceeds 400 KB.</p>
 *             </li>
 *             <li>
 *                <p>The total request size exceeds 16 MB.</p>
 *             </li>
 *             <li>
 *                <p>Any individual items with keys exceeding the key length limits. For a
 *                     partition key, the limit is 2048 bytes and for a sort key, the limit is 1024
 *                     bytes.</p>
 *             </li>
 *          </ul>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, BatchWriteItemCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // BatchWriteItemInput
 *   RequestItems: { // BatchWriteItemRequestMap // required
 *     "<keys>": [ // WriteRequests
 *       { // WriteRequest
 *         PutRequest: { // PutRequest
 *           Item: { // PutItemInputAttributeMap // required
 *             "<keys>": { // AttributeValue Union: only one key present
 *               S: "STRING_VALUE",
 *               N: "STRING_VALUE",
 *               B: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *               SS: [ // StringSetAttributeValue
 *                 "STRING_VALUE",
 *               ],
 *               NS: [ // NumberSetAttributeValue
 *                 "STRING_VALUE",
 *               ],
 *               BS: [ // BinarySetAttributeValue
 *                 new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *               ],
 *               M: { // MapAttributeValue
 *                 "<keys>": {//  Union: only one key present
 *                   S: "STRING_VALUE",
 *                   N: "STRING_VALUE",
 *                   B: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *                   SS: [
 *                     "STRING_VALUE",
 *                   ],
 *                   NS: [
 *                     "STRING_VALUE",
 *                   ],
 *                   BS: [
 *                     new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
 *                   ],
 *                   M: {
 *                     "<keys>": "<AttributeValue>",
 *                   },
 *                   L: [ // ListAttributeValue
 *                     "<AttributeValue>",
 *                   ],
 *                   NULL: true || false,
 *                   BOOL: true || false,
 *                 },
 *               },
 *               L: [
 *                 "<AttributeValue>",
 *               ],
 *               NULL: true || false,
 *               BOOL: true || false,
 *             },
 *           },
 *         },
 *         DeleteRequest: { // DeleteRequest
 *           Key: { // Key // required
 *             "<keys>": "<AttributeValue>",
 *           },
 *         },
 *       },
 *     ],
 *   },
 *   ReturnConsumedCapacity: "INDEXES" || "TOTAL" || "NONE",
 *   ReturnItemCollectionMetrics: "SIZE" || "NONE",
 * };
 * const command = new BatchWriteItemCommand(input);
 * const response = await client.send(command);
 * // { // BatchWriteItemOutput
 * //   UnprocessedItems: { // BatchWriteItemRequestMap
 * //     "<keys>": [ // WriteRequests
 * //       { // WriteRequest
 * //         PutRequest: { // PutRequest
 * //           Item: { // PutItemInputAttributeMap // required
 * //             "<keys>": { // AttributeValue Union: only one key present
 * //               S: "STRING_VALUE",
 * //               N: "STRING_VALUE",
 * //               B: new Uint8Array(),
 * //               SS: [ // StringSetAttributeValue
 * //                 "STRING_VALUE",
 * //               ],
 * //               NS: [ // NumberSetAttributeValue
 * //                 "STRING_VALUE",
 * //               ],
 * //               BS: [ // BinarySetAttributeValue
 * //                 new Uint8Array(),
 * //               ],
 * //               M: { // MapAttributeValue
 * //                 "<keys>": {//  Union: only one key present
 * //                   S: "STRING_VALUE",
 * //                   N: "STRING_VALUE",
 * //                   B: new Uint8Array(),
 * //                   SS: [
 * //                     "STRING_VALUE",
 * //                   ],
 * //                   NS: [
 * //                     "STRING_VALUE",
 * //                   ],
 * //                   BS: [
 * //                     new Uint8Array(),
 * //                   ],
 * //                   M: {
 * //                     "<keys>": "<AttributeValue>",
 * //                   },
 * //                   L: [ // ListAttributeValue
 * //                     "<AttributeValue>",
 * //                   ],
 * //                   NULL: true || false,
 * //                   BOOL: true || false,
 * //                 },
 * //               },
 * //               L: [
 * //                 "<AttributeValue>",
 * //               ],
 * //               NULL: true || false,
 * //               BOOL: true || false,
 * //             },
 * //           },
 * //         },
 * //         DeleteRequest: { // DeleteRequest
 * //           Key: { // Key // required
 * //             "<keys>": "<AttributeValue>",
 * //           },
 * //         },
 * //       },
 * //     ],
 * //   },
 * //   ItemCollectionMetrics: { // ItemCollectionMetricsPerTable
 * //     "<keys>": [ // ItemCollectionMetricsMultiple
 * //       { // ItemCollectionMetrics
 * //         ItemCollectionKey: { // ItemCollectionKeyAttributeMap
 * //           "<keys>": "<AttributeValue>",
 * //         },
 * //         SizeEstimateRangeGB: [ // ItemCollectionSizeEstimateRange
 * //           Number("double"),
 * //         ],
 * //       },
 * //     ],
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
 * @param BatchWriteItemCommandInput - {@link BatchWriteItemCommandInput}
 * @returns {@link BatchWriteItemCommandOutput}
 * @see {@link BatchWriteItemCommandInput} for command's `input` shape.
 * @see {@link BatchWriteItemCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
 *
 * @throws {@link InvalidEndpointException} (client fault)
 *
 * @throws {@link ItemCollectionSizeLimitExceededException} (client fault)
 *  <p>An item collection is too large. This exception is only returned for tables that
 *             have one or more local secondary indexes.</p>
 *
 * @throws {@link ProvisionedThroughputExceededException} (client fault)
 *  <p>The request was denied due to request throttling. For detailed information about
 *             why the request was throttled and the ARN of the impacted resource, find the <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ThrottlingReason.html">ThrottlingReason</a> field in the returned exception. The Amazon Web Services
 *             SDKs for DynamoDB automatically retry requests that receive this exception.
 *             Your request is eventually successful, unless your retry queue is too large to finish.
 *             Reduce the frequency of requests and use exponential backoff. For more information, go
 *             to <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.Errors.html#Programming.Errors.RetryAndBackoff">Error Retries and Exponential Backoff</a> in the <i>Amazon DynamoDB Developer Guide</i>.</p>
 *
 * @throws {@link ReplicatedWriteConflictException} (client fault)
 *  <p>The request was rejected because one or more items in the request are being modified
 *             by a request in another Region. </p>
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
 * @example To add multiple items to a table
 * ```javascript
 * // This example adds three new items to the Music table using a batch of three PutItem requests.
 * const input = {
 *   RequestItems: {
 *     Music: [
 *       {
 *         PutRequest: {
 *           Item: {
 *             AlbumTitle: {
 *               S: "Somewhat Famous"
 *             },
 *             Artist: {
 *               S: "No One You Know"
 *             },
 *             SongTitle: {
 *               S: "Call Me Today"
 *             }
 *           }
 *         }
 *       },
 *       {
 *         PutRequest: {
 *           Item: {
 *             AlbumTitle: {
 *               S: "Songs About Life"
 *             },
 *             Artist: {
 *               S: "Acme Band"
 *             },
 *             SongTitle: {
 *               S: "Happy Day"
 *             }
 *           }
 *         }
 *       },
 *       {
 *         PutRequest: {
 *           Item: {
 *             AlbumTitle: {
 *               S: "Blue Sky Blues"
 *             },
 *             Artist: {
 *               S: "No One You Know"
 *             },
 *             SongTitle: {
 *               S: "Scared of My Shadow"
 *             }
 *           }
 *         }
 *       }
 *     ]
 *   }
 * };
 * const command = new BatchWriteItemCommand(input);
 * const response = await client.send(command);
 * /* response is
 * { /* empty *\/ }
 * *\/
 * ```
 *
 * @public
 */
export declare class BatchWriteItemCommand extends BatchWriteItemCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: BatchWriteItemInput;
            output: BatchWriteItemOutput;
        };
        sdk: {
            input: BatchWriteItemCommandInput;
            output: BatchWriteItemCommandOutput;
        };
    };
}
