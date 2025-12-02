import { ExecuteTransactionCommand as __ExecuteTransactionCommand } from "@aws-sdk/client-dynamodb";
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
export type ExecuteTransactionCommandInput = Omit<__ExecuteTransactionCommandInput, "TransactStatements"> & {
    TransactStatements: (Omit<ParameterizedStatement, "Parameters"> & {
        Parameters?: NativeAttributeValue[] | undefined;
    })[] | undefined;
};
/**
 * @public
 */
export type ExecuteTransactionCommandOutput = Omit<__ExecuteTransactionCommandOutput, "Responses"> & {
    Responses?: (Omit<ItemResponse, "Item"> & {
        Item?: Record<string, NativeAttributeValue> | undefined;
    })[] | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * ExecuteTransactionCommand operation from {@link @aws-sdk/client-dynamodb#ExecuteTransactionCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class ExecuteTransactionCommand extends DynamoDBDocumentClientCommand<ExecuteTransactionCommandInput, ExecuteTransactionCommandOutput, __ExecuteTransactionCommandInput, __ExecuteTransactionCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: ExecuteTransactionCommandInput;
    protected readonly inputKeyNodes: {
        TransactStatements: {
            "*": {
                Parameters: import("../commands/utils").KeyNodeChildren;
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
    protected readonly clientCommand: __ExecuteTransactionCommand;
    readonly middlewareStack: MiddlewareStack<ExecuteTransactionCommandInput | __ExecuteTransactionCommandInput, ExecuteTransactionCommandOutput | __ExecuteTransactionCommandOutput>;
    constructor(input: ExecuteTransactionCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<ExecuteTransactionCommandInput, ExecuteTransactionCommandOutput>;
}
import type { ExecuteTransactionCommandInput as __ExecuteTransactionCommandInput, ExecuteTransactionCommandOutput as __ExecuteTransactionCommandOutput, ItemResponse, ParameterizedStatement } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
