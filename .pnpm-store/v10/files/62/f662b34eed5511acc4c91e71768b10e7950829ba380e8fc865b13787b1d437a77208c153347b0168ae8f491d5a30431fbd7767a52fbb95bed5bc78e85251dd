import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { UpdateItemInput, UpdateItemOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link UpdateItemCommand}.
 */
export interface UpdateItemCommandInput extends UpdateItemInput {
}
/**
 * @public
 *
 * The output of {@link UpdateItemCommand}.
 */
export interface UpdateItemCommandOutput extends UpdateItemOutput, __MetadataBearer {
}
declare const UpdateItemCommand_base: {
    new (input: UpdateItemCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateItemCommandInput, UpdateItemCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: UpdateItemCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateItemCommandInput, UpdateItemCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Edits an existing item's attributes, or adds a new item to the table if it does not
 *             already exist. You can put, delete, or add attribute values. You can also perform a
 *             conditional update on an existing item (insert a new attribute name-value pair if it
 *             doesn't exist, or replace an existing name-value pair if it has certain expected
 *             attribute values).</p>
 *          <p>You can also return the item's attribute values in the same <code>UpdateItem</code>
 *             operation using the <code>ReturnValues</code> parameter.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // UpdateItemInput
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
 *   AttributeUpdates: { // AttributeUpdates
 *     "<keys>": { // AttributeValueUpdate
 *       Value: "<AttributeValue>",
 *       Action: "ADD" || "PUT" || "DELETE",
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
 *   ConditionalOperator: "AND" || "OR",
 *   ReturnValues: "NONE" || "ALL_OLD" || "UPDATED_OLD" || "ALL_NEW" || "UPDATED_NEW",
 *   ReturnConsumedCapacity: "INDEXES" || "TOTAL" || "NONE",
 *   ReturnItemCollectionMetrics: "SIZE" || "NONE",
 *   UpdateExpression: "STRING_VALUE",
 *   ConditionExpression: "STRING_VALUE",
 *   ExpressionAttributeNames: { // ExpressionAttributeNameMap
 *     "<keys>": "STRING_VALUE",
 *   },
 *   ExpressionAttributeValues: { // ExpressionAttributeValueMap
 *     "<keys>": "<AttributeValue>",
 *   },
 *   ReturnValuesOnConditionCheckFailure: "ALL_OLD" || "NONE",
 * };
 * const command = new UpdateItemCommand(input);
 * const response = await client.send(command);
 * // { // UpdateItemOutput
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
 * @param UpdateItemCommandInput - {@link UpdateItemCommandInput}
 * @returns {@link UpdateItemCommandOutput}
 * @see {@link UpdateItemCommandInput} for command's `input` shape.
 * @see {@link UpdateItemCommandOutput} for command's `response` shape.
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
 * @example To update an item in a table
 * ```javascript
 * // This example updates an item in the Music table. It adds a new attribute (Year) and modifies the AlbumTitle attribute.  All of the attributes in the item, as they appear after the update, are returned in the response.
 * const input = {
 *   ExpressionAttributeNames: {
 *     #AT: "AlbumTitle",
 *     #Y: "Year"
 *   },
 *   ExpressionAttributeValues: {
 *     :t: {
 *       S: "Louder Than Ever"
 *     },
 *     :y: {
 *       N: "2015"
 *     }
 *   },
 *   Key: {
 *     Artist: {
 *       S: "Acme Band"
 *     },
 *     SongTitle: {
 *       S: "Happy Day"
 *     }
 *   },
 *   ReturnValues: "ALL_NEW",
 *   TableName: "Music",
 *   UpdateExpression: "SET #Y = :y, #AT = :t"
 * };
 * const command = new UpdateItemCommand(input);
 * const response = await client.send(command);
 * /* response is
 * {
 *   Attributes: {
 *     AlbumTitle: {
 *       S: "Louder Than Ever"
 *     },
 *     Artist: {
 *       S: "Acme Band"
 *     },
 *     SongTitle: {
 *       S: "Happy Day"
 *     },
 *     Year: {
 *       N: "2015"
 *     }
 *   }
 * }
 * *\/
 * ```
 *
 * @public
 */
export declare class UpdateItemCommand extends UpdateItemCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdateItemInput;
            output: UpdateItemOutput;
        };
        sdk: {
            input: UpdateItemCommandInput;
            output: UpdateItemCommandOutput;
        };
    };
}
