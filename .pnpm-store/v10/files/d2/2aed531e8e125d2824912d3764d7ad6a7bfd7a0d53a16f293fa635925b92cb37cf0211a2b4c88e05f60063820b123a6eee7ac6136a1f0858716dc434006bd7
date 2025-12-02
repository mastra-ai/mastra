'use strict';

var clientDynamodb = require('@aws-sdk/client-dynamodb');
var smithyClient = require('@smithy/smithy-client');
var core = require('@aws-sdk/core');
var utilDynamodb = require('@aws-sdk/util-dynamodb');
var core$1 = require('@smithy/core');

const SELF = null;
const ALL_VALUES = {};
const ALL_MEMBERS = [];
const NEXT_LEVEL = "*";
const processObj = (obj, processFunc, keyNodes) => {
    if (obj !== undefined) {
        if (keyNodes == null) {
            return processFunc(obj);
        }
        else {
            const keys = Object.keys(keyNodes);
            const goToNextLevel = keys.length === 1 && keys[0] === NEXT_LEVEL;
            const someChildren = keys.length >= 1 && !goToNextLevel;
            const allChildren = keys.length === 0;
            if (someChildren) {
                return processKeysInObj(obj, processFunc, keyNodes);
            }
            else if (allChildren) {
                return processAllKeysInObj(obj, processFunc, SELF);
            }
            else if (goToNextLevel) {
                return Object.entries(obj ?? {}).reduce((acc, [k, v]) => {
                    if (typeof v !== "function") {
                        acc[k] = processObj(v, processFunc, keyNodes[NEXT_LEVEL]);
                    }
                    return acc;
                }, (Array.isArray(obj) ? [] : {}));
            }
        }
    }
    return undefined;
};
const processKeysInObj = (obj, processFunc, keyNodes) => {
    let accumulator;
    if (Array.isArray(obj)) {
        accumulator = obj.filter((item) => typeof item !== "function");
    }
    else {
        accumulator = {};
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v !== "function") {
                accumulator[k] = v;
            }
        }
    }
    for (const [nodeKey, nodes] of Object.entries(keyNodes)) {
        if (typeof obj[nodeKey] === "function") {
            continue;
        }
        const processedValue = processObj(obj[nodeKey], processFunc, nodes);
        if (processedValue !== undefined && typeof processedValue !== "function") {
            accumulator[nodeKey] = processedValue;
        }
    }
    return accumulator;
};
const processAllKeysInObj = (obj, processFunc, keyNodes) => {
    if (Array.isArray(obj)) {
        return obj.filter((item) => typeof item !== "function").map((item) => processObj(item, processFunc, keyNodes));
    }
    return Object.entries(obj).reduce((acc, [key, value]) => {
        if (typeof value === "function") {
            return acc;
        }
        const processedValue = processObj(value, processFunc, keyNodes);
        if (processedValue !== undefined && typeof processedValue !== "function") {
            acc[key] = processedValue;
        }
        return acc;
    }, {});
};
const marshallInput = (obj, keyNodes, options) => {
    const marshallFunc = (toMarshall) => utilDynamodb.marshall(toMarshall, options);
    return processKeysInObj(obj, marshallFunc, keyNodes);
};
const unmarshallOutput = (obj, keyNodes, options) => {
    const unmarshallFunc = (toMarshall) => utilDynamodb.unmarshall(toMarshall, options);
    return processKeysInObj(obj, unmarshallFunc, keyNodes);
};

