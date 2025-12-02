import { ExecuteStatementCommand as __ExecuteStatementCommand } from "@aws-sdk/client-dynamodb";
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
export type ExecuteStatementCommandInput = Omit<__ExecuteStatementCommandInput, "Parameters"> & {
    Parameters?: NativeAttributeValue[] | undefined;
};
/**
 * @public
 */
export type ExecuteStatementCommandOutput = Omit<__ExecuteStatementCommandOutput, "Items" | "LastEvaluatedKey"> & {
    Items?: Record<string, NativeAttributeValue>[] | undefined;
    LastEvaluatedKey?: Record<string, NativeAttributeValue> | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * ExecuteStatementCommand operation from {@link @aws-sdk/client-dynamodb#ExecuteStatementCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class ExecuteStatementCommand extends DynamoDBDocumentClientCommand<ExecuteStatementCommandInput, ExecuteStatementCommandOutput, __ExecuteStatementCommandInput, __ExecuteStatementCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: ExecuteStatementCommandInput;
    protected readonly inputKeyNodes: {
        Parameters: import("../commands/utils").KeyNodeChildren;
    };
    protected readonly outputKeyNodes: {
        Items: {
            "*": import("../commands/utils").KeyNodeChildren;
        };
        LastEvaluatedKey: import("../commands/utils").KeyNodeChildren;
    };
    protected readonly clientCommand: __ExecuteStatementCommand;
    readonly middlewareStack: MiddlewareStack<ExecuteStatementCommandInput | __ExecuteStatementCommandInput, ExecuteStatementCommandOutput | __ExecuteStatementCommandOutput>;
    constructor(input: ExecuteStatementCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<ExecuteStatementCommandInput, ExecuteStatementCommandOutput>;
}
import type { ExecuteStatementCommandInput as __ExecuteStatementCommandInput, ExecuteStatementCommandOutput as __ExecuteStatementCommandOutput } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
