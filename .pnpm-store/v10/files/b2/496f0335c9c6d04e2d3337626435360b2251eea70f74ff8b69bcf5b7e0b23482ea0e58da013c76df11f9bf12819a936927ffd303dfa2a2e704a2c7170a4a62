import { ExecuteTransactionCommand as __ExecuteTransactionCommand } from "@aws-sdk/client-dynamodb";
import { Command as $Command } from "@smithy/smithy-client";
import { DynamoDBDocumentClientCommand } from "../baseCommand/DynamoDBDocumentClientCommand";
import { ALL_MEMBERS, ALL_VALUES } from "../commands/utils";
export { DynamoDBDocumentClientCommand, $Command };
export class ExecuteTransactionCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        TransactStatements: {
            "*": {
                Parameters: ALL_MEMBERS,
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
        this.clientCommand = new __ExecuteTransactionCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}
