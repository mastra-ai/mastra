"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRedisJsonNullReply = exports.transformRedisJsonReply = exports.transformRedisJsonArgument = exports.transformStreamsMessagesReplyResp3 = exports.transformStreamsMessagesReplyResp2 = exports.transformStreamMessagesReply = exports.transformStreamMessageNullReply = exports.transformStreamMessageReply = exports.parseArgs = exports.parseZKeysArguments = exports.transformRangeReply = exports.parseSlotRangesArguments = exports.transformFunctionListItemReply = exports.RedisFunctionFlags = exports.transformCommandReply = exports.CommandCategories = exports.CommandFlags = exports.parseOptionalVariadicArgument = exports.pushVariadicArgument = exports.pushVariadicNumberArguments = exports.pushVariadicArguments = exports.pushEvalArguments = exports.evalFirstKeyIndex = exports.transformPXAT = exports.transformEXAT = exports.transformSortedSetReply = exports.transformTuplesReply = exports.createTransformTuplesReplyFunc = exports.transformTuplesToMap = exports.transformNullableDoubleReply = exports.createTransformNullableDoubleReplyResp2Func = exports.transformDoubleArrayReply = exports.createTransformDoubleReplyResp2Func = exports.transformDoubleReply = exports.transformStringDoubleArgument = exports.transformDoubleArgument = exports.transformBooleanArrayReply = exports.transformBooleanReply = exports.isArrayReply = exports.isNullReply = void 0;
const parser_1 = require("../client/parser");
const decoder_1 = require("../RESP/decoder");
function isNullReply(reply) {
    return reply === null;
}
exports.isNullReply = isNullReply;
function isArrayReply(reply) {
    return Array.isArray(reply);
}
exports.isArrayReply = isArrayReply;
exports.transformBooleanReply = {
    2: (reply) => reply === 1,
    3: undefined
};
exports.transformBooleanArrayReply = {
    2: (reply) => {
        return reply.map(exports.transformBooleanReply[2]);
    },
    3: undefined
};
function transformDoubleArgument(num) {
    switch (num) {
        case Infinity:
            return '+inf';
        case -Infinity:
            return '-inf';
        default:
            return num.toString();
    }
}
exports.transformDoubleArgument = transformDoubleArgument;
function transformStringDoubleArgument(num) {
    if (typeof num !== 'number')
        return num;
    return transformDoubleArgument(num);
}
exports.transformStringDoubleArgument = transformStringDoubleArgument;
exports.transformDoubleReply = {
    2: (reply, preserve, typeMapping) => {
        const double = typeMapping ? typeMapping[decoder_1.RESP_TYPES.DOUBLE] : undefined;
        switch (double) {
            case String: {
                return reply;
            }
            default: {
                let ret;
                switch (reply.toString()) {
                    case 'inf':
                    case '+inf':
                        ret = Infinity;
                    case '-inf':
                        ret = -Infinity;
                    case 'nan':
                        ret = NaN;
                    default:
                        ret = Number(reply);
                }
                return ret;
            }
        }
    },
    3: undefined
};
function createTransformDoubleReplyResp2Func(preserve, typeMapping) {
    return (reply) => {
        return exports.transformDoubleReply[2](reply, preserve, typeMapping);
    };
}
exports.createTransformDoubleReplyResp2Func = createTransformDoubleReplyResp2Func;
exports.transformDoubleArrayReply = {
    2: (reply, preserve, typeMapping) => {
        return reply.map(createTransformDoubleReplyResp2Func(preserve, typeMapping));
    },
    3: undefined
};
function createTransformNullableDoubleReplyResp2Func(preserve, typeMapping) {
    return (reply) => {
        return exports.transformNullableDoubleReply[2](reply, preserve, typeMapping);
    };
}
exports.createTransformNullableDoubleReplyResp2Func = createTransformNullableDoubleReplyResp2Func;
exports.transformNullableDoubleReply = {
    2: (reply, preserve, typeMapping) => {
        if (reply === null)
            return null;
        return exports.transformDoubleReply[2](reply, preserve, typeMapping);
    },
    3: undefined
};
function transformTuplesToMap(reply, func) {
    const message = Object.create(null);
    for (let i = 0; i < reply.length; i += 2) {
        message[reply[i].toString()] = func(reply[i + 1]);
    }
    return message;
}
exports.transformTuplesToMap = transformTuplesToMap;
function createTransformTuplesReplyFunc(preserve, typeMapping) {
    return (reply) => {
        return transformTuplesReply(reply, preserve, typeMapping);
    };
}
exports.createTransformTuplesReplyFunc = createTransformTuplesReplyFunc;
function transformTuplesReply(reply, preserve, typeMapping) {
    const mapType = typeMapping ? typeMapping[decoder_1.RESP_TYPES.MAP] : undefined;
    const inferred = reply;
    switch (mapType) {
        case Array: {
            return reply;
        }
        case Map: {
            const ret = new Map;
            for (let i = 0; i < inferred.length; i += 2) {
                ret.set(inferred[i].toString(), inferred[i + 1]);
            }
            return ret;
            ;
        }
        default: {
            const ret = Object.create(null);
            for (let i = 0; i < inferred.length; i += 2) {
                ret[inferred[i].toString()] = inferred[i + 1];
            }
            return ret;
            ;
        }
    }
}
exports.transformTuplesReply = transformTuplesReply;
exports.transformSortedSetReply = {
    2: (reply, preserve, typeMapping) => {
        const inferred = reply, members = [];
        for (let i = 0; i < inferred.length; i += 2) {
            members.push({
                value: inferred[i],
                score: exports.transformDoubleReply[2](inferred[i + 1], preserve, typeMapping)
            });
        }
        return members;
    },
    3: (reply) => {
        return reply.map(member => {
            const [value, score] = member;
            return {
                value,
                score
            };
        });
    }
};
function transformEXAT(EXAT) {
    return (typeof EXAT === 'number' ? EXAT : Math.floor(EXAT.getTime() / 1000)).toString();
}
exports.transformEXAT = transformEXAT;
function transformPXAT(PXAT) {
    return (typeof PXAT === 'number' ? PXAT : PXAT.getTime()).toString();
}
exports.transformPXAT = transformPXAT;
function evalFirstKeyIndex(options) {
    return options?.keys?.[0];
}
exports.evalFirstKeyIndex = evalFirstKeyIndex;
function pushEvalArguments(args, options) {
    if (options?.keys) {
        args.push(options.keys.length.toString(), ...options.keys);
    }
    else {
        args.push('0');
    }
    if (options?.arguments) {
        args.push(...options.arguments);
    }
    return args;
}
exports.pushEvalArguments = pushEvalArguments;
function pushVariadicArguments(args, value) {
    if (Array.isArray(value)) {
        // https://github.com/redis/node-redis/pull/2160
        args = args.concat(value);
    }
    else {
        args.push(value);
    }
    return args;
}
exports.pushVariadicArguments = pushVariadicArguments;
function pushVariadicNumberArguments(args, value) {
    if (Array.isArray(value)) {
        for (const item of value) {
            args.push(item.toString());
        }
    }
    else {
        args.push(value.toString());
    }
    return args;
}
exports.pushVariadicNumberArguments = pushVariadicNumberArguments;
function pushVariadicArgument(args, value) {
    if (Array.isArray(value)) {
        args.push(value.length.toString(), ...value);
    }
    else {
        args.push('1', value);
    }
    return args;
}
exports.pushVariadicArgument = pushVariadicArgument;
function parseOptionalVariadicArgument(parser, name, value) {
    if (value === undefined)
        return;
    parser.push(name);
    parser.pushVariadicWithLength(value);
}
exports.parseOptionalVariadicArgument = parseOptionalVariadicArgument;
var CommandFlags;
(function (CommandFlags) {
    CommandFlags["WRITE"] = "write";
    CommandFlags["READONLY"] = "readonly";
    CommandFlags["DENYOOM"] = "denyoom";
    CommandFlags["ADMIN"] = "admin";
    CommandFlags["PUBSUB"] = "pubsub";
    CommandFlags["NOSCRIPT"] = "noscript";
    CommandFlags["RANDOM"] = "random";
    CommandFlags["SORT_FOR_SCRIPT"] = "sort_for_script";
    CommandFlags["LOADING"] = "loading";
    CommandFlags["STALE"] = "stale";
    CommandFlags["SKIP_MONITOR"] = "skip_monitor";
    CommandFlags["ASKING"] = "asking";
    CommandFlags["FAST"] = "fast";
    CommandFlags["MOVABLEKEYS"] = "movablekeys"; // keys have no pre-determined position. You must discover keys yourself.
})(CommandFlags || (exports.CommandFlags = CommandFlags = {}));
var CommandCategories;
(function (CommandCategories) {
    CommandCategories["KEYSPACE"] = "@keyspace";
    CommandCategories["READ"] = "@read";
    CommandCategories["WRITE"] = "@write";
    CommandCategories["SET"] = "@set";
    CommandCategories["SORTEDSET"] = "@sortedset";
    CommandCategories["LIST"] = "@list";
    CommandCategories["HASH"] = "@hash";
    CommandCategories["STRING"] = "@string";
    CommandCategories["BITMAP"] = "@bitmap";
    CommandCategories["HYPERLOGLOG"] = "@hyperloglog";
    CommandCategories["GEO"] = "@geo";
    CommandCategories["STREAM"] = "@stream";
    CommandCategories["PUBSUB"] = "@pubsub";
    CommandCategories["ADMIN"] = "@admin";
    CommandCategories["FAST"] = "@fast";
    CommandCategories["SLOW"] = "@slow";
    CommandCategories["BLOCKING"] = "@blocking";
    CommandCategories["DANGEROUS"] = "@dangerous";
    CommandCategories["CONNECTION"] = "@connection";
    CommandCategories["TRANSACTION"] = "@transaction";
    CommandCategories["SCRIPTING"] = "@scripting";
})(CommandCategories || (exports.CommandCategories = CommandCategories = {}));
function transformCommandReply([name, arity, flags, firstKeyIndex, lastKeyIndex, step, categories]) {
    return {
        name,
        arity,
        flags: new Set(flags),
        firstKeyIndex,
        lastKeyIndex,
        step,
        categories: new Set(categories)
    };
}
exports.transformCommandReply = transformCommandReply;
var RedisFunctionFlags;
(function (RedisFunctionFlags) {
    RedisFunctionFlags["NO_WRITES"] = "no-writes";
    RedisFunctionFlags["ALLOW_OOM"] = "allow-oom";
    RedisFunctionFlags["ALLOW_STALE"] = "allow-stale";
    RedisFunctionFlags["NO_CLUSTER"] = "no-cluster";
})(RedisFunctionFlags || (exports.RedisFunctionFlags = RedisFunctionFlags = {}));
function transformFunctionListItemReply(reply) {
    return {
        libraryName: reply[1],
        engine: reply[3],
        functions: reply[5].map(fn => ({
            name: fn[1],
            description: fn[3],
            flags: fn[5]
        }))
    };
}
exports.transformFunctionListItemReply = transformFunctionListItemReply;
function parseSlotRangeArguments(parser, range) {
    parser.push(range.start.toString(), range.end.toString());
}
function parseSlotRangesArguments(parser, ranges) {
    if (Array.isArray(ranges)) {
        for (const range of ranges) {
            parseSlotRangeArguments(parser, range);
        }
    }
    else {
        parseSlotRangeArguments(parser, ranges);
    }
}
exports.parseSlotRangesArguments = parseSlotRangesArguments;
function transformRangeReply([start, end]) {
    return {
        start,
        end
    };
}
exports.transformRangeReply = transformRangeReply;
function parseZKeysArguments(parser, keys) {
    if (Array.isArray(keys)) {
        parser.push(keys.length.toString());
        if (keys.length) {
            if (isPlainKeys(keys)) {
                parser.pushKeys(keys);
            }
            else {
                for (let i = 0; i < keys.length; i++) {
                    parser.pushKey(keys[i].key);
                }
                parser.push('WEIGHTS');
                for (let i = 0; i < keys.length; i++) {
                    parser.push(transformDoubleArgument(keys[i].weight));
                }
            }
        }
    }
    else {
        parser.push('1');
        if (isPlainKey(keys)) {
            parser.pushKey(keys);
        }
        else {
            parser.pushKey(keys.key);
            parser.push('WEIGHTS', transformDoubleArgument(keys.weight));
        }
    }
}
exports.parseZKeysArguments = parseZKeysArguments;
function isPlainKey(key) {
    return typeof key === 'string' || key instanceof Buffer;
}
function isPlainKeys(keys) {
    return isPlainKey(keys[0]);
}
/**
 * @deprecated
 */
