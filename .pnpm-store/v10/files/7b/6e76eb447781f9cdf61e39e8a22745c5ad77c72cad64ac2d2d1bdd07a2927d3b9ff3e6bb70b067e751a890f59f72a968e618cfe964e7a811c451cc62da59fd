import { BatchGetItemCommand as __BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
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
export type BatchGetCommandInput = Omit<__BatchGetItemCommandInput, "RequestItems"> & {
    RequestItems: Record<string, Omit<KeysAndAttributes, "Keys"> & {
        Keys: Record<string, NativeAttributeValue>[] | undefined;
    }> | undefined;
};
/**
 * @public
 */
export type BatchGetCommandOutput = Omit<__BatchGetItemCommandOutput, "Responses" | "UnprocessedKeys"> & {
    Responses?: Record<string, Record<string, NativeAttributeValue>[]> | undefined;
    UnprocessedKeys?: Record<string, Omit<KeysAndAttributes, "Keys"> & {
        Keys: Record<string, NativeAttributeValue>[] | undefined;
    }> | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * BatchGetItemCommand operation from {@link @aws-sdk/client-dynamodb#BatchGetItemCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class BatchGetCommand extends DynamoDBDocumentClientCommand<BatchGetCommandInput, BatchGetCommandOutput, __BatchGetItemCommandInput, __BatchGetItemCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: BatchGetCommandInput;
    protected readonly inputKeyNodes: {
        RequestItems: {
            "*": {
                Keys: {
                    "*": import("../commands/utils").KeyNodeChildren;
                };
            };
        };
    };
    protected readonly outputKeyNodes: {
        Responses: {
            "*": {
                "*": import("../commands/utils").KeyNodeChildren;
            };
        };
        UnprocessedKeys: {
            "*": {
                Keys: {
                    "*": import("../commands/utils").KeyNodeChildren;
                };
            };
        };
    };
    protected readonly clientCommand: __BatchGetItemCommand;
    readonly middlewareStack: MiddlewareStack<BatchGetCommandInput | __BatchGetItemCommandInput, BatchGetCommandOutput | __BatchGetItemCommandOutput>;
    constructor(input: BatchGetCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<BatchGetCommandInput, BatchGetCommandOutput>;
}
import type { BatchGetItemCommandInput as __BatchGetItemCommandInput, BatchGetItemCommandOutput as __BatchGetItemCommandOutput, KeysAndAttributes } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
