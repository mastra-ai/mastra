import { TransactWriteItemsCommand as __TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
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
export type TransactWriteCommandInput = Omit<__TransactWriteItemsCommandInput, "TransactItems"> & {
    TransactItems: (Omit<TransactWriteItem, "ConditionCheck" | "Put" | "Delete" | "Update"> & {
        ConditionCheck?: (Omit<ConditionCheck, "Key" | "ExpressionAttributeValues"> & {
            Key: Record<string, NativeAttributeValue> | undefined;
            ExpressionAttributeValues?: Record<string, NativeAttributeValue> | undefined;
        }) | undefined;
        Put?: (Omit<Put, "Item" | "ExpressionAttributeValues"> & {
            Item: Record<string, NativeAttributeValue> | undefined;
            ExpressionAttributeValues?: Record<string, NativeAttributeValue> | undefined;
        }) | undefined;
        Delete?: (Omit<Delete, "Key" | "ExpressionAttributeValues"> & {
            Key: Record<string, NativeAttributeValue> | undefined;
            ExpressionAttributeValues?: Record<string, NativeAttributeValue> | undefined;
        }) | undefined;
        Update?: (Omit<Update, "Key" | "ExpressionAttributeValues"> & {
            Key: Record<string, NativeAttributeValue> | undefined;
            ExpressionAttributeValues?: Record<string, NativeAttributeValue> | undefined;
        }) | undefined;
    })[] | undefined;
};
/**
 * @public
 */
export type TransactWriteCommandOutput = Omit<__TransactWriteItemsCommandOutput, "ItemCollectionMetrics"> & {
    ItemCollectionMetrics?: Record<string, (Omit<ItemCollectionMetrics, "ItemCollectionKey"> & {
        ItemCollectionKey?: Record<string, NativeAttributeValue> | undefined;
    })[]> | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * TransactWriteItemsCommand operation from {@link @aws-sdk/client-dynamodb#TransactWriteItemsCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class TransactWriteCommand extends DynamoDBDocumentClientCommand<TransactWriteCommandInput, TransactWriteCommandOutput, __TransactWriteItemsCommandInput, __TransactWriteItemsCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: TransactWriteCommandInput;
    protected readonly inputKeyNodes: {
        TransactItems: {
            "*": {
                ConditionCheck: {
                    Key: import("../commands/utils").KeyNodeChildren;
                    ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
                };
                Put: {
                    Item: import("../commands/utils").KeyNodeChildren;
                    ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
                };
                Delete: {
                    Key: import("../commands/utils").KeyNodeChildren;
                    ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
                };
                Update: {
                    Key: import("../commands/utils").KeyNodeChildren;
                    ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
                };
            };
        };
    };
    protected readonly outputKeyNodes: {
        ItemCollectionMetrics: {
            "*": {
                "*": {
                    ItemCollectionKey: import("../commands/utils").KeyNodeChildren;
                };
            };
        };
    };
    protected readonly clientCommand: __TransactWriteItemsCommand;
    readonly middlewareStack: MiddlewareStack<TransactWriteCommandInput | __TransactWriteItemsCommandInput, TransactWriteCommandOutput | __TransactWriteItemsCommandOutput>;
    constructor(input: TransactWriteCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<TransactWriteCommandInput, TransactWriteCommandOutput>;
}
import type { ConditionCheck, Delete, ItemCollectionMetrics, Put, TransactWriteItem, TransactWriteItemsCommandInput as __TransactWriteItemsCommandInput, TransactWriteItemsCommandOutput as __TransactWriteItemsCommandOutput, Update } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
