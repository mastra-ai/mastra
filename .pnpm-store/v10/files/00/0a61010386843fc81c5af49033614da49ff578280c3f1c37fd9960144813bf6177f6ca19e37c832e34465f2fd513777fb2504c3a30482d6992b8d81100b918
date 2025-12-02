import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { PutItemInput, PutItemOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link PutItemCommand}.
 */
export interface PutItemCommandInput extends PutItemInput {
}
/**
 * @public
 *
 * The output of {@link PutItemCommand}.
 */
export interface PutItemCommandOutput extends PutItemOutput, __MetadataBearer {
}
declare const PutItemCommand_base: {
    new (input: PutItemCommandInput): import("@smithy/smithy-client").CommandImpl<PutItemCommandInput, PutItemCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: PutItemCommandInput): import("@smithy/smithy-client").CommandImpl<PutItemCommandInput, PutItemCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Creates a new item, or replaces an old item with a new item. If an item that has the
 *             same primary key as the new item already exists in the specified table, the new item
 *             completely replaces the existing item. You can perform a conditional put operation (add
 *             a new item if one with the specified primary key doesn't exist), or replace an existing
 *             item if it has certain attribute values. You can return the item's attribute values in
 *             the same operation, using the <code>ReturnValues</code> parameter.</p>
 *          <p>When you add an item, the primary key attributes are the only required attributes. </p>
 *          <p>Empty String and Binary attribute values are allowed. Attribute values of type String
 *             and Binary must have a length greater than zero if the attribute is used as a key
 *             attribute for a table or index. Set type attributes cannot be empty. </p>
 *          <p>Invalid Requests with empty values will be rejected with a
 *                 <code>ValidationException</code> exception.</p>
 *          <note>
 *             <p>To prevent a new item from replacing an existing item, use a conditional
 *                 expression that contains the <code>attribute_not_exists</code> function with the
 *                 name of the attribute being used as the partition key for the table. Since every
 *                 record must contain that attribute, the <code>attribute_not_exists</code> function
 *                 will only succeed if no matching item exists.</p>
 *          </note>
 *          <p>For more information about <code>PutItem</code>, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html">Working with
 *                 Items</a> in the <i>Amazon DynamoDB Developer Guide</i>.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // PutItemInput
 *   TableName: "STRING_VALUE", // required
 *   Item: { // PutItemInputAttributeMap // required
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
 *   Expected: { // ExpectedAttributeMap
 *     "<keys>": { // ExpectedAttributeValue
 *       Value: "<AttributeValue>",
 *       Exists: true || false,
 *       ComparisonOperator: "EQ" || "NE" || "IN" || "LE" || "LT" || "GE" || "GT" || "BETWEEN" || "NOT_NULL" || "NULL" || "CONTAINS" || "NOT_CONTAINS" || "BEGINS_WITH",
 *       AttributeValueList: [ // AttributeValueList
 *         "<AttributeValue>",
 *       ],
 *     },
 *   },
 *   ReturnValues: "NONE" || "ALL_OLD" || "UPDATED_OLD" || "ALL_NEW" || "UPDATED_NEW",
 *   ReturnConsumedCapacity: "INDEXES" || "TOTAL" || "NONE",
 *   ReturnItemCollectionMetrics: "SIZE" || "NONE",
 *   ConditionalOperator: "AND" || "OR",
 *   ConditionExpression: "STRING_VALUE",
 *   ExpressionAttributeNames: { // ExpressionAttributeNameMap
 *     "<keys>": "STRING_VALUE",
 *   },
 *   ExpressionAttributeValues: { // ExpressionAttributeValueMap
 *     "<keys>": "<AttributeValue>",
 *   },
 *   ReturnValuesOnConditionCheckFailure: "ALL_OLD" || "NONE",
 * };
 * const command = new PutItemCommand(input);
 * const response = await client.send(command);
 * // { // PutItemOutput
 * //   Attributes: { // AttributeMap
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
 * //   ItemCollectionMetrics: { // ItemCollectionMetrics
 * //     ItemCollectionKey: { // ItemCollectionKeyAttributeMap
 * //       "<keys>": "<AttributeValue>",
 * //     },
 * //     SizeEstimateRangeGB: [ // ItemCollectionSizeEstimateRange
 * //       Number("double"),
 * //     ],
 * //   },
 * // };
 *
 * ```
 *
 * @param PutItemCommandInput - {@link PutItemCommandInput}
 * @returns {@link PutItemCommandOutput}
 * @see {@link PutItemCommandInput} for command's `input` shape.
 * @see {@link PutItemCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link ConditionalCheckFailedException} (client fault)
 *  <p>A condition specified in the operation failed to be evaluated.</p>
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
 * @throws {@link TransactionConflictException} (client fault)
 *  <p>Operation was rejected because there is an ongoing transaction for the
 *             item.</p>
 *
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @example To add an item to a table
 * ```javascript
 * // This example adds a new item to the Music table.
 * const input = {
 *   Item: {
 *     AlbumTitle: {
 *       S: "Somewhat Famous"
 *     },
 *     Artist: {
 *       S: "No One You Know"
 *     },
 *     SongTitle: {
 *       S: "Call Me Today"
 *     }
 *   },
 *   ReturnConsumedCapacity: "TOTAL",
 *   TableName: "Music"
 * };
 * const command = new PutItemCommand(input);
 * const response = await client.send(command);
 * /* response is
 * {
 *   ConsumedCapacity: {
 *     CapacityUnits: 1,
 *     TableName: "Music"
 *   }
 * }
 * *\/
 * ```
 *
 * @public
 */
export declare class PutItemCommand extends PutItemCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: PutItemInput;
            output: PutItemOutput;
        };
        sdk: {
            input: PutItemCommandInput;
            output: PutItemCommandOutput;
        };
    };
}
