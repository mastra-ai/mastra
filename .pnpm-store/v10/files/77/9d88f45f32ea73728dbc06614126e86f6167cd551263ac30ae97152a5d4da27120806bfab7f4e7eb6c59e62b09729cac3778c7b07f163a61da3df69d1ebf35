import { DynamoDBClient, DynamoDBClientResolvedConfig, ServiceInputTypes as __ServiceInputTypes, ServiceOutputTypes as __ServiceOutputTypes } from "@aws-sdk/client-dynamodb";
import { marshallOptions, unmarshallOptions } from "@aws-sdk/util-dynamodb";
import { Client as __Client } from "@smithy/smithy-client";
import { HttpHandlerOptions as __HttpHandlerOptions } from "@smithy/types";
import { BatchExecuteStatementCommandInput, BatchExecuteStatementCommandOutput } from "./commands/BatchExecuteStatementCommand";
import { BatchGetCommandInput, BatchGetCommandOutput } from "./commands/BatchGetCommand";
import { BatchWriteCommandInput, BatchWriteCommandOutput } from "./commands/BatchWriteCommand";
import { DeleteCommandInput, DeleteCommandOutput } from "./commands/DeleteCommand";
import { ExecuteStatementCommandInput, ExecuteStatementCommandOutput } from "./commands/ExecuteStatementCommand";
import { ExecuteTransactionCommandInput, ExecuteTransactionCommandOutput } from "./commands/ExecuteTransactionCommand";
import { GetCommandInput, GetCommandOutput } from "./commands/GetCommand";
import { PutCommandInput, PutCommandOutput } from "./commands/PutCommand";
import { QueryCommandInput, QueryCommandOutput } from "./commands/QueryCommand";
import { ScanCommandInput, ScanCommandOutput } from "./commands/ScanCommand";
import { TransactGetCommandInput, TransactGetCommandOutput } from "./commands/TransactGetCommand";
import { TransactWriteCommandInput, TransactWriteCommandOutput } from "./commands/TransactWriteCommand";
import { UpdateCommandInput, UpdateCommandOutput } from "./commands/UpdateCommand";
/**
 * @public
 */
export { __Client };
/**
 * @public
 */
export type ServiceInputTypes = __ServiceInputTypes | BatchExecuteStatementCommandInput | BatchGetCommandInput | BatchWriteCommandInput | DeleteCommandInput | ExecuteStatementCommandInput | ExecuteTransactionCommandInput | GetCommandInput | PutCommandInput | QueryCommandInput | ScanCommandInput | TransactGetCommandInput | TransactWriteCommandInput | UpdateCommandInput;
/**
 * @public
 */
export type ServiceOutputTypes = __ServiceOutputTypes | BatchExecuteStatementCommandOutput | BatchGetCommandOutput | BatchWriteCommandOutput | DeleteCommandOutput | ExecuteStatementCommandOutput | ExecuteTransactionCommandOutput | GetCommandOutput | PutCommandOutput | QueryCommandOutput | ScanCommandOutput | TransactGetCommandOutput | TransactWriteCommandOutput | UpdateCommandOutput;
/**
 * @public
 */
export type TranslateConfig = {
    marshallOptions?: marshallOptions;
    unmarshallOptions?: unmarshallOptions;
};
/**
 * @public
 */
export type DynamoDBDocumentClientResolvedConfig = DynamoDBClientResolvedConfig & {
    translateConfig?: TranslateConfig;
};
/**
 * The document client simplifies working with items in Amazon DynamoDB by
 * abstracting away the notion of attribute values. This abstraction annotates native
 * JavaScript types supplied as input parameters, as well as converts annotated
 * response data to native JavaScript types.
 *
 * ## Marshalling Input and Unmarshalling Response Data
 *
 * The document client affords developers the use of native JavaScript types
 * instead of `AttributeValue`s to simplify the JavaScript development
 * experience with Amazon DynamoDB. JavaScript objects passed in as parameters
 * are marshalled into `AttributeValue` shapes required by Amazon DynamoDB.
 * Responses from DynamoDB are unmarshalled into plain JavaScript objects
 * by the `DocumentClient`. The `DocumentClient` does not accept
 * `AttributeValue`s in favor of native JavaScript types.
 *
 * |          JavaScript Type          | DynamoDB AttributeValue |
 * | :-------------------------------: | ----------------------- |
 * |              String               | S                       |
 * |          Number / BigInt          | N                       |
 * |              Boolean              | BOOL                    |
 * |               null                | NULL                    |
 * |               Array               | L                       |
 * |              Object               | M                       |
 * |   Set\<Uint8Array, Blob, ...\>    | BS                      |
 * |       Set\<Number, BigInt\>       | NS                      |
 * |           Set\<String\>           | SS                      |
 * | Uint8Array, Buffer, File, Blob... | B                       |
 *
 * ### Example
 *
 * Here is an example list which is sent to DynamoDB client in an operation:
 *
 * ```json
 * { "L": [{ "NULL": true }, { "BOOL": false }, { "N": 1 }, { "S": "two" }] }
 * ```
 *
 * The DynamoDB document client abstracts the attribute values as follows in
 * both input and output:
 *
 * ```json
 * [null, false, 1, "two"]
 * ```
 *
 * @see {@link https://www.npmjs.com/package/@aws-sdk/client-dynamodb | @aws-sdk/client-dynamodb}
 *
 * @public
 */
export declare class DynamoDBDocumentClient extends __Client<__HttpHandlerOptions, ServiceInputTypes, ServiceOutputTypes, DynamoDBDocumentClientResolvedConfig> {
    readonly config: DynamoDBDocumentClientResolvedConfig;
    protected constructor(client: DynamoDBClient, translateConfig?: TranslateConfig);
    static from(client: DynamoDBClient, translateConfig?: TranslateConfig): DynamoDBDocumentClient;
    destroy(): void;
}
