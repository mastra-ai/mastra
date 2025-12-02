"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("./errors");
class RedisMultiCommand {
    typeMapping;
    constructor(typeMapping) {
        this.typeMapping = typeMapping;
    }
    queue = [];
    scriptsInUse = new Set();
    addCommand(args, transformReply) {
        this.queue.push({
            args,
            transformReply
        });
    }
    addScript(script, args, transformReply) {
        const redisArgs = [];
        redisArgs.preserve = args.preserve;
        if (this.scriptsInUse.has(script.SHA1)) {
            redisArgs.push('EVALSHA', script.SHA1);
        }
        else {
            this.scriptsInUse.add(script.SHA1);
            redisArgs.push('EVAL', script.SCRIPT);
        }
        if (script.NUMBER_OF_KEYS !== undefined) {
            redisArgs.push(script.NUMBER_OF_KEYS.toString());
        }
        redisArgs.push(...args);
        this.addCommand(redisArgs, transformReply);
    }
    transformReplies(rawReplies) {
        const errorIndexes = [], replies = rawReplies.map((reply, i) => {
            if (reply instanceof errors_1.ErrorReply) {
                errorIndexes.push(i);
                return reply;
            }
            const { transformReply, args } = this.queue[i];
            return transformReply ? transformReply(reply, args.preserve, this.typeMapping) : reply;
        });
        if (errorIndexes.length)
            throw new errors_1.MultiErrorReply(replies, errorIndexes);
        return replies;
    }
}
exports.default = RedisMultiCommand;
//# sourceMappingURL=multi-command.js.map