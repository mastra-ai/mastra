import { BatchWriteItemCommand as __BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
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
export type BatchWriteCommandInput = Omit<__BatchWriteItemCommandInput, "RequestItems"> & {
    RequestItems: Record<string, (Omit<WriteRequest, "PutRequest" | "DeleteRequest"> & {
        PutRequest?: (Omit<PutRequest, "Item"> & {
            Item: Record<string, NativeAttributeValue> | undefined;
        }) | undefined;
        DeleteRequest?: (Omit<DeleteRequest, "Key"> & {
            Key: Record<string, NativeAttributeValue> | undefined;
        }) | undefined;
    })[]> | undefined;
};
/**
 * @public
 */
export type BatchWriteCommandOutput = Omit<__BatchWriteItemCommandOutput, "UnprocessedItems" | "ItemCollectionMetrics"> & {
    UnprocessedItems?: Record<string, (Omit<WriteRequest, "PutRequest" | "DeleteRequest"> & {
        PutRequest?: (Omit<PutRequest, "Item"> & {
            Item: Record<string, NativeAttributeValue> | undefined;
        }) | undefined;
        DeleteRequest?: (Omit<DeleteRequest, "Key"> & {
            Key: Record<string, NativeAttributeValue> | undefined;
        }) | undefined;
    })[]> | undefined;
    ItemCollectionMetrics?: Record<string, (Omit<ItemCollectionMetrics, "ItemCollectionKey"> & {
        ItemCollectionKey?: Record<string, NativeAttributeValue> | undefined;
    })[]> | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * BatchWriteItemCommand operation from {@link @aws-sdk/client-dynamodb#BatchWriteItemCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class BatchWriteCommand extends DynamoDBDocumentClientCommand<BatchWriteCommandInput, BatchWriteCommandOutput, __BatchWriteItemCommandInput, __BatchWriteItemCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: BatchWriteCommandInput;
    protected readonly inputKeyNodes: {
        RequestItems: {
            "*": {
                "*": {
                    PutRequest: {
                        Item: import("../commands/utils").KeyNodeChildren;
                    };
                    DeleteRequest: {
                        Key: import("../commands/utils").KeyNodeChildren;
                    };
                };
            };
        };
    };
    protected readonly outputKeyNodes: {
        UnprocessedItems: {
            "*": {
                "*": {
                    PutRequest: {
                        Item: import("../commands/utils").KeyNodeChildren;
                    };
                    DeleteRequest: {
                        Key: import("../commands/utils").KeyNodeChildren;
                    };
                };
            };
        };
        ItemCollectionMetrics: {
            "*": {
                "*": {
                    ItemCollectionKey: import("../commands/utils").KeyNodeChildren;
                };
            };
        };
    };
    protected readonly clientCommand: __BatchWriteItemCommand;
    readonly middlewareStack: MiddlewareStack<BatchWriteCommandInput | __BatchWriteItemCommandInput, BatchWriteCommandOutput | __BatchWriteItemCommandOutput>;
    constructor(input: BatchWriteCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<BatchWriteCommandInput, BatchWriteCommandOutput>;
}
import type { BatchWriteItemCommandInput as __BatchWriteItemCommandInput, BatchWriteItemCommandOutput as __BatchWriteItemCommandOutput, DeleteRequest, ItemCollectionMetrics, PutRequest, WriteRequest } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
