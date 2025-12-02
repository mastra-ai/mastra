import { QueryCommand as __QueryCommand } from "@aws-sdk/client-dynamodb";
import { Command as $Command } from "@smithy/smithy-client";
import { DynamoDBDocumentClientCommand } from "../baseCommand/DynamoDBDocumentClientCommand";
import { ALL_MEMBERS, ALL_VALUES } from "../commands/utils";
export { DynamoDBDocumentClientCommand, $Command };
export class QueryCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        KeyConditions: {
            "*": {
                AttributeValueList: ALL_MEMBERS,
            },
        },
        QueryFilter: {
            "*": {
                AttributeValueList: ALL_MEMBERS,
            },
        },
        ExclusiveStartKey: ALL_VALUES,
        ExpressionAttributeValues: ALL_VALUES,
    };
    outputKeyNodes = {
        Items: {
            "*": ALL_VALUES,
        },
        LastEvaluatedKey: ALL_VALUES,
    };
    clientCommand;
    middlewareStack;
    constructor(input) {
        super();
        this.input = input;
        this.clientCommand = new __QueryCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}
