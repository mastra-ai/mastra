import { ScanCommand as __ScanCommand } from "@aws-sdk/client-dynamodb";
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
export type ScanCommandInput = Omit<__ScanCommandInput, "ScanFilter" | "ExclusiveStartKey" | "ExpressionAttributeValues"> & {
    ScanFilter?: Record<string, Omit<Condition, "AttributeValueList"> & {
        AttributeValueList?: NativeAttributeValue[] | undefined;
    }> | undefined;
    ExclusiveStartKey?: Record<string, NativeAttributeValue> | undefined;
    ExpressionAttributeValues?: Record<string, NativeAttributeValue> | undefined;
};
/**
 * @public
 */
export type ScanCommandOutput = Omit<__ScanCommandOutput, "Items" | "LastEvaluatedKey"> & {
    Items?: Record<string, NativeAttributeValue>[] | undefined;
    LastEvaluatedKey?: Record<string, NativeAttributeValue> | undefined;
};
/**
 * Accepts native JavaScript types instead of `AttributeValue`s, and calls
 * ScanCommand operation from {@link @aws-sdk/client-dynamodb#ScanCommand}.
 *
 * JavaScript objects passed in as parameters are marshalled into `AttributeValue` shapes
 * required by Amazon DynamoDB. Responses from DynamoDB are unmarshalled into plain JavaScript objects.
 *
 * @public
 */
export declare class ScanCommand extends DynamoDBDocumentClientCommand<ScanCommandInput, ScanCommandOutput, __ScanCommandInput, __ScanCommandOutput, DynamoDBDocumentClientResolvedConfig> {
    readonly input: ScanCommandInput;
    protected readonly inputKeyNodes: {
        ScanFilter: {
            "*": {
                AttributeValueList: import("../commands/utils").KeyNodeChildren;
            };
        };
        ExclusiveStartKey: import("../commands/utils").KeyNodeChildren;
        ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
    };
    protected readonly outputKeyNodes: {
        Items: {
            "*": import("../commands/utils").KeyNodeChildren;
        };
        LastEvaluatedKey: import("../commands/utils").KeyNodeChildren;
    };
    protected readonly clientCommand: __ScanCommand;
    readonly middlewareStack: MiddlewareStack<ScanCommandInput | __ScanCommandInput, ScanCommandOutput | __ScanCommandOutput>;
    constructor(input: ScanCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: DynamoDBDocumentClientResolvedConfig, options?: __HttpHandlerOptions): Handler<ScanCommandInput, ScanCommandOutput>;
}
import type { Condition, ScanCommandInput as __ScanCommandInput, ScanCommandOutput as __ScanCommandOutput } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
