import { BatchWriteItemCommand as __BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { Command as $Command } from "@smithy/smithy-client";
import { DynamoDBDocumentClientCommand } from "../baseCommand/DynamoDBDocumentClientCommand";
import { ALL_VALUES } from "../commands/utils";
export { DynamoDBDocumentClientCommand, $Command };
export class BatchWriteCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        RequestItems: {
            "*": {
                "*": {
                    PutRequest: {
                        Item: ALL_VALUES,
                    },
                    DeleteRequest: {
                        Key: ALL_VALUES,
                    },
                },
            },
        },
    };
    outputKeyNodes = {
        UnprocessedItems: {
            "*": {
                "*": {
                    PutRequest: {
                        Item: ALL_VALUES,
                    },
                    DeleteRequest: {
                        Key: ALL_VALUES,
                    },
                },
            },
        },
        ItemCollectionMetrics: {
            "*": {
                "*": {
                    ItemCollectionKey: ALL_VALUES,
                },
            },
        },
    };
    clientCommand;
    middlewareStack;
    constructor(input) {
        super();
        this.input = input;
        this.clientCommand = new __BatchWriteItemCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}
