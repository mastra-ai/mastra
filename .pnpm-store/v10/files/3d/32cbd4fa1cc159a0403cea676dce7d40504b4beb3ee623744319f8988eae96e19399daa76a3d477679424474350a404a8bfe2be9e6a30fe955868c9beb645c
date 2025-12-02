import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
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
import { DynamoDBDocumentClient, TranslateConfig } from "./DynamoDBDocumentClient";
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
 */
export declare class DynamoDBDocument extends DynamoDBDocumentClient {
    static from(client: DynamoDBClient, translateConfig?: TranslateConfig): DynamoDBDocument;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * BatchExecuteStatementCommand operation from {@link @aws-sdk/client-dynamodb#BatchExecuteStatementCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    batchExecuteStatement(args: BatchExecuteStatementCommandInput, options?: __HttpHandlerOptions): Promise<BatchExecuteStatementCommandOutput>;
    batchExecuteStatement(args: BatchExecuteStatementCommandInput, cb: (err: any, data?: BatchExecuteStatementCommandOutput) => void): void;
    batchExecuteStatement(args: BatchExecuteStatementCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: BatchExecuteStatementCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * BatchGetItemCommand operation from {@link @aws-sdk/client-dynamodb#BatchGetItemCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    batchGet(args: BatchGetCommandInput, options?: __HttpHandlerOptions): Promise<BatchGetCommandOutput>;
    batchGet(args: BatchGetCommandInput, cb: (err: any, data?: BatchGetCommandOutput) => void): void;
    batchGet(args: BatchGetCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: BatchGetCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * BatchWriteItemCommand operation from {@link @aws-sdk/client-dynamodb#BatchWriteItemCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    batchWrite(args: BatchWriteCommandInput, options?: __HttpHandlerOptions): Promise<BatchWriteCommandOutput>;
    batchWrite(args: BatchWriteCommandInput, cb: (err: any, data?: BatchWriteCommandOutput) => void): void;
    batchWrite(args: BatchWriteCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: BatchWriteCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * DeleteItemCommand operation from {@link @aws-sdk/client-dynamodb#DeleteItemCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    delete(args: DeleteCommandInput, options?: __HttpHandlerOptions): Promise<DeleteCommandOutput>;
    delete(args: DeleteCommandInput, cb: (err: any, data?: DeleteCommandOutput) => void): void;
    delete(args: DeleteCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: DeleteCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * ExecuteStatementCommand operation from {@link @aws-sdk/client-dynamodb#ExecuteStatementCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    executeStatement(args: ExecuteStatementCommandInput, options?: __HttpHandlerOptions): Promise<ExecuteStatementCommandOutput>;
    executeStatement(args: ExecuteStatementCommandInput, cb: (err: any, data?: ExecuteStatementCommandOutput) => void): void;
    executeStatement(args: ExecuteStatementCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ExecuteStatementCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * ExecuteTransactionCommand operation from {@link @aws-sdk/client-dynamodb#ExecuteTransactionCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    executeTransaction(args: ExecuteTransactionCommandInput, options?: __HttpHandlerOptions): Promise<ExecuteTransactionCommandOutput>;
    executeTransaction(args: ExecuteTransactionCommandInput, cb: (err: any, data?: ExecuteTransactionCommandOutput) => void): void;
    executeTransaction(args: ExecuteTransactionCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ExecuteTransactionCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * GetItemCommand operation from {@link @aws-sdk/client-dynamodb#GetItemCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    get(args: GetCommandInput, options?: __HttpHandlerOptions): Promise<GetCommandOutput>;
    get(args: GetCommandInput, cb: (err: any, data?: GetCommandOutput) => void): void;
    get(args: GetCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: GetCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * PutItemCommand operation from {@link @aws-sdk/client-dynamodb#PutItemCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    put(args: PutCommandInput, options?: __HttpHandlerOptions): Promise<PutCommandOutput>;
    put(args: PutCommandInput, cb: (err: any, data?: PutCommandOutput) => void): void;
    put(args: PutCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: PutCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * QueryCommand operation from {@link @aws-sdk/client-dynamodb#QueryCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    query(args: QueryCommandInput, options?: __HttpHandlerOptions): Promise<QueryCommandOutput>;
    query(args: QueryCommandInput, cb: (err: any, data?: QueryCommandOutput) => void): void;
    query(args: QueryCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: QueryCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * ScanCommand operation from {@link @aws-sdk/client-dynamodb#ScanCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    scan(args: ScanCommandInput, options?: __HttpHandlerOptions): Promise<ScanCommandOutput>;
    scan(args: ScanCommandInput, cb: (err: any, data?: ScanCommandOutput) => void): void;
    scan(args: ScanCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: ScanCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * TransactGetItemsCommand operation from {@link @aws-sdk/client-dynamodb#TransactGetItemsCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    transactGet(args: TransactGetCommandInput, options?: __HttpHandlerOptions): Promise<TransactGetCommandOutput>;
    transactGet(args: TransactGetCommandInput, cb: (err: any, data?: TransactGetCommandOutput) => void): void;
    transactGet(args: TransactGetCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: TransactGetCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * TransactWriteItemsCommand operation from {@link @aws-sdk/client-dynamodb#TransactWriteItemsCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    transactWrite(args: TransactWriteCommandInput, options?: __HttpHandlerOptions): Promise<TransactWriteCommandOutput>;
    transactWrite(args: TransactWriteCommandInput, cb: (err: any, data?: TransactWriteCommandOutput) => void): void;
    transactWrite(args: TransactWriteCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: TransactWriteCommandOutput) => void): void;
    /**
     * Accepts native JavaScript types instead of `AttributeValue`s, and calls
     * UpdateItemCommand operation from {@link @aws-sdk/client-dynamodb#UpdateItemCommand}.
     *
     * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
     * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
     */
    update(args: UpdateCommandInput, options?: __HttpHandlerOptions): Promise<UpdateCommandOutput>;
    update(args: UpdateCommandInput, cb: (err: any, data?: UpdateCommandOutput) => void): void;
    update(args: UpdateCommandInput, options: __HttpHandlerOptions, cb: (err: any, data?: UpdateCommandOutput) => void): void;
}