class DynamoDBDocumentClientCommand extends smithyClient.Command {
    addMarshallingMiddleware(configuration) {
        const { marshallOptions = {}, unmarshallOptions = {} } = configuration.translateConfig || {};
        marshallOptions.convertTopLevelContainer = marshallOptions.convertTopLevelContainer ?? true;
        unmarshallOptions.convertWithoutMapWrapper = unmarshallOptions.convertWithoutMapWrapper ?? true;
        this.clientCommand.middlewareStack.addRelativeTo((next, context) => async (args) => {
            core.setFeature(context, "DDB_MAPPER", "d");
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

class BatchExecuteStatementCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        Statements: {
            "*": {
                Parameters: ALL_MEMBERS,
            },
        },
    };
    outputKeyNodes = {
        Responses: {
            "*": {
                Error: {
                    Item: ALL_VALUES,
                },
                Item: ALL_VALUES,
            },
        },
    };
    clientCommand;
    middlewareStack;
    constructor(input) {
        super();
        this.input = input;
        this.clientCommand = new clientDynamodb.BatchExecuteStatementCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class BatchGetCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        RequestItems: {
            "*": {
                Keys: {
                    "*": ALL_VALUES,
                },
            },
        },
    };
    outputKeyNodes = {
        Responses: {
            "*": {
                "*": ALL_VALUES,
            },
        },
        UnprocessedKeys: {
            "*": {
                Keys: {
                    "*": ALL_VALUES,
                },
            },
        },
    };
    clientCommand;
    middlewareStack;
    constructor(input) {
        super();
        this.input = input;
        this.clientCommand = new clientDynamodb.BatchGetItemCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class BatchWriteCommand extends DynamoDBDocumentClientCommand {
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
        this.clientCommand = new clientDynamodb.BatchWriteItemCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class DeleteCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        Key: ALL_VALUES,
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
        this.clientCommand = new clientDynamodb.DeleteItemCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class ExecuteStatementCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        Parameters: ALL_MEMBERS,
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
        this.clientCommand = new clientDynamodb.ExecuteStatementCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class ExecuteTransactionCommand extends DynamoDBDocumentClientCommand {
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
        this.clientCommand = new clientDynamodb.ExecuteTransactionCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class GetCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        Key: ALL_VALUES,
    };
    outputKeyNodes = {
        Item: ALL_VALUES,
    };
    clientCommand;
    middlewareStack;
    constructor(input) {
        super();
        this.input = input;
        this.clientCommand = new clientDynamodb.GetItemCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class PutCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        Item: ALL_VALUES,
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
        this.clientCommand = new clientDynamodb.PutItemCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class QueryCommand extends DynamoDBDocumentClientCommand {
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
        this.clientCommand = new clientDynamodb.QueryCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class ScanCommand extends DynamoDBDocumentClientCommand {
    input;
    inputKeyNodes = {
        ScanFilter: {
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
        this.clientCommand = new clientDynamodb.ScanCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class TransactGetCommand extends DynamoDBDocumentClientCommand {
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
        this.clientCommand = new clientDynamodb.TransactGetItemsCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class TransactWriteCommand extends DynamoDBDocumentClientCommand {
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
        this.clientCommand = new clientDynamodb.TransactWriteItemsCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class UpdateCommand extends DynamoDBDocumentClientCommand {
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
        this.clientCommand = new clientDynamodb.UpdateItemCommand(this.input);
        this.middlewareStack = this.clientCommand.middlewareStack;
    }
    resolveMiddleware(clientStack, configuration, options) {
        this.addMarshallingMiddleware(configuration);
        const stack = clientStack.concat(this.middlewareStack);
        const handler = this.clientCommand.resolveMiddleware(stack, configuration, options);
        return async () => handler(this.clientCommand);
    }
}

class DynamoDBDocumentClient extends smithyClient.Client {
    config;
    constructor(client, translateConfig) {
        super(client.config);
        this.config = client.config;
        this.config.translateConfig = translateConfig;
        this.middlewareStack = client.middlewareStack;
        if (this.config?.cacheMiddleware) {
            throw new Error("@aws-sdk/lib-dynamodb - cacheMiddleware=true is not compatible with the" +
                " DynamoDBDocumentClient. This option must be set to false.");
        }
    }
    static from(client, translateConfig) {
        return new DynamoDBDocumentClient(client, translateConfig);
    }
    destroy() {
    }
}

class DynamoDBDocument extends DynamoDBDocumentClient {
    static from(client, translateConfig) {
        return new DynamoDBDocument(client, translateConfig);
    }
    batchExecuteStatement(args, optionsOrCb, cb) {
        const command = new BatchExecuteStatementCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    batchGet(args, optionsOrCb, cb) {
        const command = new BatchGetCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    batchWrite(args, optionsOrCb, cb) {
        const command = new BatchWriteCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    delete(args, optionsOrCb, cb) {
        const command = new DeleteCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    executeStatement(args, optionsOrCb, cb) {
        const command = new ExecuteStatementCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    executeTransaction(args, optionsOrCb, cb) {
        const command = new ExecuteTransactionCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    get(args, optionsOrCb, cb) {
        const command = new GetCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    put(args, optionsOrCb, cb) {
        const command = new PutCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    query(args, optionsOrCb, cb) {
        const command = new QueryCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    scan(args, optionsOrCb, cb) {
        const command = new ScanCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    transactGet(args, optionsOrCb, cb) {
        const command = new TransactGetCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    transactWrite(args, optionsOrCb, cb) {
        const command = new TransactWriteCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    update(args, optionsOrCb, cb) {
        const command = new UpdateCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
}

const paginateQuery = core$1.createPaginator(DynamoDBDocumentClient, QueryCommand, "ExclusiveStartKey", "LastEvaluatedKey", "Limit");

const paginateScan = core$1.createPaginator(DynamoDBDocumentClient, ScanCommand, "ExclusiveStartKey", "LastEvaluatedKey", "Limit");

Object.defineProperty(exports, "$Command", {
    enumerable: true,
    get: function () { return smithyClient.Command; }
});
Object.defineProperty(exports, "__Client", {
    enumerable: true,
    get: function () { return smithyClient.Client; }
});
Object.defineProperty(exports, "NumberValue", {
    enumerable: true,
    get: function () { return utilDynamodb.NumberValueImpl; }
});
exports.BatchExecuteStatementCommand = BatchExecuteStatementCommand;
exports.BatchGetCommand = BatchGetCommand;
exports.BatchWriteCommand = BatchWriteCommand;
exports.DeleteCommand = DeleteCommand;
exports.DynamoDBDocument = DynamoDBDocument;
exports.DynamoDBDocumentClient = DynamoDBDocumentClient;
exports.DynamoDBDocumentClientCommand = DynamoDBDocumentClientCommand;
exports.ExecuteStatementCommand = ExecuteStatementCommand;
exports.ExecuteTransactionCommand = ExecuteTransactionCommand;
exports.GetCommand = GetCommand;
exports.PutCommand = PutCommand;
exports.QueryCommand = QueryCommand;
exports.ScanCommand = ScanCommand;
exports.TransactGetCommand = TransactGetCommand;
exports.TransactWriteCommand = TransactWriteCommand;
exports.UpdateCommand = UpdateCommand;
exports.paginateQuery = paginateQuery;
exports.paginateScan = paginateScan;
