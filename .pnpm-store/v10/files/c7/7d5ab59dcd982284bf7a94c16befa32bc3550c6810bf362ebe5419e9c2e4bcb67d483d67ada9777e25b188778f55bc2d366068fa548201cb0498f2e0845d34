import { TransactGetItemsCommand as __TransactGetItemsCommand } from "@aws-sdk/client-dynamodb";
import { Command as $Command } from "@smithy/smithy-client";
import { DynamoDBDocumentClientCommand } from "../baseCommand/DynamoDBDocumentClientCommand";
import { ALL_VALUES } from "../commands/utils";
export { DynamoDBDocumentClientCommand, $Command };
export class TransactGetCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        TransactItems: {
            "*": {
                Get: {
                    Key: ALL_VALUES,
                },
            },
        },
    };
    outputKeyNodes = {
        Responses: {
            "*": {
                Item: ALL_VALUES,
            },
        },
    };
    clientCommand;
    middlewareStack;
    constructor(input) {
        super();
        this.input = input;
        this.clientCommand = new __TransactGetItemsCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}
