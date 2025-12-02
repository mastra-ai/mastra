import { TransactGetItemsCommand as __TransactGetItemsCommand } from "@aws-sdk/client-dynamodb";
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
export type TransactGetCommandInput = Omit<__TransactGetItemsCommandInput, "TransactItems"> & {
    TransactItems: (Omit<TransactGetItem, "Get"> & {
        Get: (Omit<Get, "Key"> & {
            Key: Record<string, NativeAttributeValue> | undefined;
        }) | undefined;
    })[] | undefined;
};
/**
 * @public
 */
export type TransactGetCommandOutput = Omit<__TransactGetItemsCommandOutput, "Responses"> & {
    Responses?: (Omit<ItemResponse, "Item"> & {
        Item?: Record<string, NativeAttributeValue> | undefined;
    })[] | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * TransactGetItemsCommand operation from {@link @aws-sdk/client-dynamodb#TransactGetItemsCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class TransactGetCommand extends DynamoDBDocumentClientCommand<TransactGetCommandInput, TransactGetCommandOutput, __TransactGetItemsCommandInput, __TransactGetItemsCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: TransactGetCommandInput;
    protected readonly inputKeyNodes: {
        TransactItems: {
            "*": {
                Get: {
                    Key: import("../commands/utils").KeyNodeChildren;
                };
            };
        };
    };
    protected readonly outputKeyNodes: {
        Responses: {
            "*": {
                Item: import("../commands/utils").KeyNodeChildren;
            };
        };
    };
    protected readonly clientCommand: __TransactGetItemsCommand;
    readonly middlewareStack: MiddlewareStack<TransactGetCommandInput | __TransactGetItemsCommandInput, TransactGetCommandOutput | __TransactGetItemsCommandOutput>;
    constructor(input: TransactGetCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<TransactGetCommandInput, TransactGetCommandOutput>;
}
import type { Get, ItemResponse, TransactGetItem, TransactGetItemsCommandInput as __TransactGetItemsCommandInput, TransactGetItemsCommandOutput as __TransactGetItemsCommandOutput } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
