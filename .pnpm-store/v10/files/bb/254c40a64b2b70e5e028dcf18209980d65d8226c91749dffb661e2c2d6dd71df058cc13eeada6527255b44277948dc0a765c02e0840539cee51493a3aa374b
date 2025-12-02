import { GetItemCommand as __GetItemCommand } from "@aws-sdk/client-dynamodb";
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
export type GetCommandInput = Omit<__GetItemCommandInput, "Key"> & {
    Key: Record<string, NativeAttributeValue> | undefined;
};
/**
 * @public
 */
export type GetCommandOutput = Omit<__GetItemCommandOutput, "Item"> & {
    Item?: Record<string, NativeAttributeValue> | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * GetItemCommand operation from {@link @aws-sdk/client-dynamodb#GetItemCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class GetCommand extends DynamoDBDocumentClientCommand<GetCommandInput, GetCommandOutput, __GetItemCommandInput, __GetItemCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: GetCommandInput;
    protected readonly inputKeyNodes: {
        Key: import("../commands/utils").KeyNodeChildren;
    };
    protected readonly outputKeyNodes: {
        Item: import("../commands/utils").KeyNodeChildren;
    };
    protected readonly clientCommand: __GetItemCommand;
    readonly middlewareStack: MiddlewareStack<GetCommandInput | __GetItemCommandInput, GetCommandOutput | __GetItemCommandOutput>;
    constructor(input: GetCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<GetCommandInput, GetCommandOutput>;
}
import type { GetItemCommandInput as __GetItemCommandInput, GetItemCommandOutput as __GetItemCommandOutput } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
