import { setFeature } from "@aws-sdk/core";
import { Command as $Command } from "@smithy/smithy-client";
import { marshallInput, unmarshallOutput } from "../commands/utils";
export class DynamoDBDocumentClientCommand extends $Command {
    addMarshallingMiddleware(configuration) {
        const { marshallOptions = {}, unmarshallOptions = {} } = configuration.translateConfig || {};
        marshallOptions.convertTopLevelContainer = marshallOptions.convertTopLevelContainer ?? true;
        unmarshallOptions.convertWithoutMapWrapper = unmarshallOptions.convertWithoutMapWrapper ?? true;
        this.clientCommand.middlewareStack.addRelativeTo((next, context) => async (args) => {
            setFeature(context, "DDB_MAPPER", "d");
            return next({
                ...args,
                input: marshallInput(args.input, this.inputKeyNodes, marshallOptions),
            });
        }, {
            name: "DocumentMarshall",
            relation: "before",
            toMiddleware: "serializerMiddleware",
            override: true,
        });
        this.clientCommand.middlewareStack.addRelativeTo((next, context) => async (args) => {
            const deserialized = await next(args);
            deserialized.output = unmarshallOutput(deserialized.output, this.outputKeyNodes, unmarshallOptions);
            return deserialized;
        }, {
            name: "DocumentUnmarshall",
            relation: "before",
            toMiddleware: "deserializerMiddleware",
            override: true,
        });
    }
}
