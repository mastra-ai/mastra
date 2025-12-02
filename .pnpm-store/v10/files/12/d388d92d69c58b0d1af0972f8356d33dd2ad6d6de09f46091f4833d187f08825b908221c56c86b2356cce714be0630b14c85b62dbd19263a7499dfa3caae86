import { UpdateItemCommand as __UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { Command as $Command } from "@smithy/smithy-client";
import { DynamoDBDocumentClientCommand } from "../baseCommand/DynamoDBDocumentClientCommand";
import { ALL_MEMBERS, ALL_VALUES, SELF } from "../commands/utils";
export { DynamoDBDocumentClientCommand, $Command };
export class UpdateCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        Key: ALL_VALUES,
        AttributeUpdates: {
            "*": {
                Value: SELF,
            },
        },
        Expected: {
            "*": {
                Value: SELF,
                AttributeValueList: ALL_MEMBERS,
            },
        },
        ExpressionAttributeValues: ALL_VALUES,
    };
    outputKeyNodes = {
        Attributes: ALL_VALUES,
        ItemCollectionMetrics: {
            ItemCollectionKey: ALL_VALUES,
        },
    };
    clientCommand;
    middlewareStack;
    constructor(input) {
        super();
        this.input = input;
        this.clientCommand = new __UpdateItemCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}
