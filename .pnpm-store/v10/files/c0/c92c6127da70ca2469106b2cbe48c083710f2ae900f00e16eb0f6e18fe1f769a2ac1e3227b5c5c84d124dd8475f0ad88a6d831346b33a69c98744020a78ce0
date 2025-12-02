import { UpdateItemCommand as __UpdateItemCommand } from "@aws-sdk/client-dynamodb";
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
export type UpdateCommandInput = Omit<__UpdateItemCommandInput, "Key" | "AttributeUpdates" | "Expected" | "ExpressionAttributeValues"> & {
    Key: Record<string, NativeAttributeValue> | undefined;
    AttributeUpdates?: Record<string, Omit<AttributeValueUpdate, "Value"> & {
        Value?: NativeAttributeValue | undefined;
    }> | undefined;
    Expected?: Record<string, Omit<ExpectedAttributeValue, "Value" | "AttributeValueList"> & {
        Value?: NativeAttributeValue | undefined;
        AttributeValueList?: NativeAttributeValue[] | undefined;
    }> | undefined;
    ExpressionAttributeValues?: Record<string, NativeAttributeValue> | undefined;
};
/**
 * @public
 */
export type UpdateCommandOutput = Omit<__UpdateItemCommandOutput, "Attributes" | "ItemCollectionMetrics"> & {
    Attributes?: Record<string, NativeAttributeValue> | undefined;
    ItemCollectionMetrics?: (Omit<ItemCollectionMetrics, "ItemCollectionKey"> & {
        ItemCollectionKey?: Record<string, NativeAttributeValue> | undefined;
    }) | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * UpdateItemCommand operation from {@link @aws-sdk/client-dynamodb#UpdateItemCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class UpdateCommand extends DynamoDBDocumentClientCommand<UpdateCommandInput, UpdateCommandOutput, __UpdateItemCommandInput, __UpdateItemCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: UpdateCommandInput;
    protected readonly inputKeyNodes: {
        Key: import("../commands/utils").KeyNodeChildren;
        AttributeUpdates: {
            "*": {
                Value: null;
            };
        };
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
    protected readonly clientCommand: __UpdateItemCommand;
    readonly middlewareStack: MiddlewareStack<UpdateCommandInput | __UpdateItemCommandInput, UpdateCommandOutput | __UpdateItemCommandOutput>;
    constructor(input: UpdateCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<UpdateCommandInput, UpdateCommandOutput>;
}
import type { AttributeValueUpdate, ExpectedAttributeValue, ItemCollectionMetrics, UpdateItemCommandInput as __UpdateItemCommandInput, UpdateItemCommandOutput as __UpdateItemCommandOutput } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
