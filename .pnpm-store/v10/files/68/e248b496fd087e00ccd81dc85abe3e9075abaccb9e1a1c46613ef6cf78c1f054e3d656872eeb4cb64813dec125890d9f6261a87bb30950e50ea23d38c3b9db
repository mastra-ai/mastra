import { BatchExecuteStatementCommand as __BatchExecuteStatementCommand } from "@aws-sdk/client-dynamodb";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MiddlewareStack } from "@smithy/types";
import { DynamoDBDocumentClientCommand } from "../baseCommand/DynamoDBDocumentClientCommand";
import { DynamoDBDocumentClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBDocumentClient";
/**
 * @public
 */
export { DynamoDBDocumentClientCommand, $Command };
/**
 * @public
 */
export type BatchExecuteStatementCommandInput = Omit<__BatchExecuteStatementCommandInput, "Statements"> & {
    Statements: (Omit<BatchStatementRequest, "Parameters"> & {
        Parameters?: NativeAttributeValue[] | undefined;
    })[] | undefined;
};
/**
 * @public
 */
export type BatchExecuteStatementCommandOutput = Omit<__BatchExecuteStatementCommandOutput, "Responses"> & {
    Responses?: (Omit<BatchStatementResponse, "Error" | "Item"> & {
        Error?: (Omit<BatchStatementError, "Item"> & {
            Item?: Record<string, NativeAttributeValue> | undefined;
        }) | undefined;
        Item?: Record<string, NativeAttributeValue> | undefined;
    })[] | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * BatchExecuteStatementCommand operation from {@link @aws-sdk/client-dynamodb#BatchExecuteStatementCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class BatchExecuteStatementCommand extends DynamoDBDocumentClientCommand<BatchExecuteStatementCommandInput, BatchExecuteStatementCommandOutput, __BatchExecuteStatementCommandInput, __BatchExecuteStatementCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: BatchExecuteStatementCommandInput;
    protected readonly inputKeyNodes: {
        Statements: {
            "*": {
                Parameters: import("../commands/utils").KeyNodeChildren;
            };
        };
    };
    protected readonly outputKeyNodes: {
        Responses: {
            "*": {
                Error: {
                    Item: import("../commands/utils").KeyNodeChildren;
                };
                Item: import("../commands/utils").KeyNodeChildren;
            };
        };
    };
    protected readonly clientCommand: __BatchExecuteStatementCommand;
    readonly middlewareStack: MiddlewareStack<BatchExecuteStatementCommandInput | __BatchExecuteStatementCommandInput, BatchExecuteStatementCommandOutput | __BatchExecuteStatementCommandOutput>;
    constructor(input: BatchExecuteStatementCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<BatchExecuteStatementCommandInput, BatchExecuteStatementCommandOutput>;
}
import type { BatchExecuteStatementCommandInput as __BatchExecuteStatementCommandInput, BatchExecuteStatementCommandOutput as __BatchExecuteStatementCommandOutput, BatchStatementError, BatchStatementRequest, BatchStatementResponse } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
