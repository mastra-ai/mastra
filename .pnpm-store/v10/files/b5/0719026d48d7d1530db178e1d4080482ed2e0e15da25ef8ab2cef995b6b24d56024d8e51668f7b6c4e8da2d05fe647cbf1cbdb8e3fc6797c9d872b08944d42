import { DeleteItemCommand as __DeleteItemCommand } from "@aws-sdk/client-dynamodb";
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
export type DeleteCommandInput = Omit<__DeleteItemCommandInput, "Key" | "Expected" | "ExpressionAttributeValues"> & {
    Key: Record<string, NativeAttributeValue> | undefined;
    Expected?: Record<string, Omit<ExpectedAttributeValue, "Value" | "AttributeValueList"> & {
        Value?: NativeAttributeValue | undefined;
        AttributeValueList?: NativeAttributeValue[] | undefined;
    }> | undefined;
    ExpressionAttributeValues?: Record<string, NativeAttributeValue> | undefined;
};
/**
 * @public
 */
export type DeleteCommandOutput = Omit<__DeleteItemCommandOutput, "Attributes" | "ItemCollectionMetrics"> & {
    Attributes?: Record<string, NativeAttributeValue> | undefined;
    ItemCollectionMetrics?: (Omit<ItemCollectionMetrics, "ItemCollectionKey"> & {
        ItemCollectionKey?: Record<string, NativeAttributeValue> | undefined;
    }) | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * DeleteItemCommand operation from {@link @aws-sdk/client-dynamodb#DeleteItemCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class DeleteCommand extends DynamoDBDocumentClientCommand<DeleteCommandInput, DeleteCommandOutput, __DeleteItemCommandInput, __DeleteItemCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: DeleteCommandInput;
    protected readonly inputKeyNodes: {
        Key: import("../commands/utils").KeyNodeChildren;
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
    protected readonly clientCommand: __DeleteItemCommand;
    readonly middlewareStack: MiddlewareStack<DeleteCommandInput | __DeleteItemCommandInput, DeleteCommandOutput | __DeleteItemCommandOutput>;
    constructor(input: DeleteCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<DeleteCommandInput, DeleteCommandOutput>;
}
import type { DeleteItemCommandInput as __DeleteItemCommandInput, DeleteItemCommandOutput as __DeleteItemCommandOutput, ExpectedAttributeValue, ItemCollectionMetrics } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