function parseArgs(command, ...args) {
    const parser = new parser_1.BasicCommandParser();
    command.parseCommand(parser, ...args);
    const redisArgs = parser.redisArgs;
    if (parser.preserve) {
        redisArgs.preserve = parser.preserve;
    }
    return redisArgs;
}
exports.parseArgs = parseArgs;
function transformStreamMessageReply(typeMapping, reply) {
    const [id, message] = reply;
    return {
        id: id,
        message: transformTuplesReply(message, undefined, typeMapping)
    };
}
exports.transformStreamMessageReply = transformStreamMessageReply;
function transformStreamMessageNullReply(typeMapping, reply) {
    return isNullReply(reply) ? reply : transformStreamMessageReply(typeMapping, reply);
}
exports.transformStreamMessageNullReply = transformStreamMessageNullReply;
function transformStreamMessagesReply(r, typeMapping) {
    const reply = r;
    return reply.map(transformStreamMessageReply.bind(undefined, typeMapping));
}
exports.transformStreamMessagesReply = transformStreamMessagesReply;
function transformStreamsMessagesReplyResp2(reply, preserve, typeMapping) {
    // FUTURE: resposne type if resp3 was working, reverting to old v4 for now
    //: MapReply<BlobStringReply | string, StreamMessagesReply> | NullReply {
    if (reply === null)
        return null;
    switch (typeMapping ? typeMapping[decoder_1.RESP_TYPES.MAP] : undefined) {
        /* FUTURE: a response type for when resp3 is working properly
            case Map: {
              const ret = new Map<string, StreamMessagesReply>();
        
              for (let i=0; i < reply.length; i++) {
                const stream = reply[i] as unknown as UnwrapReply<StreamMessagesRawReply>;
            
                const name = stream[0];
                const rawMessages = stream[1];
            
                ret.set(name.toString(), transformStreamMessagesReply(rawMessages, typeMapping));
              }
            
              return ret as unknown as MapReply<string, StreamMessagesReply>;
            }
            case Array: {
              const ret: Array<BlobStringReply | StreamMessagesReply> = [];
        
              for (let i=0; i < reply.length; i++) {
                const stream = reply[i] as unknown as UnwrapReply<StreamMessagesRawReply>;
            
                const name = stream[0];
                const rawMessages = stream[1];
            
                ret.push(name);
                ret.push(transformStreamMessagesReply(rawMessages, typeMapping));
              }
        
              return ret as unknown as MapReply<string, StreamMessagesReply>;
            }
            default: {
              const ret: Record<string, StreamMessagesReply> = Object.create(null);
        
              for (let i=0; i < reply.length; i++) {
                const stream = reply[i] as unknown as UnwrapReply<StreamMessagesRawReply>;
            
                const name = stream[0] as unknown as UnwrapReply<BlobStringReply>;
                const rawMessages = stream[1];
            
                ret[name.toString()] = transformStreamMessagesReply(rawMessages);
              }
            
              return ret as unknown as MapReply<string, StreamMessagesReply>;
            }
        */
        // V4 compatible response type
        default: {
            const ret = [];
            for (let i = 0; i < reply.length; i++) {
                const stream = reply[i];
                ret.push({
                    name: stream[0],
                    messages: transformStreamMessagesReply(stream[1])
                });
            }
            return ret;
        }
    }
}
exports.transformStreamsMessagesReplyResp2 = transformStreamsMessagesReplyResp2;
function transformStreamsMessagesReplyResp3(reply) {
    if (reply === null)
        return null;
    if (reply instanceof Map) {
        const ret = new Map();
        for (const [n, rawMessages] of reply) {
            const name = n;
            ret.set(name.toString(), transformStreamMessagesReply(rawMessages));
        }
        return ret;
    }
    else if (reply instanceof Array) {
        const ret = [];
        for (let i = 0; i < reply.length; i += 2) {
            const name = reply[i];
            const rawMessages = reply[i + 1];
            ret.push(name);
            ret.push(transformStreamMessagesReply(rawMessages));
        }
        return ret;
    }
    else {
        const ret = Object.create(null);
        for (const [name, rawMessages] of Object.entries(reply)) {
            ret[name] = transformStreamMessagesReply(rawMessages);
        }
        return ret;
    }
}
exports.transformStreamsMessagesReplyResp3 = transformStreamsMessagesReplyResp3;
function transformRedisJsonArgument(json) {
    return JSON.stringify(json);
}
exports.transformRedisJsonArgument = transformRedisJsonArgument;
function transformRedisJsonReply(json) {
    const res = JSON.parse(json.toString());
    return res;
}
exports.transformRedisJsonReply = transformRedisJsonReply;
function transformRedisJsonNullReply(json) {
    return isNullReply(json) ? json : transformRedisJsonReply(json);
}
exports.transformRedisJsonNullReply = transformRedisJsonNullReply;
//# sourceMappingURL=generic-transformers.js.map