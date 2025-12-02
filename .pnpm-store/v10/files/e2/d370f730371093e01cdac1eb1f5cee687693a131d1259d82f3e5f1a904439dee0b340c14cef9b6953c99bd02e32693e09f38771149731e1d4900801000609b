import { TransactWriteItemsCommand as __TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { Command as $Command } from "@smithy/smithy-client";
import { DynamoDBDocumentClientCommand } from "../baseCommand/DynamoDBDocumentClientCommand";
import { ALL_VALUES } from "../commands/utils";
export { DynamoDBDocumentClientCommand, $Command };
export class TransactWriteCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        TransactItems: {
            "*": {
                ConditionCheck: {
                    Key: ALL_VALUES,
                    ExpressionAttributeValues: ALL_VALUES,
                },
                Put: {
                    Item: ALL_VALUES,
                    ExpressionAttributeValues: ALL_VALUES,
                },
                Delete: {
                    Key: ALL_VALUES,
                    ExpressionAttributeValues: ALL_VALUES,
                },
                Update: {
                    Key: ALL_VALUES,
                    ExpressionAttributeValues: ALL_VALUES,
                },
            },
        },
    };
    outputKeyNodes = {
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
        this.clientCommand = new __TransactWriteItemsCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}
