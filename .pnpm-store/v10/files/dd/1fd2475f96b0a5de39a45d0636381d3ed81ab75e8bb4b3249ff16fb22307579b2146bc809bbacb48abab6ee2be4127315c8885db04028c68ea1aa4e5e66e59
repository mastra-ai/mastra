"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CLIENT_INFO_1 = __importDefault(require("./CLIENT_INFO"));
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns information about all client connections. Can be filtered by type or ID
     * @param parser - The Redis command parser
     * @param filter - Optional filter to return only specific client types or IDs
     */
    parseCommand(parser, filter) {
        parser.push('CLIENT', 'LIST');
        if (filter) {
            if (filter.TYPE !== undefined) {
                parser.push('TYPE', filter.TYPE);
            }
            else {
                parser.push('ID');
                parser.pushVariadic(filter.ID);
            }
        }
    },
    transformReply(rawReply) {
        const split = rawReply.toString().split('\n'), length = split.length - 1, reply = [];
        for (let i = 0; i < length; i++) {
            reply.push(CLIENT_INFO_1.default.transformReply(split[i]));
        }
        return reply;
    }
};
//# sourceMappingURL=CLIENT_LIST.js.map