import { PutItemCommand as __PutItemCommand } from "@aws-sdk/client-dynamodb";
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
export type PutCommandInput = Omit<__PutItemCommandInput, "Item" | "Expected" | "ExpressionAttributeValues"> & {
    Item: Record<string, NativeAttributeValue> | undefined;
    Expected?: Record<string, Omit<ExpectedAttributeValue, "Value" | "AttributeValueList"> & {
        Value?: NativeAttributeValue | undefined;
        AttributeValueList?: NativeAttributeValue[] | undefined;
    }> | undefined;
    ExpressionAttributeValues?: Record<string, NativeAttributeValue> | undefined;
};
/**
 * @public
 */
export type PutCommandOutput = Omit<__PutItemCommandOutput, "Attributes" | "ItemCollectionMetrics"> & {
    Attributes?: Record<string, NativeAttributeValue> | undefined;
    ItemCollectionMetrics?: (Omit<ItemCollectionMetrics, "ItemCollectionKey"> & {
        ItemCollectionKey?: Record<string, NativeAttributeValue> | undefined;
    }) | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * PutItemCommand operation from {@link @aws-sdk/client-dynamodb#PutItemCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class PutCommand extends DynamoDBDocumentClientCommand<PutCommandInput, PutCommandOutput, __PutItemCommandInput, __PutItemCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: PutCommandInput;
    protected readonly inputKeyNodes: {
        Item: import("../commands/utils").KeyNodeChildren;
        Expected: {
            "*": {
                Value: null;
                AttributeValueList: import("../commands/utils").KeyNodeChildren;
            };
        };
        ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
    };
    protected readonly outputKeyNodes: {
        Attributes: import("../commands/utils").KeyNodeChildren;
        ItemCollectionMetrics: {
            ItemCollectionKey: import("../commands/utils").KeyNodeChildren;
        };
    };
    protected readonly clientCommand: __PutItemCommand;
    readonly middlewareStack: MiddlewareStack<PutCommandInput | __PutItemCommandInput, PutCommandOutput | __PutItemCommandOutput>;
    constructor(input: PutCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<PutCommandInput, PutCommandOutput>;
}
import type { ExpectedAttributeValue, ItemCollectionMetrics, PutItemCommandInput as __PutItemCommandInput, PutItemCommandOutput as __PutItemCommandOutput } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
