"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const SORT_1 = __importDefault(require("./SORT"));
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Sorts the elements in a list, set or sorted set and stores the result in a new list.
     * @param parser - The Redis command parser.
     * @param source - Key of the source list, set or sorted set.
     * @param destination - Destination key where the result will be stored.
     * @param options - Optional sorting parameters.
     */
    parseCommand(parser, source, destination, options) {
        SORT_1.default.parseCommand(parser, source, options);
        parser.push('STORE', destination);
    },
    transformReply: undefined
};
//# sourceMappingURL=SORT_STORE.js.map