import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { TransactGetItemsInput, TransactGetItemsOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link TransactGetItemsCommand}.
 */
export interface TransactGetItemsCommandInput extends TransactGetItemsInput {
}
/**
 * @public
 *
 * The output of {@link TransactGetItemsCommand}.
 */
export interface TransactGetItemsCommandOutput extends TransactGetItemsOutput, __MetadataBearer {
}
declare const TransactGetItemsCommand_base: {
    new (input: TransactGetItemsCommandInput): import("@smithy/smithy-client").CommandImpl<TransactGetItemsCommandInput, TransactGetItemsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: TransactGetItemsCommandInput): import("@smithy/smithy-client").CommandImpl<TransactGetItemsCommandInput, TransactGetItemsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>
 *             <code>TransactGetItems</code> is a synchronous operation that atomically retrieves
 *             multiple items from one or more tables (but not from indexes) in a single account and
 *             Region. A <code>TransactGetItems</code> call can contain up to 100
 *                 <code>TransactGetItem</code> objects, each of which contains a <code>Get</code>
 *             structure that specifies an item to retrieve from a table in the account and Region. A
 *             call to <code>TransactGetItems</code> cannot retrieve items from tables in more than one
 *                 Amazon Web Services account or Region. The aggregate size of the items in the
 *             transaction cannot exceed 4 MB.</p>
 *          <p>DynamoDB rejects the entire <code>TransactGetItems</code> request if any of
 *             the following is true:</p>
 *          <ul>
 *             <li>
 *                <p>A conflicting operation is in the process of updating an item to be
 *                     read.</p>
 *             </li>
 *             <li>
 *                <p>There is insufficient provisioned capacity for the transaction to be
 *                     completed.</p>
 *             </li>
 *             <li>
 *                <p>There is a user error, such as an invalid data format.</p>
 *             </li>
 *             <li>
 *                <p>The aggregate size of the items in the transaction exceeded 4 MB.</p>
 *             </li>
 *          </ul>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, TransactGetItemsCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, TransactGetItemsCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // TransactGetItemsInput
 *   TransactItems: [ // TransactGetItemList // required
 *     { // TransactGetItem
 *       Get: { // Get
 *         Key: { // Key // required
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
 *         TableName: "STRING_VALUE", // required
 *         ProjectionExpression: "STRING_VALUE",
 *         ExpressionAttributeNames: { // ExpressionAttributeNameMap
 *           "<keys>": "STRING_VALUE",
 *         },
 *       },
 *     },
 *   ],
 *   ReturnConsumedCapacity: "INDEXES" || "TOTAL" || "NONE",
 * };
 * const command = new TransactGetItemsCommand(input);
 * const response = await client.send(command);
 * // { // TransactGetItemsOutput
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
 * //   Responses: [ // ItemResponseList
 * //     { // ItemResponse
 * //       Item: { // AttributeMap
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
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param TransactGetItemsCommandInput - {@link TransactGetItemsCommandInput}
 * @returns {@link TransactGetItemsCommandOutput}
 * @see {@link TransactGetItemsCommandInput} for command's `input` shape.
 * @see {@link TransactGetItemsCommandOutput} for command's `response` shape.
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
 * @throws {@link TransactionCanceledException} (client fault)
 *  <p>The entire transaction request was canceled.</p>
 *          <p>DynamoDB cancels a <code>TransactWriteItems</code> request under the following
 *             circumstances:</p>
 *          <ul>
 *             <li>
 *                <p>A condition in one of the condition expressions is not met.</p>
 *             </li>
 *             <li>
 *                <p>A table in the <code>TransactWriteItems</code> request is in a different
 *                     account or region.</p>
 *             </li>
 *             <li>
 *                <p>More than one action in the <code>TransactWriteItems</code> operation
 *                     targets the same item.</p>
 *             </li>
 *             <li>
 *                <p>There is insufficient provisioned capacity for the transaction to be
 *                     completed.</p>
 *             </li>
 *             <li>
 *                <p>An item size becomes too large (larger than 400 KB), or a local secondary
 *                     index (LSI) becomes too large, or a similar validation error occurs because of
 *                     changes made by the transaction.</p>
 *             </li>
 *             <li>
 *                <p>There is a user error, such as an invalid data format.</p>
 *             </li>
 *             <li>
 *                <p> There is an ongoing <code>TransactWriteItems</code> operation that
 *                     conflicts with a concurrent <code>TransactWriteItems</code> request. In this
 *                     case the <code>TransactWriteItems</code> operation fails with a
 *                         <code>TransactionCanceledException</code>. </p>
 *             </li>
 *          </ul>
 *          <p>DynamoDB cancels a <code>TransactGetItems</code> request under the
 *             following circumstances:</p>
 *          <ul>
 *             <li>
 *                <p>There is an ongoing <code>TransactGetItems</code> operation that conflicts
 *                     with a concurrent <code>PutItem</code>, <code>UpdateItem</code>,
 *                         <code>DeleteItem</code> or <code>TransactWriteItems</code> request. In this
 *                     case the <code>TransactGetItems</code> operation fails with a
 *                         <code>TransactionCanceledException</code>.</p>
 *             </li>
 *             <li>
 *                <p>A table in the <code>TransactGetItems</code> request is in a different
 *                     account or region.</p>
 *             </li>
 *             <li>
 *                <p>There is insufficient provisioned capacity for the transaction to be
 *                     completed.</p>
 *             </li>
 *             <li>
 *                <p>There is a user error, such as an invalid data format.</p>
 *             </li>
 *          </ul>
 *          <note>
 *             <p>If using Java, DynamoDB lists the cancellation reasons on the
 *                     <code>CancellationReasons</code> property. This property is not set for other
 *                 languages. Transaction cancellation reasons are ordered in the order of requested
 *                 items, if an item has no error it will have <code>None</code> code and
 *                     <code>Null</code> message.</p>
 *          </note>
 *          <p>Cancellation reason codes and possible error messages:</p>
 *          <ul>
 *             <li>
 *                <p>No Errors:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>None</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Message: <code>null</code>
 *                      </p>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Conditional Check Failed:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>ConditionalCheckFailed</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Message: The conditional request failed. </p>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Item Collection Size Limit Exceeded:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>ItemCollectionSizeLimitExceeded</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Message: Collection size exceeded.</p>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Transaction Conflict:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>TransactionConflict</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Message: Transaction is ongoing for the item.</p>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Provisioned Throughput Exceeded:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>ProvisionedThroughputExceeded</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Messages:</p>
 *                      <ul>
 *                         <li>
 *                            <p>The level of configured provisioned throughput for the
 *                                     table was exceeded. Consider increasing your provisioning level
 *                                     with the UpdateTable API.</p>
 *                            <note>
 *                               <p>This Message is received when provisioned throughput is
 *                                         exceeded is on a provisioned DynamoDB
 *                                         table.</p>
 *                            </note>
 *                         </li>
 *                         <li>
 *                            <p>The level of configured provisioned throughput for one or
 *                                     more global secondary indexes of the table was exceeded.
 *                                     Consider increasing your provisioning level for the
 *                                     under-provisioned global secondary indexes with the UpdateTable
 *                                     API.</p>
 *                            <note>
 *                               <p>This message is returned when provisioned throughput is
 *                                         exceeded is on a provisioned GSI.</p>
 *                            </note>
 *                         </li>
 *                      </ul>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Throttling Error:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>ThrottlingError</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Messages: </p>
 *                      <ul>
 *                         <li>
 *                            <p>Throughput exceeds the current capacity of your table or
 *                                     index. DynamoDB is automatically scaling your table or
 *                                     index so please try again shortly. If exceptions persist, check
 *                                     if you have a hot key:
 *                                     https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html.</p>
 *                            <note>
 *                               <p>This message is returned when writes get throttled on an
 *                                         On-Demand table as DynamoDB is automatically
 *                                         scaling the table.</p>
 *                            </note>
 *                         </li>
 *                         <li>
 *                            <p>Throughput exceeds the current capacity for one or more
 *                                     global secondary indexes. DynamoDB is automatically
 *                                     scaling your index so please try again shortly.</p>
 *                            <note>
 *                               <p>This message is returned when writes get throttled on an
 *                                         On-Demand GSI as DynamoDB is automatically scaling
 *                                         the GSI.</p>
 *                            </note>
 *                         </li>
 *                      </ul>
 *                   </li>
 *                </ul>
 *             </li>
 *             <li>
 *                <p>Validation Error:</p>
 *                <ul>
 *                   <li>
 *                      <p>Code: <code>ValidationError</code>
 *                      </p>
 *                   </li>
 *                   <li>
 *                      <p>Messages: </p>
 *                      <ul>
 *                         <li>
 *                            <p>One or more parameter values were invalid.</p>
 *                         </li>
 *                         <li>
 *                            <p>The update expression attempted to update the secondary
 *                                     index key beyond allowed size limits.</p>
 *                         </li>
 *                         <li>
 *                            <p>The update expression attempted to update the secondary
 *                                     index key to unsupported type.</p>
 *                         </li>
 *                         <li>
 *                            <p>An operand in the update expression has an incorrect data
 *                                     type.</p>
 *                         </li>
 *                         <li>
 *                            <p>Item size to update has exceeded the maximum allowed
 *                                     size.</p>
 *                         </li>
 *                         <li>
 *                            <p>Number overflow. Attempting to store a number with
 *                                     magnitude larger than supported range.</p>
 *                         </li>
 *                         <li>
 *                            <p>Type mismatch for attribute to update.</p>
 *                         </li>
 *                         <li>
 *                            <p>Nesting Levels have exceeded supported limits.</p>
 *                         </li>
 *                         <li>
 *                            <p>The document path provided in the update expression is
 *                                     invalid for update.</p>
 *                         </li>
 *                         <li>
 *                            <p>The provided expression refers to an attribute that does
 *                                     not exist in the item.</p>
 *                         </li>
 *                      </ul>
 *                   </li>
 *                </ul>
 *             </li>
 *          </ul>
 *
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @public
 */
export declare class TransactGetItemsCommand extends TransactGetItemsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: TransactGetItemsInput;
            output: TransactGetItemsOutput;
        };
        sdk: {
            input: TransactGetItemsCommandInput;
            output: TransactGetItemsCommandOutput;
        };
    };
}
