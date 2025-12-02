import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { TransactWriteItemsOutput } from "../models/models_0";
import { TransactWriteItemsInput } from "../models/models_1";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link TransactWriteItemsCommand}.
 */
export interface TransactWriteItemsCommandInput extends TransactWriteItemsInput {
}
/**
 * @public
 *
 * The output of {@link TransactWriteItemsCommand}.
 */
export interface TransactWriteItemsCommandOutput extends TransactWriteItemsOutput, __MetadataBearer {
}
declare const TransactWriteItemsCommand_base: {
    new (input: TransactWriteItemsCommandInput): import("@smithy/smithy-client").CommandImpl<TransactWriteItemsCommandInput, TransactWriteItemsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: TransactWriteItemsCommandInput): import("@smithy/smithy-client").CommandImpl<TransactWriteItemsCommandInput, TransactWriteItemsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>
 *             <code>TransactWriteItems</code> is a synchronous write operation that groups up to 100
 *             action requests. These actions can target items in different tables, but not in
 *             different Amazon Web Services accounts or Regions, and no two actions can target the same
 *             item. For example, you cannot both <code>ConditionCheck</code> and <code>Update</code>
 *             the same item. The aggregate size of the items in the transaction cannot exceed 4
 *             MB.</p>
 *          <p>The actions are completed atomically so that either all of them succeed, or all of
 *             them fail. They are defined by the following objects:</p>
 *          <ul>
 *             <li>
 *                <p>
 *                   <code>Put</code>  —   Initiates a <code>PutItem</code>
 *                     operation to write a new item. This structure specifies the primary key of the
 *                     item to be written, the name of the table to write it in, an optional condition
 *                     expression that must be satisfied for the write to succeed, a list of the item's
 *                     attributes, and a field indicating whether to retrieve the item's attributes if
 *                     the condition is not met.</p>
 *             </li>
 *             <li>
 *                <p>
 *                   <code>Update</code>  —   Initiates an <code>UpdateItem</code>
 *                     operation to update an existing item. This structure specifies the primary key
 *                     of the item to be updated, the name of the table where it resides, an optional
 *                     condition expression that must be satisfied for the update to succeed, an
 *                     expression that defines one or more attributes to be updated, and a field
 *                     indicating whether to retrieve the item's attributes if the condition is not
 *                     met.</p>
 *             </li>
 *             <li>
 *                <p>
 *                   <code>Delete</code>  —   Initiates a <code>DeleteItem</code>
 *                     operation to delete an existing item. This structure specifies the primary key
 *                     of the item to be deleted, the name of the table where it resides, an optional
 *                     condition expression that must be satisfied for the deletion to succeed, and a
 *                     field indicating whether to retrieve the item's attributes if the condition is
 *                     not met.</p>
 *             </li>
 *             <li>
 *                <p>
 *                   <code>ConditionCheck</code>  —   Applies a condition to an item
 *                     that is not being modified by the transaction. This structure specifies the
 *                     primary key of the item to be checked, the name of the table where it resides, a
 *                     condition expression that must be satisfied for the transaction to succeed, and
 *                     a field indicating whether to retrieve the item's attributes if the condition is
 *                     not met.</p>
 *             </li>
 *          </ul>
 *          <p>DynamoDB rejects the entire <code>TransactWriteItems</code> request if any of the
 *             following is true:</p>
 *          <ul>
 *             <li>
 *                <p>A condition in one of the condition expressions is not met.</p>
 *             </li>
 *             <li>
 *                <p>An ongoing operation is in the process of updating the same item.</p>
 *             </li>
 *             <li>
 *                <p>There is insufficient provisioned capacity for the transaction to be
 *                     completed.</p>
 *             </li>
 *             <li>
 *                <p>An item size becomes too large (bigger than 400 KB), a local secondary index
 *                     (LSI) becomes too large, or a similar validation error occurs because of changes
 *                     made by the transaction.</p>
 *             </li>
 *             <li>
 *                <p>The aggregate size of the items in the transaction exceeds 4 MB.</p>
 *             </li>
 *             <li>
 *                <p>There is a user error, such as an invalid data format.</p>
 *             </li>
 *          </ul>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, TransactWriteItemsCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // TransactWriteItemsInput
 *   TransactItems: [ // TransactWriteItemList // required
 *     { // TransactWriteItem
 *       ConditionCheck: { // ConditionCheck
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
 *         ConditionExpression: "STRING_VALUE", // required
 *         ExpressionAttributeNames: { // ExpressionAttributeNameMap
 *           "<keys>": "STRING_VALUE",
 *         },
 *         ExpressionAttributeValues: { // ExpressionAttributeValueMap
 *           "<keys>": "<AttributeValue>",
 *         },
 *         ReturnValuesOnConditionCheckFailure: "ALL_OLD" || "NONE",
 *       },
 *       Put: { // Put
 *         Item: { // PutItemInputAttributeMap // required
 *           "<keys>": "<AttributeValue>",
 *         },
 *         TableName: "STRING_VALUE", // required
 *         ConditionExpression: "STRING_VALUE",
 *         ExpressionAttributeNames: {
 *           "<keys>": "STRING_VALUE",
 *         },
 *         ExpressionAttributeValues: {
 *           "<keys>": "<AttributeValue>",
 *         },
 *         ReturnValuesOnConditionCheckFailure: "ALL_OLD" || "NONE",
 *       },
 *       Delete: { // Delete
 *         Key: { // required
 *           "<keys>": "<AttributeValue>",
 *         },
 *         TableName: "STRING_VALUE", // required
 *         ConditionExpression: "STRING_VALUE",
 *         ExpressionAttributeNames: {
 *           "<keys>": "STRING_VALUE",
 *         },
 *         ExpressionAttributeValues: {
 *           "<keys>": "<AttributeValue>",
 *         },
 *         ReturnValuesOnConditionCheckFailure: "ALL_OLD" || "NONE",
 *       },
 *       Update: { // Update
 *         Key: { // required
 *           "<keys>": "<AttributeValue>",
 *         },
 *         UpdateExpression: "STRING_VALUE", // required
 *         TableName: "STRING_VALUE", // required
 *         ConditionExpression: "STRING_VALUE",
 *         ExpressionAttributeNames: {
 *           "<keys>": "STRING_VALUE",
 *         },
 *         ExpressionAttributeValues: {
 *           "<keys>": "<AttributeValue>",
 *         },
 *         ReturnValuesOnConditionCheckFailure: "ALL_OLD" || "NONE",
 *       },
 *     },
 *   ],
 *   ReturnConsumedCapacity: "INDEXES" || "TOTAL" || "NONE",
 *   ReturnItemCollectionMetrics: "SIZE" || "NONE",
 *   ClientRequestToken: "STRING_VALUE",
 * };
 * const command = new TransactWriteItemsCommand(input);
 * const response = await client.send(command);
 * // { // TransactWriteItemsOutput
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
 * //   ItemCollectionMetrics: { // ItemCollectionMetricsPerTable
 * //     "<keys>": [ // ItemCollectionMetricsMultiple
 * //       { // ItemCollectionMetrics
 * //         ItemCollectionKey: { // ItemCollectionKeyAttributeMap
 * //           "<keys>": { // AttributeValue Union: only one key present
 * //             S: "STRING_VALUE",
 * //             N: "STRING_VALUE",
 * //             B: new Uint8Array(),
 * //             SS: [ // StringSetAttributeValue
 * //               "STRING_VALUE",
 * //             ],
 * //             NS: [ // NumberSetAttributeValue
 * //               "STRING_VALUE",
 * //             ],
 * //             BS: [ // BinarySetAttributeValue
 * //               new Uint8Array(),
 * //             ],
 * //             M: { // MapAttributeValue
 * //               "<keys>": {//  Union: only one key present
 * //                 S: "STRING_VALUE",
 * //                 N: "STRING_VALUE",
 * //                 B: new Uint8Array(),
 * //                 SS: [
 * //                   "STRING_VALUE",
 * //                 ],
 * //                 NS: [
 * //                   "STRING_VALUE",
 * //                 ],
 * //                 BS: [
 * //                   new Uint8Array(),
 * //                 ],
 * //                 M: {
 * //                   "<keys>": "<AttributeValue>",
 * //                 },
 * //                 L: [ // ListAttributeValue
 * //                   "<AttributeValue>",
 * //                 ],
 * //                 NULL: true || false,
 * //                 BOOL: true || false,
 * //               },
 * //             },
 * //             L: [
 * //               "<AttributeValue>",
 * //             ],
 * //             NULL: true || false,
 * //             BOOL: true || false,
 * //           },
 * //         },
 * //         SizeEstimateRangeGB: [ // ItemCollectionSizeEstimateRange
 * //           Number("double"),
 * //         ],
 * //       },
 * //     ],
 * //   },
 * // };
 *
 * ```
 *
 * @param TransactWriteItemsCommandInput - {@link TransactWriteItemsCommandInput}
 * @returns {@link TransactWriteItemsCommandOutput}
 * @see {@link TransactWriteItemsCommandInput} for command's `input` shape.
 * @see {@link TransactWriteItemsCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link IdempotentParameterMismatchException} (client fault)
 *  <p>DynamoDB rejected the request because you retried a request with a
 *             different payload but with an idempotent token that was already used.</p>
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
 * @throws {@link TransactionInProgressException} (client fault)
 *  <p>The transaction with the given request token is already in progress.</p>
 *          <p> Recommended Settings </p>
 *          <note>
 *             <p> This is a general recommendation for handling the
 *                     <code>TransactionInProgressException</code>. These settings help ensure that the
 *                 client retries will trigger completion of the ongoing
 *                     <code>TransactWriteItems</code> request. </p>
 *          </note>
 *          <ul>
 *             <li>
 *                <p> Set <code>clientExecutionTimeout</code> to a value that allows at least one
 *                     retry to be processed after 5 seconds have elapsed since the first attempt for
 *                     the <code>TransactWriteItems</code> operation. </p>
 *             </li>
 *             <li>
 *                <p> Set <code>socketTimeout</code> to a value a little lower than the
 *                         <code>requestTimeout</code> setting. </p>
 *             </li>
 *             <li>
 *                <p>
 *                   <code>requestTimeout</code> should be set based on the time taken for the
 *                     individual retries of a single HTTP request for your use case, but setting it to
 *                     1 second or higher should work well to reduce chances of retries and
 *                         <code>TransactionInProgressException</code> errors. </p>
 *             </li>
 *             <li>
 *                <p> Use exponential backoff when retrying and tune backoff if needed. </p>
 *             </li>
 *          </ul>
 *          <p> Assuming <a href="https://github.com/aws/aws-sdk-java/blob/fd409dee8ae23fb8953e0bb4dbde65536a7e0514/aws-java-sdk-core/src/main/java/com/amazonaws/retry/PredefinedRetryPolicies.java#L97">default retry policy</a>, example timeout settings based on the guidelines
 *             above are as follows: </p>
 *          <p>Example timeline:</p>
 *          <ul>
 *             <li>
 *                <p>0-1000 first attempt</p>
 *             </li>
 *             <li>
 *                <p>1000-1500 first sleep/delay (default retry policy uses 500 ms as base delay
 *                     for 4xx errors)</p>
 *             </li>
 *             <li>
 *                <p>1500-2500 second attempt</p>
 *             </li>
 *             <li>
 *                <p>2500-3500 second sleep/delay (500 * 2, exponential backoff)</p>
 *             </li>
 *             <li>
 *                <p>3500-4500 third attempt</p>
 *             </li>
 *             <li>
 *                <p>4500-6500 third sleep/delay (500 * 2^2)</p>
 *             </li>
 *             <li>
 *                <p>6500-7500 fourth attempt (this can trigger inline recovery since 5 seconds
 *                     have elapsed since the first attempt reached TC)</p>
 *             </li>
 *          </ul>
 *
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @public
 */
export declare class TransactWriteItemsCommand extends TransactWriteItemsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: TransactWriteItemsInput;
            output: TransactWriteItemsOutput;
        };
        sdk: {
            input: TransactWriteItemsCommandInput;
            output: TransactWriteItemsCommandOutput;
        };
    };
}
